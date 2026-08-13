import { MIXER_CHANNELS, MIXER_SAMPLE_RATE } from './entity.js';

export interface PcmBuffer {
  sampleRate: number;
  channels: 2;
  frames: Int16Array;
  frameCount: number;
}

function readFourCc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function clampInt16(value: number): number {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return value | 0;
}

function sampleAt(mono: Float32Array, frame: number): number {
  if (mono.length === 0) return 0;
  if (frame <= 0) return mono[0] ?? 0;
  if (frame >= mono.length - 1) return mono[mono.length - 1] ?? 0;
  const left = Math.floor(frame);
  const frac = frame - left;
  const a = mono[left] ?? 0;
  const b = mono[left + 1] ?? a;
  return a + (b - a) * frac;
}

export function pcmFromChannels(channels: Float32Array[], sampleRate: number): PcmBuffer {
  const frameCountIn = channels[0]?.length ?? 0;
  const ratio = MIXER_SAMPLE_RATE / sampleRate;
  const frameCount = Math.max(1, Math.round(frameCountIn * ratio));
  const frames = new Int16Array(frameCount * MIXER_CHANNELS);
  const left = channels[0] ?? new Float32Array(frameCountIn);
  const right = channels[1] ?? left;

  for (let i = 0; i < frameCount; i += 1) {
    const src = sampleRate === MIXER_SAMPLE_RATE ? i : i / ratio;
    frames[i * 2] = clampInt16(Math.round(sampleAt(left, src) * 32767));
    frames[i * 2 + 1] = clampInt16(Math.round(sampleAt(right, src) * 32767));
  }

  return { sampleRate: MIXER_SAMPLE_RATE, channels: 2, frames, frameCount };
}

/**
 * Parse a RIFF WAVE PCM buffer into mixer-native stereo s16 @ 44.1 kHz.
 */
export function loadWav(bytes: Uint8Array): PcmBuffer {
  if (bytes.byteLength < 12) {
    throw new Error('WAV file is truncated');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readFourCc(view, 0) !== 'RIFF' || readFourCc(view, 8) !== 'WAVE') {
    throw new Error('Not a RIFF WAVE file');
  }

  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let data: Uint8Array | undefined;

  while (offset + 8 <= view.byteLength) {
    const id = readFourCc(view, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > view.byteLength) {
      throw new Error('WAV chunk is truncated');
    }
    if (id === 'fmt ') {
      if (size < 16) throw new Error('WAV fmt chunk is too small');
      audioFormat = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      sampleRate = view.getUint32(start + 4, true);
      bitsPerSample = view.getUint16(start + 14, true);
    } else if (id === 'data') {
      data = bytes.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }

  if (audioFormat !== 1) {
    throw new Error('WAV is not PCM');
  }
  if (channels < 1 || sampleRate < 1 || !data) {
    throw new Error('WAV is missing fmt or data');
  }
  if (bitsPerSample !== 8 && bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth ${bitsPerSample}`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(data.length / (bytesPerSample * channels));
  const decoded: Float32Array[] = Array.from(
    { length: Math.min(channels, 2) },
    () => new Float32Array(frameCount),
  );
  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let i = 0; i < frameCount; i += 1) {
    for (let ch = 0; ch < Math.min(channels, 2); ch += 1) {
      const index = (i * channels + ch) * bytesPerSample;
      let sample = 0;
      if (bitsPerSample === 8) {
        sample = (dataView.getUint8(index) - 128) / 128;
      } else {
        sample = dataView.getInt16(index, true) / 32768;
      }
      decoded[ch]![i] = sample;
    }
  }

  return pcmFromChannels(decoded, sampleRate);
}

export function encodePcm16Wav(
  frames: Int16Array,
  sampleRate = MIXER_SAMPLE_RATE,
  channels = MIXER_CHANNELS,
): Uint8Array {
  const dataSize = frames.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  out.set(new Uint8Array(frames.buffer, frames.byteOffset, frames.byteLength), 44);
  return out;
}

export function toneBuffer(frameCount: number, hz: number, amplitude = 0.4): PcmBuffer {
  const frames = new Int16Array(frameCount * MIXER_CHANNELS);
  for (let i = 0; i < frameCount; i += 1) {
    const sample = clampInt16(
      Math.round(Math.sin((2 * Math.PI * hz * i) / MIXER_SAMPLE_RATE) * amplitude * 32767),
    );
    frames[i * 2] = sample;
    frames[i * 2 + 1] = sample;
  }
  return { sampleRate: MIXER_SAMPLE_RATE, channels: 2, frames, frameCount };
}
