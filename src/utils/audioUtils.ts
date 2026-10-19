/**
 * Audio and text utilities for TaleLab
 */

export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;

    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      URL.revokeObjectURL(objectUrl);
      resolve(isFinite(dur) ? Math.round(dur) : 0);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
    };
  });
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 sek';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins === 0) {
    return `${secs} sek`;
  }
  return `${mins} min ${secs.toString().padStart(2, '0')} sek`;
}

export function formatDurationDigital(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Splits sermon text into natural theological and grammatical paragraphs.
 * Respects ElevenLabs optimal batch size (~1500 chars).
 */
export function segmentSermonText(text: string, maxCharsPerSegment = 1200): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  // First split by explicit double line breaks (paragraphs)
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const segments: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxCharsPerSegment) {
      segments.push(para);
    } else {
      // Split large paragraph by sentences
      const sentences = para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [para];
      let currentChunk = '';

      for (const sentence of sentences) {
        if ((currentChunk + ' ' + sentence).trim().length <= maxCharsPerSegment) {
          currentChunk = (currentChunk + ' ' + sentence).trim();
        } else {
          if (currentChunk) segments.push(currentChunk);
          currentChunk = sentence.trim();
        }
      }
      if (currentChunk) {
        segments.push(currentChunk);
      }
    }
  }

  return segments;
}

/**
 * Concatenates multiple audio blobs into a single WAV Blob using Web Audio API
 * Adds a subtle 0.5s pause between sermon segments.
 */
export async function concatenateAudioBlobs(blobs: Blob[], pauseDuration = 0.5): Promise<Blob> {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();

  // Decode all blobs into AudioBuffers
  const buffers: AudioBuffer[] = [];
  for (const blob of blobs) {
    const arrayBuffer = await blob.arrayBuffer();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      buffers.push(audioBuffer);
    } catch (e) {
      console.warn('Kunne ikke dekode et segment for sammenslåing:', e);
    }
  }

  if (buffers.length === 0) {
    throw new Error('Ingen gyldige lydsegmenter å slå sammen.');
  }

  // Calculate total samples
  const sampleRate = buffers[0].sampleRate;
  const numChannels = buffers[0].numberOfChannels;
  const pauseSamples = Math.floor(sampleRate * pauseDuration);

  const totalLength = buffers.reduce(
    (acc, buf) => acc + buf.length,
    (buffers.length - 1) * pauseSamples
  );

  const combined = ctx.createBuffer(numChannels, totalLength, sampleRate);

  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = combined.getChannelData(channel);
      const sourceData = buf.numberOfChannels > channel ? buf.getChannelData(channel) : buf.getChannelData(0);
      channelData.set(sourceData, offset);
    }
    offset += buf.length;
    if (i < buffers.length - 1) {
      offset += pauseSamples;
    }
  }

  // Encode combined AudioBuffer into a WAV Blob
  return audioBufferToWavBlob(combined);
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // Write WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}
