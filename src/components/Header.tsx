import React from 'react';
import { Cpu, Server, CheckCircle2, AlertTriangle } from 'lucide-react';
import { OpenBackendStatus } from '../types.ts';

interface HeaderProps {
  activeTab: 'test' | 'voicelab' | 'sermon' | 'library' | 'analysis';
  setActiveTab: (tab: 'test' | 'voicelab' | 'sermon' | 'library' | 'analysis') => void;
  backendStatus: OpenBackendStatus | null;
  onOpenBackendModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  backendStatus,
  onOpenBackendModal,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setActiveTab('test')}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap hover:text-slate-700 transition-colors cursor-pointer text-left"
        >
          TaleLab
        </button>
        <span className="hidden sm:inline text-xs text-slate-400 font-normal">
          · Åpen norsk AI-stemmelab
        </span>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
        <button
          onClick={() => setActiveTab('test')}
          className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
            activeTab === 'test'
              ? 'text-slate-900 border-slate-900 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Teststudio
        </button>
        <button
          onClick={() => setActiveTab('voicelab')}
          className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
            activeTab === 'voicelab'
              ? 'text-slate-900 border-slate-900 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Stemmelab
        </button>
        <button
          onClick={() => setActiveTab('sermon')}
          className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
            activeTab === 'sermon'
              ? 'text-slate-900 border-slate-900 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Prekenstudio
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
            activeTab === 'library'
              ? 'text-slate-900 border-slate-900 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Bibliotek
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
            activeTab === 'analysis'
              ? 'text-slate-900 border-slate-900 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Modellanalyse
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenBackendModal}
          className={`cursor-pointer flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 border ${
            backendStatus?.connected
              ? 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              : 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>
            {backendStatus?.connected
              ? `AI-backend: Tilkoblet (${backendStatus.device.includes('cuda') ? 'GPU' : 'CPU'})`
              : 'Koble til AI-backend'}
          </span>
        </button>
      </div>
    </header>
  );
};
