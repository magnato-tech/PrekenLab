import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Play,
  Pause,
  Download,
  Trash2,
  Calendar,
  Volume2,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { VoiceProfile } from '../types.ts';
import { formatDuration, formatDurationDigital } from '../utils/audioUtils.ts';

export interface LibraryItem {
  id: string;
  title: string;
  textExcerpt: string;
  voiceName: string;
  voiceId: string;
  audioBlob: Blob;
  audioUrl: string;
  durationSeconds: number;
  createdAt: string;
}

interface LibraryProps {
  items: LibraryItem[];
  onDeleteItem: (id: string) => void;
  voiceProfiles: VoiceProfile[];
  onOpenSermon: (item: LibraryItem) => void;
}

export const Library: React.FC<LibraryProps> = ({
  items,
  onDeleteItem,
  voiceProfiles,
  onOpenSermon,
}) => {
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleTogglePlay = (item: LibraryItem) => {
    if (!audioRef.current) return;

    if (playingItemId === item.id) {
      audioRef.current.pause();
      setPlayingItemId(null);
    } else {
      audioRef.current.src = item.audioUrl;
      audioRef.current.play();
      setPlayingItemId(item.id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingItemId(null)}
        onError={() => setPlayingItemId(null)}
        className="hidden"
      />

      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Mitt bibliotek – Genererte prekenfiler og historikk
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          Her finner du alle tidligere genererte prekenopplesninger, testfiler og prosjekter. Du kan lytte, laste ned MP3-filer på nytt, eller slette opptak.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Biblioteket er foreløpig tomt</h2>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Når du genererer tale i Teststudio eller Prekenstudio, lagres de ferdige lydfilene automatisk her slik at du kan lytte og laste ned når som helst.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <span>Lagrede opplesninger ({items.length})</span>
            <span>Tabular arkiv</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {items.map((item) => {
              const isPlaying = playingItemId === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <button
                      onClick={() => handleTogglePlay(item)}
                      className={`cursor-pointer w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isPlaying
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 italic">
                        «{item.textExcerpt}»
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Volume2 className="w-3 h-3 text-slate-500" />
                          <span className="font-medium text-slate-700">{item.voiceName}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono tabular-nums">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(item.durationSeconds)}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono tabular-nums">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(item.createdAt).toLocaleDateString('no-NO')}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <a
                      href={item.audioUrl}
                      download={`${item.title.toLowerCase().replace(/[^a-z0-9æøå]/g, '-')}.mp3`}
                      className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Last ned MP3</span>
                    </a>

                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="cursor-pointer p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Slett fra bibliotek"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
