export interface OpenBackendStatus {
  connected: boolean;
  backendUrl: string;
  provider: string;
  model: string;
  license: string;
  device: string;
  modelLoaded: boolean;
  loadError: string | null;
  vram: string | null;
  supportedLanguages: string[];
  defaultLanguage: string;
  setupGuide?: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}

export interface ReferenceAudio {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  audioUrl: string;
  durationSeconds?: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  dialect: string;
  referenceFileIds: string[];
  referenceFileNames: string[];
  createdAt: string;
}

export interface AudioSampleFile {
  id: string;
  file: File;
  name: string;
  size: number;
  durationSeconds: number | null;
  objectUrl: string;
}

export interface OpenModelSettings {
  exaggeration: number; // 0.0 - 1.0 (Chatterbox emosjonsuttrykk / dynamikk)
  cfg_weight: number;    // 0.0 - 1.0 (Classifier-free guidance / klarhet)
  language: string;      // "no" (Norsk bokmål)
}

export interface SermonSegment {
  id: string;
  index: number;
  text: string;
  status: 'idle' | 'generating' | 'completed' | 'failed';
  audioBlob?: Blob;
  audioUrl?: string;
  durationSeconds?: number;
  errorMessage?: string;
}

export interface SermonProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  profileId: string;
  profileName: string;
  segments: SermonSegment[];
  fullAudioUrl?: string;
  fullDurationSeconds?: number;
}

export interface ProviderComparison {
  provider: string;
  model: string;
  license: string;
  openSource: boolean;
  norwegianSupport: string;
  voiceCloningType: string;
  minAudioTime: string;
  hardwareReq: string;
  status: string;
  pros: string[];
  cons: string[];
}
