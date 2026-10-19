import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Upload,
  Server,
} from 'lucide-react';
import { OpenBackendStatus, SermonSegment, VoiceProfile } from '../types.ts';
import {
  concatenateAudioBlobs,
  formatDuration,
  segmentSermonText,
} from '../utils/audioUtils.ts';

interface SermonStudioProps {
  backendStatus: OpenBackendStatus | null;
  onOpenBackendModal: () => void;
  voiceProfiles: VoiceProfile[];
  activeProfileId: string | null;
  onSaveToLibrary: (record: {
    title: string;
    text: string;
    voiceName: string;
    voiceId: string;
    audioBlob: Blob;
    durationSeconds: number;
  }) => void;
}

const DEFAULT_SAMPLE_SERMON = `Kjære forsamling, nåde være med dere og fred fra Gud, vår Far, og Herren Jesus Kristus.

I dag skal vi åpne Skriftene og se på et tema som angår oss alle i det daglige livet: Håpet som bærer når livet ikke blir slik vi hadde tenkt. For det er lett å synge lovsanger når solen skinner og kreftene strekker til. Men troens virkelige prøvestein finner vi i motbakkene, i stillheten, og i de dagene der vi kjenner på vår egen utilstrekkelighet.

Profeten Jesaja minner oss om dette med ordene: «De som venter på Herren, får ny kraft, de løfter vingene som ørnen, de løper og blir ikke slitne, de går og blir ikke trette.» Å vente på Herren er ikke passivitet; det er en aktiv forventning om at Guds trofasthet rekker lenger enn våre bekymringer.

La oss ta dette med oss ut i uken som kommer. Vær en oppmuntrer for dem du møter på din vei. Gi et godt ord, del et måltid, og husk at Kristi fred er gitt oss for å deles. Ære være Faderen og Sønnen og Den Hellige Ånd, slik det var i begynnelsen, så nå og alltid og i all evighet. Amen.`;

export const SermonStudio: React.FC<SermonStudioProps> = ({
  backendStatus,
  onOpenBackendModal,
  voiceProfiles,
  activeProfileId,
  onSaveToLibrary,
}) => {
  const [sermonTitle, setSermonTitle] = useState('Håpet som bærer i motgang');
  const [sermonText, setSermonText] = useState(DEFAULT_SAMPLE_SERMON);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    activeProfileId || voiceProfiles[0]?.id || ''
  );

  useEffect(() => {
    if (activeProfileId) {
      setSelectedProfileId(activeProfileId);
    } else if (voiceProfiles[0]) {
      setSelectedProfileId(voiceProfiles[0].id);
    }
  }, [activeProfileId, voiceProfiles]);

  // Model parameters (Chatterbox)
  const [exaggeration, setExaggeration] = useState(0.50);
  const [cfgWeight, setCfgWeight] = useState(0.50);

  // Segments
  const [segments, setSegments] = useState<SermonSegment[]>(() => {
    const rawSegments = segmentSermonText(DEFAULT_SAMPLE_SERMON);
    return rawSegments.map((text, idx) => ({
      id: `seg-${idx + 1}`,
      index: idx + 1,
      text,
      status: 'idle',
    }));
  });

  // Batch generation state
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Combined full audio state
  const [fullAudioBlob, setFullAudioBlob] = useState<Blob | null>(null);
  const [fullAudioUrl, setFullAudioUrl] = useState<string | null>(null);
  const [fullAudioDuration, setFullAudioDuration] = useState<number>(0);
  const [isPlayingFull, setIsPlayingFull] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const fullAudioRef = useRef<HTMLAudioElement | null>(null);

  // Single segment playback
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const segmentAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePerformSegmentation = () => {
    const chunks = segmentSermonText(sermonText);
    const newSegments: SermonSegment[] = chunks.map((text, idx) => ({
      id: `seg-${Date.now()}-${idx + 1}`,
      index: idx + 1,
      text,
      status: 'idle',
    }));
    setSegments(newSegments);
    setFullAudioBlob(null);
    setFullAudioUrl(null);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setSermonText(content);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setSermonTitle(nameWithoutExt);

        const chunks = segmentSermonText(content);
        setSegments(
          chunks.map((text, idx) => ({
            id: `seg-${Date.now()}-${idx + 1}`,
            index: idx + 1,
            text,
            status: 'idle',
          }))
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Generate audio for a single segment with the open model
  const generateSingleSegment = async (segmentId: string) => {
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg || !seg.text.trim()) return;

    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, status: 'generating', errorMessage: undefined } : s))
    );

    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: seg.text.trim(),
          profile_id: selectedProfileId,
          language: 'no',
          exaggeration,
          cfg_weight: cfgWeight,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Feil (${res.status}) under generering.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const tempAudio = new Audio(url);
      tempAudio.onloadedmetadata = () => {
        const dur = Math.round(tempAudio.duration) || 0;
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? {
                  ...s,
                  status: 'completed',
                  audioBlob: blob,
                  audioUrl: url,
                  durationSeconds: dur,
                }
              : s
          )
        );
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ukjent feil';
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, status: 'failed', errorMessage: msg } : s))
      );
    }
  };

  // Generate all segments
  const handleGenerateAllSegments = async () => {
    if (segments.length === 0) return;

    setIsBatchGenerating(true);
    setBatchProgress({ current: 0, total: segments.length });

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.status === 'completed' && seg.audioBlob) {
        setBatchProgress({ current: i + 1, total: segments.length });
        continue;
      }

      setBatchProgress({ current: i + 1, total: segments.length });
      await generateSingleSegment(seg.id);
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsBatchGenerating(false);
    setBatchProgress(null);
  };

  // Merge segments into one continuous sermon audio
  const handleMergeAllSegments = async () => {
    const completedBlobs = segments
      .filter((s) => s.status === 'completed' && s.audioBlob)
      .map((s) => s.audioBlob as Blob);

    if (completedBlobs.length === 0) {
      alert('Ingen ferdige segmenter å slå sammen. Generer minst ett avsnitt først.');
      return;
    }

    try {
      const combinedBlob = await concatenateAudioBlobs(completedBlobs, 0.7);
      const url = URL.createObjectURL(combinedBlob);
      setFullAudioBlob(combinedBlob);
      setFullAudioUrl(url);

      const temp = new Audio(url);
      temp.onloadedmetadata = () => {
        const dur = Math.round(temp.duration) || 0;
        setFullAudioDuration(dur);
        const profile = voiceProfiles.find((p) => p.id === selectedProfileId);

        onSaveToLibrary({
          title: sermonTitle,
          text: sermonText,
          voiceName: profile?.name || 'Prekenstemme',
          voiceId: selectedProfileId,
          audioBlob: combinedBlob,
          durationSeconds: dur,
        });
      };
    } catch (e) {
      console.error(e);
      alert('Kunne ikke slå sammen lydsegmentene.');
    }
  };

  const handleTogglePlaySegment = (seg: SermonSegment) => {
    if (!segmentAudioRef.current || !seg.audioUrl) return;

    if (playingSegmentId === seg.id) {
      segmentAudioRef.current.pause();
      setPlayingSegmentId(null);
    } else {
      segmentAudioRef.current.src = seg.audioUrl;
      segmentAudioRef.current.play();
      setPlayingSegmentId(seg.id);
    }
  };

  const handleTogglePlayFull = () => {
    if (!fullAudioRef.current || !fullAudioUrl) return;

    if (isPlayingFull) {
      fullAudioRef.current.pause();
      setIsPlayingFull(false);
    } else {
      fullAudioRef.current.playbackRate = playbackRate;
      fullAudioRef.current.play();
      setIsPlayingFull(true);
    }
  };

  const completedCount = segments.filter((s) => s.status === 'completed').length;
  const currentProfile = voiceProfiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="space-y-8">
      {/* Hidden audio element for preview */}
      <audio
        ref={segmentAudioRef}
        onEnded={() => setPlayingSegmentId(null)}
        onError={() => setPlayingSegmentId(null)}
        className="hidden"
      />

      {/* Hidden audio element for full sermon */}
      {fullAudioUrl && (
        <audio
          ref={fullAudioRef}
          src={fullAudioUrl}
          onEnded={() => setIsPlayingFull(false)}
          onError={() => setIsPlayingFull(false)}
          className="hidden"
        />
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>Prekenstudio</span>
              <span>·</span>
              <span>Åpen modell (Chatterbox)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Prekenredaktør og lydstudio
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-3xl">
              Skriv eller importer hele prekenen din. Teksten deles automatisk inn i avsnitt og leses opp med din stemmeprofil. Enkeltavsnitt kan regenereres uten å miste resten.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200">
              <Upload className="w-3.5 h-3.5" />
              <span>Importer tekstfil (TXT)</span>
              <input type="file" accept=".txt" onChange={handleFileImport} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Sermon Editor */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              Prekens manus og profil
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tittel på prekenen
              </label>
              <input
                type="text"
                value={sermonTitle}
                onChange={(e) => setSermonTitle(e.target.value)}
                placeholder="f.eks. Søndagspreken: Håpets lys"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Profile Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Velg stemmeprofil (Referanseopptak)
              </label>
              {voiceProfiles.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  Ingen stemmeprofil er opprettet ennå. Gå til <strong>Stemmelab</strong> for å opprette «Magnar – prekenstemme».
                </div>
              ) : (
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {voiceProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.referenceFileNames.length} opptak, {p.dialect})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Sermon Text Area */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Prekentekst (bevares uendret)
                </label>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {sermonText.length} tegn · {sermonText.split(/\s+/).filter(Boolean).length} ord
                </span>
              </div>
              <textarea
                rows={12}
                value={sermonText}
                onChange={(e) => setSermonText(e.target.value)}
                placeholder="Lim inn prekenen her..."
                className="w-full p-3.5 text-xs font-normal leading-relaxed bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Re-segment Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Segmentert i {segments.length} avsnitt
              </span>
              <button
                type="button"
                onClick={handlePerformSegmentation}
                className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Oppdater avsnitt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Segments & Audio Studio */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Lydstudio for preken
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fremdrift: {completedCount} av {segments.length} avsnitt generert ({Math.round((completedCount / (segments.length || 1)) * 100)}%)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateAllSegments}
                  disabled={isBatchGenerating || segments.length === 0}
                  className="cursor-pointer px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isBatchGenerating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Genererer avsnitt {batchProgress?.current} av {batchProgress?.total}...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generer alle avsnitt</span>
                    </>
                  )}
                </button>

                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMergeAllSegments}
                    className="cursor-pointer px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    Slå sammen til full preken
                  </button>
                )}
              </div>
            </div>

            {/* Combined Audio Player */}
            {fullAudioUrl && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTogglePlayFull}
                    className="cursor-pointer w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shadow-sm shrink-0"
                  >
                    {isPlayingFull ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      Full preken: {sermonTitle}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                      <span className="tabular-nums">Total lengde: {formatDuration(fullAudioDuration)}</span>
                      <span>·</span>
                      <span>Stemmeprofil: {currentProfile?.name || 'Egen profil'}</span>
                    </div>
                  </div>
                </div>

                <a
                  href={fullAudioUrl}
                  download={`${sermonTitle.toLowerCase().replace(/\s+/g, '-')}-full-preken.wav`}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Last ned preken</span>
                </a>
              </div>
            )}
          </div>

          {/* Segment Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <span>Avsnittsliste ({segments.length} deler)</span>
              <span>Uavhengig regenerering per avsnitt</span>
            </div>

            <div className="space-y-3">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className={`p-4 rounded-xl border transition-all ${
                    seg.status === 'completed'
                      ? 'bg-white border-slate-200'
                      : seg.status === 'generating'
                      ? 'bg-slate-50 border-slate-400'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        Avsnitt {seg.index}
                      </span>
                      {seg.status === 'completed' && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ferdig ({formatDuration(seg.durationSeconds || 0)})</span>
                        </span>
                      )}
                      {seg.status === 'generating' && (
                        <span className="text-[11px] text-slate-600 animate-pulse font-medium">
                          Genererer tale med åpen modell...
                        </span>
                      )}
                      {seg.status === 'failed' && (
                        <span className="text-[11px] text-rose-600 font-medium">
                          Feilet: {seg.errorMessage || 'Prøv igjen'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {seg.audioUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleTogglePlaySegment(seg)}
                            className="cursor-pointer p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                            title="Spill av avsnitt"
                          >
                            {playingSegmentId === seg.id ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={seg.audioUrl}
                            download={`preken-del-${seg.index}.mp3`}
                            className="cursor-pointer p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                            title="Last ned avsnitt"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => generateSingleSegment(seg.id)}
                        disabled={seg.status === 'generating'}
                        className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        title="Generer dette avsnittet på nytt"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{seg.status === 'completed' ? 'Ny opplesning' : 'Generer'}</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={seg.text}
                    onChange={(e) => {
                      const updated = e.target.value;
                      setSegments((prev) =>
                        prev.map((s) => (s.id === seg.id ? { ...s, text: updated } : s))
                      );
                    }}
                    className="w-full p-2.5 text-xs text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 leading-relaxed font-normal transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
