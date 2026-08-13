import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadClip } from './decode.js';
import { encodePcm16Wav, toneBuffer } from './wav.js';

describe('loadClip', () => {
  it('decodes WAV PCM', async () => {
    const decoded = await loadClip(encodePcm16Wav(toneBuffer(32, 180).frames));
    expect(decoded.frameCount).toBe(32);
    expect(decoded.sampleRate).toBe(44100);
  });

  it('decodes an MP3 fixture into mixer frames', async () => {
    const bytes = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'sine.mp3'));
    const decoded = await loadClip(bytes);
    expect(decoded.channels).toBe(2);
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.frameCount).toBeGreaterThan(1000);
  });

  it('rejects an unknown format', async () => {
    await expect(loadClip(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/unsupported/i);
  });
});
