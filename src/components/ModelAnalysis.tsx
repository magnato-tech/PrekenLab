import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpen,
  Award,
  Terminal,
  ShieldCheck,
  Cpu,
  Layers,
  ExternalLink,
} from 'lucide-react';

export const ModelAnalysis: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          <span>Offisiell utredning · Åpne stemmemodeller for norsk</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Teknologirapport: Resemble AI Chatterbox & Åpne modeller
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          Undersøkelse av den offisielle Chatterbox Multilingual-implementasjonen fra Resemble AI, lisensvilkår, maskinvarekrav, Python API og støtte for norsk prekentale.
        </p>
      </div>

      {/* Main Verdict Card */}
      <div className="p-6 rounded-xl bg-slate-900 text-white space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-400">
          <Award className="w-4 h-4" />
          <span>Hovedkonklusjon: Resemble AI Chatterbox Multilingual</span>
        </div>
        <h2 className="text-lg font-bold">
          resemble-ai/chatterbox – Valgt og implementert som åpen talemotor
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
          Chatterbox Multilingual oppfyller alle kravene i oppdraget: Den er utgitt under en åpen <strong>MIT-lisens</strong>, kan kjøres 100% på egen maskinvare uten eksterne API-nøkler, støtter norsk bokmål (språkkode: <code>no</code>), og utfører zero-shot stemmekloning direkte fra et opplastet MP3/WAV-prekenopptak via parameteren <code>audio_prompt_path</code>.
        </p>
        <div className="pt-2 flex items-center gap-4 text-xs font-mono text-emerald-300">
          <span>GitHub: resemble-ai/chatterbox</span>
          <span>·</span>
          <span>Lisens: MIT</span>
          <span>·</span>
          <span>Norsk støtte: Ja (no)</span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">
            Sammenligning av åpne modeller for norsk stemmekloning
          </h2>
          <span className="text-xs text-slate-500 font-mono">MIT / Open Source</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <th className="p-3 font-semibold">Modell & Arkitektur</th>
                <th className="p-3 font-semibold">Lisens</th>
                <th className="p-3 font-semibold">Støtte for norsk</th>
                <th className="p-3 font-semibold">Stemmekloning (Zero-shot)</th>
                <th className="p-3 font-semibold">Maskinvare & VRAM</th>
                <th className="p-3 font-semibold">Status i TaleLab</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {/* Chatterbox Multilingual */}
              <tr className="bg-emerald-50/40">
                <td className="p-3 font-semibold text-slate-900">
                  Resemble AI Chatterbox Multilingual
                  <span className="block text-[11px] font-normal text-slate-500 font-mono">
                    Diffusion decoder + Transformer
                  </span>
                </td>
                <td className="p-3">
                  <span className="font-semibold text-emerald-800">MIT Lisens</span>
                  <span className="block text-[11px] text-slate-500">Full frihet til kommersiell og privat bruk</span>
                </td>
                <td className="p-3">
                  <span className="font-semibold text-emerald-800">Ja (språkkode: "no")</span>
                  <span className="block text-[11px] text-slate-500">Mestrer norske vokaler og bokstaver</span>
                </td>
                <td className="p-3">
                  <span className="font-medium text-slate-900">Ja (audio_prompt_path)</span>
                  <span className="block text-[11px] text-slate-500">Bruker 5–15 sek referanse fra preken</span>
                </td>
                <td className="p-3 font-mono text-[11px]">
                  <span>6–12 GB VRAM (GPU)</span>
                  <span className="block text-slate-500">Støtter også CPU-inferens</span>
                </td>
                <td className="p-3 font-semibold text-emerald-800">
                  Aktiv motor (FastAPI backend)
                </td>
              </tr>

              {/* Coqui XTTS-v2 */}
              <tr>
                <td className="p-3 font-semibold text-slate-900">
                  Coqui XTTS-v2
                  <span className="block text-[11px] font-normal text-slate-500 font-mono">
                    Autoregressiv + HiFi-GAN
                  </span>
                </td>
                <td className="p-3">
                  <span>Coqui Public Model License</span>
                  <span className="block text-[11px] text-slate-500">Mer restriktiv enn MIT</span>
                </td>
                <td className="p-3">
                  <span>Ja (norsk blant 17 språk)</span>
                  <span className="block text-[11px] text-slate-500">Kan ha svakt aksentpreg</span>
                </td>
                <td className="p-3">
                  <span>Ja (speaker_wav)</span>
                  <span className="block text-[11px] text-slate-500">Krever ren audio</span>
                </td>
                <td className="p-3 font-mono text-[11px]">
                  <span>8–16 GB VRAM</span>
                  <span className="block text-slate-500">Tung modell</span>
                </td>
                <td className="p-3 text-slate-600">
                  Alternativ kandidat
                </td>
              </tr>

              {/* F5-TTS */}
              <tr>
                <td className="p-3 font-semibold text-slate-900">
                  F5-TTS
                  <span className="block text-[11px] font-normal text-slate-500 font-mono">
                    Non-autoregressive Flow Matching
                  </span>
                </td>
                <td className="p-3">
                  <span>MIT Lisens</span>
                </td>
                <td className="p-3 text-rose-700">
                  <span>Svak / Ufullstendig</span>
                  <span className="block text-[11px] text-slate-500">Primært engelsk og mandarin</span>
                </td>
                <td className="p-3">
                  <span>Ja (reference audio)</span>
                </td>
                <td className="p-3 font-mono text-[11px]">
                  <span>8–12 GB VRAM</span>
                </td>
                <td className="p-3 text-rose-700 font-medium">
                  Uaktuell for norsk
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Code and API Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Terminal className="w-4 h-4 text-slate-700" />
            <span>Faktisk Python API i Chatterbox Multilingual</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            I henhold til den offisielle pakken <code>chatterbox-tts</code> fra Resemble AI brukes følgende metode for å klone stemmen fra et referanseopptak:
          </p>
          <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed">
            <span className="text-slate-400"># 1. Last modellen på GPU eller CPU</span><br />
            <span className="text-emerald-400">from</span> chatterbox.tts <span className="text-emerald-400">import</span> ChatterboxMultilingualTTS<br />
            model = ChatterboxMultilingualTTS.from_pretrained(device=<span className="text-amber-300">"cuda"</span>)<br /><br />
            <span className="text-slate-400"># 2. Generer ny norsk tale med referanse</span><br />
            wav = model.generate(<br />
            &nbsp;&nbsp;text=<span className="text-amber-300">"Kjære forsamling. Nåde være med dere..."</span>,<br />
            &nbsp;&nbsp;audio_prompt_path=<span className="text-amber-300">"references/magnar_preken.wav"</span>,<br />
            &nbsp;&nbsp;exaggeration=<span className="text-cyan-300">0.5</span>,<br />
            &nbsp;&nbsp;cfg=<span className="text-cyan-300">0.5</span><br />
            )<br />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Cpu className="w-4 h-4 text-slate-700" />
            <span>Maskinvare og drift på egen infrastruktur</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Slik kjører du den åpne backenden i et produksjons- eller testmiljø:
          </p>
          <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
            <li>
              <strong>Lokal GPU:</strong> En PC med NVIDIA RTX 3060 (12GB), RTX 3090 (24GB) eller RTX 4090 gir optimal ytelse med genereringstid under 2 sekunder.
            </li>
            <li>
              <strong>GPU-sky:</strong> En rimelig GPU-server på RunPod, Vast.ai eller Google Cloud (med f.eks. NVIDIA L4 eller T4 til ~$0.20–$0.40/time).
            </li>
            <li>
              <strong>CPU-modus:</strong> Modellen kan kjøres på CPU for validering, men generering av et helt prekenavsnitt vil ta 15–40 sekunder avhengig av prosessor.
            </li>
            <li>
              <strong>Full kontroll:</strong> Alle prekenopptak forblir på din egen server. Ingen kommersielle aktører har tilgang til stemmedataene dine.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
