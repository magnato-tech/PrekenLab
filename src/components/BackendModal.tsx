import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Server,
  Cpu,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import { OpenBackendStatus } from '../types.ts';

interface BackendModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendStatus: OpenBackendStatus | null;
  onRefreshStatus: () => void;
}

export const BackendModal: React.FC<BackendModalProps> = ({
  isOpen,
  onClose,
  backendStatus,
  onRefreshStatus,
}) => {
  const [backendUrlInput, setBackendUrlInput] = useState(
    backendStatus?.backendUrl || 'http://localhost:8000'
  );
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendUrlInput.trim()) return;

    setIsTesting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/open-backend/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backendUrl: backendUrlInput.trim() }),
      });

      const data = await res.json();
      if (data.connected) {
        setFeedback({
          type: 'success',
          message: data.message || 'Vellykket tilkobling til åpen AI-backend!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'Kunne ikke oppnå kontakt med backend på denne adressen.',
        });
      }
      onRefreshStatus();
    } catch {
      setFeedback({
        type: 'error',
        message: 'Nettverksfeil under testing av tilkobling.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-slate-800" />
            <h2 className="text-lg font-bold text-slate-900">Åpen AI-backend & Maskinvare</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Box */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tilkoblingsstatus</span>
            <span className="font-mono tabular-nums">{backendStatus?.backendUrl || 'http://localhost:8000'}</span>
          </div>

          <div className="flex items-center gap-2">
            {backendStatus?.connected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-semibold text-slate-900">
                  Tilkoblet åpen modell: {backendStatus.model}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-900">
                  Ingen svar fra backend på {backendStatus?.backendUrl || 'http://localhost:8000'}
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-600 border-t border-slate-200">
            <div>
              <span className="text-slate-400 block">Maskinvare:</span>
              <span className="font-medium text-slate-800">{backendStatus?.device || 'Ukjent'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Modell-lisens:</span>
              <span className="font-medium text-slate-800">{backendStatus?.license || 'MIT (Åpen kildekode)'}</span>
            </div>
          </div>
        </div>

        {/* Form to point to custom backend URL */}
        <form onSubmit={handleTestConnection} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Backend Server-adresse (FastAPI)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="http://localhost:8000 eller https://gpu-server.example.com"
                value={backendUrlInput}
                onChange={(e) => setBackendUrlInput(e.target.value)}
                className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
              <button
                type="submit"
                disabled={isTesting}
                className="cursor-pointer px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Test tilkobling</span>
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Kjør modellen lokalt på din egen PC med GPU, eller pek til en GPU-sky (f.eks. RunPod / Vast.ai / GCP).
            </p>
          </div>

          {feedback && (
            <div
              className={`p-3 text-xs rounded-lg border ${
                feedback.type === 'success'
                  ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                  : 'text-rose-800 bg-rose-50 border-rose-200'
              }`}
            >
              {feedback.message}
            </div>
          )}
        </form>

        {/* Setup guide */}
        <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Terminal className="w-4 h-4 text-slate-700" />
            <span>Slik starter du den åpne Chatterbox-backenden:</span>
          </div>

          <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] space-y-1">
            <p className="text-slate-400"># 1. Naviger til backend-mappen:</p>
            <p className="text-emerald-400">cd backend</p>
            <p className="text-slate-400 mt-2"># 2. Start med oppsettskriptet:</p>
            <p className="text-emerald-400">./run.sh</p>
            <p className="text-slate-400 mt-2"># Eller kjør med Docker på en GPU-server:</p>
            <p className="text-emerald-400">docker compose up --build</p>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500">
              Ingen kommersielle API-nøkler er påkrevd. Alle MP3-prekenopptak og talegenereringer behandles 100% lokalt i din egen infrastruktur under MIT-lisens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
