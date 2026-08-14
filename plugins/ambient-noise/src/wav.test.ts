import { describe, expect, it } from 'vitest';
import { MIXER_SAMPLE_RATE } from './entity.js';
import { encodePcm16Wav, loadWav, pcmFromChannels, toneBuffer } from './wav.js';

function concat(headerAndPayload: Uint8Array, extra: Uint8Array): Uint8Array {
  const out = new Uint8Array(headerAndPayload.length + extra.length);
  out.set(headerAndPayload);
  out.set(extra, headerAndPayload.length);
  return out;
}

describe('loadWav', () => {
  it('decodes a valid PCM16 stereo WAV into mixer frames', () => {
    const source = toneBuffer(64, 220);
    const encoded = encodePcm16Wav(source.frames);
    const decoded = loadWav(encoded);
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.channels).toBe(2);
    expect(decoded.frameCount).toBe(64);
    expect(decoded.frames.length).toBe(128);
    expect(Math.abs((decoded.frames[0] ?? 0) - (source.frames[0] ?? 0))).toBeLessThan(2);
  });

  it('rejects a truncated buffer', () => {
    expect(() => loadWav(new Uint8Array([82, 73, 70, 70]))).toThrow(/truncated/i);
  });

  it('rejects non-PCM WAVE data', () => {
    const source = toneBuffer(8, 440);
    const encoded = encodePcm16Wav(source.frames);
    const copy = Uint8Array.from(encoded);
    copy[20] = 3;
    copy[21] = 0;
    expect(() => loadWav(copy)).toThrow(/not PCM/i);
  });

  it('rejects a header that claims more bytes than are present', () => {
    const source = toneBuffer(8, 440);
    const encoded = encodePcm16Wav(source.frames);
    expect(() => loadWav(encoded.subarray(0, 30))).toThrow();
  });

  it('does not hang when extra trailing bytes are appended', () => {
    const encoded = encodePcm16Wav(toneBuffer(16, 100).frames);
    const decoded = loadWav(concat(encoded, new Uint8Array([1, 2, 3, 4])));
    expect(decoded.frameCount).toBe(16);
  });

  it('decodes a data prefix when the header still claims a longer chunk', () => {
    const encoded = encodePcm16Wav(toneBuffer(64, 180).frames);
    const prefix = encoded.subarray(0, 44 + 40 * 4);
    const decoded = loadWav(prefix);
    expect(decoded.frameCount).toBe(40);
  });
});

describe('pcmFromChannels', () => {
  it('resamples 24 kHz to mixer rate with a sane 440 Hz sine', () => {
    const inRate = 24000;
    const seconds = 0.25;
    const hz = 440;
    const n = Math.round(inRate * seconds);
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      mono[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / inRate);
    }
    const decoded = pcmFromChannels([mono, mono], inRate);
    expect(decoded.sampleRate).toBe(MIXER_SAMPLE_RATE);
    expect(decoded.frameCount).toBe(Math.round(n * (MIXER_SAMPLE_RATE / inRate)));
    let err = 0;
    const skip = 64;
    const end = decoded.frameCount - 64;
    for (let i = skip; i < end; i += 1) {
      const ideal = 0.5 * Math.sin((2 * Math.PI * hz * i) / MIXER_SAMPLE_RATE);
      const sample = (decoded.frames[i * 2] ?? 0) / 32767;
      const d = sample - ideal;
      err += d * d;
    }
    const rmse = Math.sqrt(err / Math.max(1, end - skip));
    expect(rmse).toBeLessThan(0.04);
  });
});
