import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Play,
  Pause,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Volume2,
  Trash2,
  RotateCcw,
  Sliders,
  FileAudio,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { AudioSampleFile, OpenBackendStatus, OpenModelSettings, VoiceProfile } from '../types.ts';
import { formatDuration, formatFileSize, getAudioDuration } from '../utils/audioUtils.ts';

interface TestStudioProps {
  backendStatus: OpenBackendStatus | null;
  onOpenBackendModal: () => void;
  voiceProfiles: VoiceProfile[];
  onProfileCreated: (profile: VoiceProfile) => void;
  onSaveGeneratedAudio: (record: {
    title: string;
    text: string;
    voiceName: string;
    voiceId: string;
    audioBlob: Blob;
    durationSeconds: number;
  }) => void;
}

const MANDATORY_TEST_TEXT =
  'Kjære forsamling. Nåde være med dere og fred fra Gud, vår Far, og Herren Jesus Kristus. I dag skal vi stanse ved et ord som minner oss om at lyset skinner i mørket, og mørket har ikke overvunnet det.';

export const TestStudio: React.FC<TestStudioProps> = ({
  backendStatus,
  onOpenBackendModal,
  voiceProfiles,
  onProfileCreated,
  onSaveGeneratedAudio,
}) => {
  // Step 1: Uploaded audio samples
  const [audioSamples, setAudioSamples] = useState<AudioSampleFile[]>([]);
  const [activePlayingSampleId, setActivePlayingSampleId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Step 2: Voice Profile fields
  const [profileName, setProfileName] = useState('Magnar – prekenstemme');
  const [dialect, setDialect] = useState('Østlandsk (Bokmål)');
  const [description, setDescription] = useState('Referanseopptak for prekenstemme');
  const [hasVoiceConsent, setHasVoiceConsent] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<VoiceProfile | null>(voiceProfiles[0] || null);

  // Step 3: Text field
  const [testText, setTestText] = useState(MANDATORY_TEST_TEXT);

  // Step 4: Model controls (Chatterbox parameters: exaggeration & cfg_weight)
  const [modelSettings, setModelSettings] = useState<OpenModelSettings>({
    exaggeration: 0.50, // Chatterbox emotional expressiveness
    cfg_weight: 0.50,   // Guidance weight / pacing
    language: 'no',     // Norwegian
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Step 5: Output generated audio
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedDuration, setGeneratedDuration] = useState<number>(0);
  const [isPlayingGenerated, setIsPlayingGenerated] = useState(false);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  const totalAudioDuration = audioSamples.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

  useEffect(() => {
    if (voiceProfiles.length > 0 && !activeProfile) {
      setActiveProfile(voiceProfiles[0]);
    }
  }, [voiceProfiles, activeProfile]);

  // Upload handler for MP3 sermon recordings
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProfileError(null);
    const newSamples: AudioSampleFile[] = [];

    // First create local preview representations
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const duration = await getAudioDuration(file);
      newSamples.push({
        id: `sample-${Date.now()}-${i}`,
        file,
        name: file.name,
        size: file.size,
        durationSeconds: duration,
        objectUrl: URL.createObjectURL(file),
      });
    }

    setAudioSamples((prev) => [...prev, ...newSamples]);

    // Send to local backend storage
    const formData = new FormData();
    for (const s of newSamples) {
      formData.append('files', s.file, s.name);
    }

    try {
      await fetch('/api/references', {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      console.warn('Kunne ikke lagre til /api/references:', err);
    }

    e.target.value = '';
  };

  const removeSample = (id: string) => {
    setAudioSamples((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleTogglePlaySample = (sample: AudioSampleFile) => {
    if (!sampleAudioRef.current) return;

    if (activePlayingSampleId === sample.id) {
      sampleAudioRef.current.pause();
      setActivePlayingSampleId(null);
    } else {
      sampleAudioRef.current.src = sample.objectUrl;
      sampleAudioRef.current.play();
      setActivePlayingSampleId(sample.id);
    }
  };

  // Step 2: Create Voice Profile linked to the real uploaded files
  const handleCreateProfile = async () => {
    if (audioSamples.length === 0) {
      setProfileError('Du må laste opp minst én MP3-fil med prekenopptak før du oppretter profilen.');
      return;
    }

    if (!profileName.trim()) {
      setProfileError('Vennligst oppgi et profilnavn (f.eks. «Magnar – prekenstemme»).');
      return;
    }

    if (!hasVoiceConsent) {
      setProfileError('Du må bekrefte at du har rettighetene til disse opptakene.');
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccessMsg(null);

    try {
      // First ensure files are uploaded
      const formData = new FormData();
      for (const s of audioSamples) {
        formData.append('files', s.file, s.name);
      }

      const uploadRes = await fetch('/api/references', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      const referenceIds = uploadData.references?.map((r: { id: string }) => r.id) || [];

      // Create profile pointing to these exact audio files
      const profileRes = await fetch('/api/voice-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName.trim(),
          description: description.trim(),
          dialect: dialect.trim(),
          referenceFileIds: referenceIds,
        }),
      });

      const profileData = await profileRes.json();
      if (!profileRes.ok) {
        setProfileError(profileData.error || 'Kunne ikke opprette stemmeprofil.');
      } else {
        setActiveProfile(profileData.profile);
        onProfileCreated(profileData.profile);
        setProfileSuccessMsg(
          `Stemmeprofilen «${profileData.profile.name}» ble opprettet og koblet til ${profileData.profile.referenceFileNames.length} prekenopptak!`
        );
      }
    } catch {
      setProfileError('Nettverksfeil under opprettelse av stemmeprofil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Step 4: Generate Speech with the Open Model using the Reference Audio
  const handleGenerateSpeech = async () => {
    if (!testText.trim()) {
      setGenerationError('Vennligst oppgi en tekst for opplesning.');
      return;
    }

    if (!activeProfile && audioSamples.length === 0) {
      setGenerationError(
        'Du må opprette en stemmeprofil eller laste opp et prekenopptak som stemmereferanse først.'
      );
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const referenceId =
        activeProfile?.referenceFileIds[0] ||
        (audioSamples[0] ? audioSamples[0].name : undefined);

      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText.trim(),
          profile_id: activeProfile?.id,
          reference_id: referenceId,
          language: 'no',
          exaggeration: modelSettings.exaggeration,
          cfg_weight: modelSettings.cfg_weight,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setGenerationError(
          errJson.error ||
            `Modellen returnerte feil (${res.status}). Sjekk at åpen backend kjører (cd backend && ./run.sh).`
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setGeneratedAudioBlob(blob);
      setGeneratedAudioUrl(url);

      const temp = new Audio(url);
      temp.onloadedmetadata = () => {
        const dur = Math.round(temp.duration) || 0;
        setGeneratedDuration(dur);
        onSaveGeneratedAudio({
          title: `Prekentest: ${testText.slice(0, 30)}...`,
          text: testText,
          voiceName: activeProfile?.name || 'Prekenstemme',
          voiceId: activeProfile?.id || 'open-model-ref',
          audioBlob: blob,
          durationSeconds: dur,
        });
      };
    } catch {
      setGenerationError(
        'Kunne ikke kontakte åpen AI-backend. Start Python-tjenesten lokalt (cd backend && ./run.sh) eller oppgi GPU-serveradresse i innstillinger.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTogglePlayGenerated = () => {
    if (!generatedAudioRef.current || !generatedAudioUrl) return;

    if (isPlayingGenerated) {
      generatedAudioRef.current.pause();
      setIsPlayingGenerated(false);
    } else {
      generatedAudioRef.current.play();
      setIsPlayingGenerated(true);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hidden audio element for previewing uploaded samples */}
      <audio
        ref={sampleAudioRef}
        onEnded={() => setActivePlayingSampleId(null)}
        onError={() => setActivePlayingSampleId(null)}
        className="hidden"
      />

      {/* Hidden audio element for generated speech */}
      {generatedAudioUrl && (
        <audio
          ref={generatedAudioRef}
          src={generatedAudioUrl}
          onEnded={() => setIsPlayingGenerated(false)}
          onError={() => setIsPlayingGenerated(false)}
          className="hidden"
        />
      )}

      {/* Hero / Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>Åpen AI-modell</span>
              <span>·</span>
              <span>Resemble AI Chatterbox Multilingual</span>
              <span>·</span>
              <span>Norsk Bokmål</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Teststudio for åpen stemmekloning
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              Her tester vi om en fullstendig åpen AI-modell kan etterligne stemmen din fra dine egne MP3-opptak av prekener. Ingen kommersielle API-er, ingen lukkede skytjenester – alt kjøres i egen infrastruktur.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={onOpenBackendModal}
              className={`cursor-pointer px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 border ${
                backendStatus?.connected
                  ? 'bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100'
                  : 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>
                {backendStatus?.connected
                  ? `Backend: ${backendStatus.device.includes('cuda') ? 'GPU Aktiv' : 'CPU'}`
                  : 'AI-backend ikke tilkoblet'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Workflow Step Grid */}
      <div className="grid grid-cols-1 gap-6">

        {/* ================= STEG 1: LAST OPP OPPTAK ================= */}
        <section className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold font-mono">
                1
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Steg 1: Last opp opptak av dine prekener
                </h2>
                <p className="text-xs text-slate-500">
                  Last opp dine egne MP3-opptak. Filene lagres privat og brukes som referansemateriale for modellen.
                </p>
              </div>
            </div>

            {audioSamples.length > 0 && (
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Samlet opptakstid:</span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">
                  {formatDuration(totalAudioDuration)} ({audioSamples.length} {audioSamples.length === 1 ? 'fil' : 'filer'})
                </span>
              </div>
            )}
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-slate-400 transition-colors bg-slate-50/50">
            <input
              type="file"
              id="teststudio-file-upload"
              multiple
              accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/x-m4a"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="teststudio-file-upload"
              className="cursor-pointer flex flex-col items-center justify-center"
            >
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-slate-800">
                Klikk for å velge dine prekenopptak (MP3 / WAV)
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Opptakene lagres trygt på vår egen backend og overføres aldri til eksterne skytjenester.
              </span>
            </label>
          </div>

          {/* Uploaded File List */}
          {audioSamples.length > 0 && (
            <div className="mt-4 space-y-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Opplastede opptak for referanse ({audioSamples.length})
              </span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                {audioSamples.map((sample) => (
                  <div
                    key={sample.id}
                    className="flex items-center justify-between p-3 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleTogglePlaySample(sample)}
                        className={`cursor-pointer p-2 rounded-lg transition-colors ${
                          activePlayingSampleId === sample.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        title="Spill av originalopptak"
                      >
                        {activePlayingSampleId === sample.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>

                      <div className="truncate">
                        <p className="font-medium text-slate-900 truncate">{sample.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span className="tabular-nums">{formatDuration(sample.durationSeconds || 0)}</span>
                          <span>·</span>
                          <span>{formatFileSize(sample.size)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeSample(sample.id)}
                      className="cursor-pointer p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                      title="Fjern opptak"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ================= STEG 2: OPPRETT STEMMEPROFIL ================= */}
        <section className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold font-mono">
                2
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Steg 2: Opprett stemmeprofil
                </h2>
                <p className="text-xs text-slate-500">
                  Koble profilen til dine faktiske opptak. Chatterbox bruker referanseopptaket direkte under inferens (zero-shot).
                </p>
              </div>
            </div>

            {activeProfile && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Aktiv profil:</span>
                <span className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                  {activeProfile.name}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Profilnavn
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="f.eks. Magnar – prekenstemme"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dialekt / Målform
              </label>
              <input
                type="text"
                value={dialect}
                onChange={(e) => setDialect(e.target.value)}
                placeholder="f.eks. Østlandsk / Bokmål"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Consent */}
          <div className="mt-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasVoiceConsent}
                onChange={(e) => setHasVoiceConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                <strong>Verifisering og eierskap:</strong> Jeg bekrefter at jeg eier opptakene eller har nødvendig tillatelse til å opprette en digital kopi av stemmen.
              </span>
            </label>
          </div>

          {profileError && (
            <div className="mt-3 p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {profileSuccessMsg && (
            <div className="mt-3 p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleCreateProfile}
              disabled={isSavingProfile || audioSamples.length === 0}
              className="cursor-pointer px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingProfile ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Oppretter profil...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Koble opptak til stemmeprofil</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* ================= STEG 3: SKRIV NY NORSK TEKST ================= */}
        <section className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold font-mono">
                3
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Steg 3: Skriv ny norsk prekentekst
                </h2>
                <p className="text-xs text-slate-500">
                  Teksten som modellen skal lese opp med din stemme som referanse.
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 tabular-nums font-mono">
              {testText.length} tegn · {testText.split(/\s+/).filter(Boolean).length} ord
            </div>
          </div>

          <textarea
            rows={4}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed font-normal"
          />

          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Teksten sendes nøyaktig slik den er skrevet, uten omskriving eller forkorting.</span>
            <button
              type="button"
              onClick={() => setTestText(MANDATORY_TEST_TEXT)}
              className="cursor-pointer text-slate-700 hover:text-slate-900 underline font-medium"
            >
              Gjenopprett testtekst fra oppdraget
            </button>
          </div>
        </section>

        {/* ================= STEG 4: GENERER TALE MED ÅPEN MODELL ================= */}
        <section className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold font-mono">
                4
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Steg 4: Generer tale med åpen modell
                </h2>
                <p className="text-xs text-slate-500">
                  Modell: Resemble AI Chatterbox Multilingual. Bruker dine opptak som referanse (audio_prompt_path).
                </p>
              </div>
            </div>
          </div>

          {/* Genuine Chatterbox Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Emosjonelt uttrykk (Exaggeration)</span>
                <span className="font-mono tabular-nums">{Math.round(modelSettings.exaggeration * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={modelSettings.exaggeration}
                onChange={(e) =>
                  setModelSettings({ ...modelSettings, exaggeration: parseFloat(e.target.value) })
                }
                className="w-full accent-slate-900"
              />
              <span className="text-[11px] text-slate-400">
                Kontrollerer dynamikk og emosjonell intensitet i Chatterbox
              </span>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Talevekt og stabilitet (CFG Weight)</span>
                <span className="font-mono tabular-nums">{Math.round(modelSettings.cfg_weight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={modelSettings.cfg_weight}
                onChange={(e) =>
                  setModelSettings({ ...modelSettings, cfg_weight: parseFloat(e.target.value) })
                }
                className="w-full accent-slate-900"
              />
              <span className="text-[11px] text-slate-400">
                Pacing og veiledningsvekt for tydelig artikulasjon
              </span>
            </div>
          </div>

          {generationError && (
            <div className="mt-4 p-4 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Modellkjøring feilet:</span>
              </div>
              <p>{generationError}</p>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Språk: Norsk (no) · Referanse: {activeProfile?.name || 'Første opplastede opptak'}
            </span>

            <button
              onClick={handleGenerateSpeech}
              disabled={isGenerating || !testText.trim()}
              className="cursor-pointer px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Kjører åpen modell og genererer tale...</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Generer tale med min stemme</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* ================= STEG 5 & 6: LYTT OG LAST NED ================= */}
        <section
          className={`p-6 rounded-xl border transition-all ${
            generatedAudioUrl ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-50/50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-mono ${
                  generatedAudioUrl ? 'bg-emerald-700 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                5
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Steg 5 og 6: Lytt, sammenlign og last ned
                </h2>
                <p className="text-xs text-slate-500">
                  Sammenlign stemmelikheten mellom ditt originale prekenopptak og den nye talen fra den åpne modellen.
                </p>
              </div>
            </div>

            {generatedAudioUrl && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                Lyd mottatt fra åpen modell!
              </span>
            )}
          </div>

          {generatedAudioUrl ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTogglePlayGenerated}
                    className="cursor-pointer w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shrink-0 shadow-sm"
                  >
                    {isPlayingGenerated ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Ny generert prekentale (Chatterbox Multilingual)
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                      <span>{formatDuration(generatedDuration)}</span>
                      <span>·</span>
                      <span>Stemmereferanse: {activeProfile?.name || 'Prekenopptak'}</span>
                      <span>·</span>
                      <span>Format: MP3</span>
                    </div>
                  </div>
                </div>

                <a
                  href={generatedAudioUrl}
                  download="talelab-chatterbox-preken.mp3"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Last ned MP3</span>
                </a>
              </div>

              {/* Side-by-side A/B Comparison */}
              {audioSamples.length > 0 && (
                <div className="p-4 rounded-lg border border-slate-200 bg-white">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    A/B Vurdering av stemmelikhet: Original vs. Åpen modell
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="font-semibold text-slate-800 mb-1">A. Ditt originale prekenopptak:</div>
                      <p className="text-slate-500 text-[11px] truncate mb-2">{audioSamples[0].name}</p>
                      <button
                        onClick={() => handleTogglePlaySample(audioSamples[0])}
                        className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 font-medium text-slate-800"
                      >
                        {activePlayingSampleId === audioSamples[0].id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>Lytt til originalen</span>
                      </button>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200">
                      <div className="font-semibold text-emerald-950 mb-1">B. Tale generert av åpen AI-modell:</div>
                      <p className="text-slate-500 text-[11px] truncate mb-2">Lest opp fra den nye teksten</p>
                      <button
                        onClick={handleTogglePlayGenerated}
                        className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded hover:bg-emerald-800 font-medium"
                      >
                        {isPlayingGenerated ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>Lytt til den genererte talen</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              Generer tale i Steg 4 for å spille av resultatet og laste ned ferdig MP3-lydfil.
            </div>
          )}
        </section>

      </div>
    </div>
  );
};
