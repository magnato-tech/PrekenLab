import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Play,
  Pause,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Globe,
  Radio,
  FileAudio,
  FolderOpen,
} from 'lucide-react';
import { AudioSampleFile, OpenBackendStatus, VoiceProfile } from '../types.ts';
import { formatDuration, formatFileSize, getAudioDuration } from '../utils/audioUtils.ts';

interface VoiceLabProps {
  backendStatus: OpenBackendStatus | null;
  onOpenBackendModal: () => void;
  voiceProfiles: VoiceProfile[];
  onProfileCreated: (profile: VoiceProfile) => void;
  onProfileDeleted: (profileId: string) => void;
  activeProfileId: string | null;
  setActiveProfileId: (id: string) => void;
}

export const VoiceLab: React.FC<VoiceLabProps> = ({
  backendStatus,
  onOpenBackendModal,
  voiceProfiles,
  onProfileCreated,
  onProfileDeleted,
  activeProfileId,
  setActiveProfileId,
}) => {
  // Form fields
  const [name, setName] = useState('Magnar – prekenstemme');
  const [dialect, setDialect] = useState('Østlandsk (Bokmål)');
  const [description, setDescription] = useState('Autentisk prekenstemme fra egne prekenopptak');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  // Files
  const [samples, setSamples] = useState<AudioSampleFile[]>([]);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalDuration = samples.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

  const handleFilesAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage(null);
    const newFiles: AudioSampleFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (!['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext || '')) {
        setErrorMessage(
          `Filen «${file.name}» støttes ikke. Vennligst last opp MP3, WAV eller M4A.`
        );
        continue;
      }

      const duration = await getAudioDuration(file);
      newFiles.push({
        id: `sample-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        durationSeconds: duration,
        objectUrl: URL.createObjectURL(file),
      });
    }

    setSamples((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleRemoveSample = (id: string) => {
    setSamples((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleTogglePlay = (sample: AudioSampleFile) => {
    if (!audioPreviewRef.current) return;

    if (playingSampleId === sample.id) {
      audioPreviewRef.current.pause();
      setPlayingSampleId(null);
    } else {
      audioPreviewRef.current.src = sample.objectUrl;
      audioPreviewRef.current.play();
      setPlayingSampleId(sample.id);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (samples.length === 0) {
      setErrorMessage('Du må laste opp minst én MP3- eller WAV-fil med prekenopptak.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Vennligst oppgi et navn på stemmeprofilen.');
      return;
    }

    if (!consentConfirmed) {
      setErrorMessage('Du må bekrefte at opptakene tilhører deg eller at du har tillatelse.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage('Laster opp og registrerer prekenopptak på serveren...');

    try {
      // 1. Upload audio files to server storage
      const formData = new FormData();
      for (const s of samples) {
        formData.append('files', s.file, s.name);
      }

      const uploadRes = await fetch('/api/references', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const d = await uploadRes.json().catch(() => ({}));
        throw new Error(d.error || 'Kunne ikke laste opp lydfilene til serveren.');
      }

      const uploadData = await uploadRes.json();
      const referenceIds = uploadData.references?.map((r: { id: string }) => r.id) || [];

      // 2. Create voice profile
      const profileRes = await fetch('/api/voice-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          dialect: dialect.trim(),
          referenceFileIds: referenceIds,
        }),
      });

      const profileData = await profileRes.json();
      if (!profileRes.ok) {
        throw new Error(profileData.error || 'Kunne ikke opprette stemmeprofil.');
      }

      onProfileCreated(profileData.profile);
      setActiveProfileId(profileData.profile.id);
      setStatusMessage(
        `Stemmeprofilen «${profileData.profile.name}» ble opprettet og koblet til ${profileData.profile.referenceFileNames.length} opptak!`
      );
      setSamples([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nettverksfeil';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async (profileId: string, profileName: string) => {
    if (!confirm(`Er du sikker på at du vil slette stemmeprofilen «${profileName}»?`)) return;

    try {
      const res = await fetch(`/api/voice-profiles/${profileId}`, { method: 'DELETE' });
      if (res.ok) {
        onProfileDeleted(profileId);
      }
    } catch {
      alert('Kunne ikke slette profil.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Hidden audio element */}
      <audio
        ref={audioPreviewRef}
        onEnded={() => setPlayingSampleId(null)}
        onError={() => setPlayingSampleId(null)}
        className="hidden"
      />

      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Stemmelab – Forvaltning av egne stemmeprofiler
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          Opprett og organiser dine egne stemmeprofiler basert på dine MP3-prekener. Modellen bruker disse opptakene som referanse under generering uten at data forlater din egen maskin.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Creator Form */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleCreateProfile} className="bg-white p-6 rounded-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Opprett ny stemmeprofil
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono">
                Åpen AI / Lokal
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stemmeprofilens navn
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="f.eks. Magnar – prekenstemme"
                  required
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
                  placeholder="f.eks. Østlandsk, Bergensk"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Beskrivelse av talestil
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="f.eks. Rolig prekentempo med ettertanke og tydelig diksjon"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* File Upload Zone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Prekenopptak (MP3 / WAV / M4A)
                </label>
                {samples.length > 0 && (
                  <span className="text-xs font-mono font-medium text-slate-600">
                    Samlet tid: {formatDuration(totalDuration)}
                  </span>
                )}
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-slate-400 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="voicelab-sample-upload"
                  multiple
                  accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/x-m4a"
                  onChange={handleFilesAdded}
                  className="hidden"
                />
                <label htmlFor="voicelab-sample-upload" className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-7 h-7 text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-800">
                    Velg én eller flere prekenfiler
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Filene lagres sikkert i lokalt bibliotek på din egen maskin
                  </span>
                </label>
              </div>

              {samples.length > 0 && (
                <div className="mt-3 divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white max-h-56 overflow-y-auto">
                  {samples.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-2 truncate">
                        <button
                          type="button"
                          onClick={() => handleTogglePlay(s)}
                          className="cursor-pointer p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          {playingSampleId === s.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <span className="font-medium text-slate-900 truncate">{s.name}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-mono tabular-nums">{formatDuration(s.durationSeconds || 0)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSample(s.id)}
                        className="cursor-pointer text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Consent */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>
                  Jeg bekrefter at jeg eier opptakene eller har eksplisitt tillatelse til å opprette en digital profil av stemmen.
                </span>
              </label>
            </div>

            {errorMessage && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || samples.length === 0}
                className="cursor-pointer px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Lagrer stemmeprofil...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Opprett stemmeprofil ({samples.length} opptak)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Existing Voice Profiles */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Mine stemmeprofiler ({voiceProfiles.length})
              </h2>
              <span className="text-xs text-slate-500 font-mono">Egen backend</span>
            </div>

            {voiceProfiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <Radio className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-700">Ingen profiler opprettet ennå</p>
                <p className="mt-1">Last opp dine prekenopptak til venstre for å opprette din første profil.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {voiceProfiles.map((p) => {
                  const isActive = activeProfileId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? 'border-slate-900 bg-slate-50/70 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                              Aktiv
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {p.description || 'Ingen beskrivelse.'}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-2">
                            <span>Dialekt: {p.dialect}</span>
                            <span>·</span>
                            <span>{p.referenceFileNames.length} opptak</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setActiveProfileId(p.id)}
                            className={`cursor-pointer px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                              isActive
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isActive ? 'Valgt' : 'Velg'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteProfile(p.id, p.name)}
                            className="cursor-pointer p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Slett denne stemmeprofilen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
