import express, { Request, Response } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Base directories for local audio persistence
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const REFERENCES_DIR = path.resolve(UPLOADS_DIR, 'references');
const GENERATED_DIR = path.resolve(UPLOADS_DIR, 'generated');
const PROFILES_PATH = path.resolve(UPLOADS_DIR, 'profiles.json');

fs.mkdirSync(REFERENCES_DIR, { recursive: true });
fs.mkdirSync(GENERATED_DIR, { recursive: true });

if (!fs.existsSync(PROFILES_PATH)) {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify([]), 'utf-8');
}

// Configurable Open Source TTS Backend URL (e.g. local Python FastAPI or remote GPU server)
let currentBackendUrl = process.env.OPEN_TTS_BACKEND_URL || 'http://localhost:8000';

// Multer disk storage for local reference sermon MP3/WAV files
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, REFERENCES_DIR);
  },
  filename: (_req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${cleanName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Ugyldig filtype for stemmeopptak: ${file.originalname}. Kun MP3, WAV og M4A støttes.`));
    }
  },
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Helper to read and write profiles
function getStoredProfiles(): Array<{
  id: string;
  name: string;
  description: string;
  dialect: string;
  referenceFileIds: string[];
  referenceFileNames: string[];
  createdAt: string;
}> {
  try {
    const data = fs.readFileSync(PROFILES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveProfiles(profiles: unknown[]) {
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
}

// 1. Health and Backend Connection Status
app.get('/api/open-backend/status', async (_req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const backendRes = await fetch(`${currentBackendUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (backendRes.ok) {
      const data = await backendRes.json();
      res.json({
        connected: true,
        backendUrl: currentBackendUrl,
        provider: data.provider || 'Resemble AI Chatterbox',
        model: data.model || 'resemble-ai/chatterbox-multilingual',
        license: data.license || 'MIT',
        device: data.device || 'Ukjent maskinvare',
        modelLoaded: data.model_loaded ?? false,
        loadError: data.load_error || null,
        vram: data.vram || null,
        supportedLanguages: data.supported_languages || ['no'],
        defaultLanguage: 'no',
      });
      return;
    }
  } catch {
    // Backend is unreachable or offline
  }

  res.json({
    connected: false,
    backendUrl: currentBackendUrl,
    provider: 'Resemble AI Chatterbox Multilingual',
    model: 'resemble-ai/chatterbox-multilingual',
    license: 'MIT',
    device: 'Ikke tilkoblet',
    modelLoaded: false,
    loadError: 'Ingen svar fra FastAPI backend på ' + currentBackendUrl,
    setupGuide: {
      step1: 'Start Python-tjenesten lokalt eller på en GPU-server (RunPod, Vast.ai eller lokal PC med NVIDIA GPU).',
      step2: 'Kjør: cd backend && ./run.sh',
      step3: 'Eller med Docker: cd backend && docker compose up --build',
      step4: 'Oppgi serveradressen i innstillinger i TaleLab.',
    },
  });
});

// 2. Configure Open Model Backend URL
app.post('/api/open-backend/config', async (req: Request, res: Response) => {
  const { backendUrl } = req.body;
  if (!backendUrl || typeof backendUrl !== 'string' || !backendUrl.trim()) {
    res.status(400).json({ error: 'Ugyldig URL for backend.' });
    return;
  }

  const cleanUrl = backendUrl.trim().replace(/\/+$/, '');
  currentBackendUrl = cleanUrl;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const backendRes = await fetch(`${cleanUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (backendRes.ok) {
      const data = await backendRes.json();
      res.json({
        success: true,
        connected: true,
        backendUrl: cleanUrl,
        details: data,
        message: `Tilkoblet åpen AI-backend på ${cleanUrl}! Modell: ${data.model} (${data.device})`,
      });
      return;
    }
  } catch {
    // Ping failed
  }

  res.json({
    success: true,
    connected: false,
    backendUrl: cleanUrl,
    message: `URL oppdatert til ${cleanUrl}, men fant ingen kjørende tjeneste der ennå. Start backend med ./run.sh.`,
  });
});

// 3. Upload reference sermon MP3/WAV files
app.post('/api/references', upload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    res.status(400).json({
      error: 'Ingen lydfiler mottatt. Vennligst last opp minst én MP3- eller WAV-fil med prekenopptak.',
    });
    return;
  }

  const savedReferences = [];

  for (const f of files) {
    savedReferences.push({
      id: f.filename,
      originalName: f.originalname,
      sizeBytes: f.size,
      mimetype: f.mimetype,
      path: f.path,
      createdAt: new Date().toISOString(),
    });

    // Also attempt to push to Python backend if reachable
    try {
      const fileBuffer = fs.readFileSync(f.path);
      const form = new FormData();
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: f.mimetype || 'audio/mpeg' });
      form.append('file', blob, f.originalname);

      await fetch(`${currentBackendUrl}/upload-reference`, {
        method: 'POST',
        body: form,
      }).catch(() => null);
    } catch {
      // Background push failure is non-blocking
    }
  }

  res.json({
    success: true,
    message: `${savedReferences.length} prekenopptak lagret som referansemateriale.`,
    references: savedReferences,
  });
});

// 4. List reference sermon recordings
app.get('/api/references', (_req: Request, res: Response) => {
  try {
    const fileNames = fs.readdirSync(REFERENCES_DIR);
    const references = fileNames
      .filter((name) => ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(path.extname(name).toLowerCase()))
      .map((filename) => {
        const fullPath = path.join(REFERENCES_DIR, filename);
        const stat = fs.statSync(fullPath);
        return {
          id: filename,
          filename,
          sizeBytes: stat.size,
          createdAt: stat.birthtime.toISOString(),
          audioUrl: `/api/references/${filename}/stream`,
        };
      });

    res.json(references);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Kunne ikke hente referansefiler.';
    res.status(500).json({ error: msg });
  }
});

// Stream a reference audio file
app.get('/api/references/:filename/stream', (req: Request, res: Response) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(REFERENCES_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Lydfil ikke funnet.');
    return;
  }

  res.sendFile(filePath);
});

// Delete a reference audio file
app.delete('/api/references/:filename', (req: Request, res: Response) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(REFERENCES_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true, message: 'Referansefil slettet.' });
});

// 5. Voice Profiles Management (mapping named profiles to real uploaded sermon audio)
app.post('/api/voice-profiles', (req: Request, res: Response) => {
  const { name, description, dialect, referenceFileIds } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Mangler navn på stemmeprofilen (f.eks. «Magnar – prekenstemme»).' });
    return;
  }

  if (!referenceFileIds || !Array.isArray(referenceFileIds) || referenceFileIds.length === 0) {
    res.status(400).json({
      error: 'En stemmeprofil må kobles til minst én opplastet MP3-prekenfil som referanse.',
    });
    return;
  }

  // Verify that files exist
  const existingFiles = referenceFileIds.filter((id) =>
    fs.existsSync(path.join(REFERENCES_DIR, path.basename(id)))
  );

  if (existingFiles.length === 0) {
    res.status(400).json({ error: 'Ingen av de oppgitte referansefilene finnes på serveren.' });
    return;
  }

  const profiles = getStoredProfiles();
  const newProfile = {
    id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    description: (description || '').trim(),
    dialect: (dialect || 'Bokmål').trim(),
    referenceFileIds: existingFiles,
    referenceFileNames: existingFiles.map((id) => path.basename(id)),
    createdAt: new Date().toISOString(),
  };

  profiles.unshift(newProfile);
  saveProfiles(profiles);

  res.json({
    success: true,
    message: `Stemmeprofilen «${newProfile.name}» ble opprettet og koblet til ${existingFiles.length} prekenopptak.`,
    profile: newProfile,
  });
});

app.get('/api/voice-profiles', (_req: Request, res: Response) => {
  res.json(getStoredProfiles());
});

app.delete('/api/voice-profiles/:id', (req: Request, res: Response) => {
  const profiles = getStoredProfiles();
  const filtered = profiles.filter((p) => p.id !== req.params.id);
  saveProfiles(filtered);
  res.json({ success: true, message: 'Stemmeprofil slettet.' });
});

// 6. Speech Generation (Synthesize Norwegian speech using Open Source Model with Audio Reference)
app.post('/api/synthesize', async (req: Request, res: Response) => {
  const { text, reference_id, profile_id, language, exaggeration, cfg_weight } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Mangler tekst for opplesning.' });
    return;
  }

  // Resolve reference audio file
  let resolvedRefId = reference_id;

  if (!resolvedRefId && profile_id) {
    const profiles = getStoredProfiles();
    const profile = profiles.find((p) => p.id === profile_id);
    if (profile && profile.referenceFileIds.length > 0) {
      resolvedRefId = profile.referenceFileIds[0];
    }
  }

  if (!resolvedRefId) {
    res.status(400).json({
      error: 'Mangler referanselyd. Vennligst velg en stemmeprofil eller et prekenopptak som stemmereferanse.',
    });
    return;
  }

  const safeRefFilename = path.basename(resolvedRefId);
  const localRefPath = path.join(REFERENCES_DIR, safeRefFilename);

  if (!fs.existsSync(localRefPath)) {
    res.status(404).json({
      error: `Fant ikke referansefilen «${safeRefFilename}» i lokalt bibliotek. Last den opp på nytt.`,
    });
    return;
  }

  // Ensure file is sent to Python backend
  try {
    const fileBuffer = fs.readFileSync(localRefPath);
    const form = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'audio/mpeg' });
    form.append('file', blob, safeRefFilename);

    await fetch(`${currentBackendUrl}/upload-reference`, {
      method: 'POST',
      body: form,
    }).catch(() => null);
  } catch {
    // Non-fatal if already present on backend
  }

  // Call the open-source backend's /synthesize endpoint
  try {
    const backendRes = await fetch(`${currentBackendUrl}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        reference_id: safeRefFilename,
        language: language || 'no',
        exaggeration: typeof exaggeration === 'number' ? exaggeration : 0.50,
        cfg_weight: typeof cfg_weight === 'number' ? cfg_weight : 0.50,
      }),
    });

    if (!backendRes.ok) {
      const errJson = await backendRes.json().catch(() => ({}));
      res.status(backendRes.status).json({
        error: errJson.detail || `Modellen feilet med status ${backendRes.status}.`,
        details: errJson,
      });
      return;
    }

    const audioArrayBuffer = await backendRes.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    // Save to generated folder
    const outputFilename = `generert_${Date.now()}_preken.mp3`;
    const outputPath = path.join(GENERATED_DIR, outputFilename);
    fs.writeFileSync(outputPath, audioBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Content-Disposition': `inline; filename="${outputFilename}"`,
      'Cache-Control': 'no-cache',
    });

    res.send(audioBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Nettverksfeil mot åpen AI-backend.';
    res.status(503).json({
      error: `Kunne ikke kontakte åpen AI-backend (${currentBackendUrl}). Sørg for at Python/FastAPI-tjenesten kjører (cd backend && ./run.sh eller docker compose up).`,
      technicalMessage: msg,
      backendUrl: currentBackendUrl,
    });
  }
});

// 7. Technology and Model Analysis Report (Updated for Open Models)
app.get('/api/model-analysis', (_req: Request, res: Response) => {
  res.json({
    activeArchitecture: 'Selv-vert åpen kildekode (Open Source Self-Hosted)',
    selectedModel: 'Resemble AI Chatterbox Multilingual',
    modelRepo: 'https://github.com/resemble-ai/chatterbox',
    license: 'MIT (Fritt tilgjengelig, ingen kommersiell leverandørlås)',
    norwegianSupport: 'Støtter norsk bokmål (språkkode: "no")',
    voiceCloningMethod: 'Zero-shot stemmekloning med referanselyd (audio_prompt_path)',
    hardwareRequirement: 'NVIDIA GPU (RTX 3060/3090/4090 eller A10/L4 i sky) anbefalt. Kan kjøres på CPU for testing.',
    modelsComparison: [
      {
        provider: 'Resemble AI',
        model: 'Chatterbox Multilingual',
        license: 'MIT',
        openSource: true,
        norwegianSupport: 'Ja (no)',
        voiceCloningType: 'Zero-shot stemmekloning fra referanseopptak',
        minAudioTime: '5–15 sekunder ren tale',
        hardwareReq: '6–12 GB VRAM (GPU) eller CPU',
        status: 'Valgt og integrert i TaleLab backend',
        pros: [
          'Full kontroll over egne opptak og modellvekter',
          'Ingen kommersielle API-nøkler, kvotebegrensninger eller månedsgebyrer',
          'MIT-lisens tillater ubegrenset bruk og videreutvikling',
          'Enkel integrasjon via audio_prompt_path og Python/FastAPI',
        ],
        cons: [
          'Krever egen GPU-server eller kraftig lokal maskinvare for sanntids hastighet',
        ],
      },
      {
        provider: 'Coqui TTS',
        model: 'XTTS-v2',
        license: 'Coqui Public Model License',
        openSource: true,
        norwegianSupport: 'Ja (17 språk inkludert norsk)',
        voiceCloningType: 'Zero-shot stemmekloning',
        minAudioTime: '6–30 sekunder',
        hardwareReq: '8–16 GB VRAM',
        status: 'Alternativ åpen modell',
        pros: ['Gode stemmekloningsegenskaper'],
        cons: ['Krever mer VRAM og har mer restriktiv lisens enn MIT-lisensen til Chatterbox'],
      },
      {
        provider: 'F5-TTS',
        model: 'F5-TTS (Non-autoregressive flow matching)',
        license: 'MIT',
        openSource: true,
        norwegianSupport: 'Begrenset (primært trent på engelsk og kinesisk)',
        voiceCloningType: 'Zero-shot stemmekloning',
        minAudioTime: '10 sekunder',
        hardwareReq: '8–16 GB VRAM',
        status: 'Ikke optimal for norsk',
        pros: ['Svært rask generering via flow matching'],
        cons: ['Svak uttale og ufullstendig støtte for norske særnorske tegn (æ, ø, å)'],
      },
    ],
  });
});

// Setup Vite development middleware or static production serve
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TaleLab kjører på http://0.0.0.0:${PORT}`);
    console.log(`Koblet mot åpen AI-backend: ${currentBackendUrl}`);
  });
}

startServer().catch((err) => {
  console.error('Kunne ikke starte TaleLab server:', err);
  process.exit(1);
});
