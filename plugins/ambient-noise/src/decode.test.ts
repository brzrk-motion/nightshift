import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadClip,
  limitPcm,
  readClipBytes,
  MAX_DECODED_SECONDS,
  MAX_MPEG_BYTES,
} from './decode.js';
import { MIXER_CHANNELS, MIXER_SAMPLE_RATE } from './entity.js';
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

  it('caps resident PCM to a loop window', () => {
    const long = toneBuffer(MIXER_SAMPLE_RATE * 2, 180);
    const capped = limitPcm(long, MIXER_SAMPLE_RATE);
    expect(capped.frameCount).toBe(MIXER_SAMPLE_RATE);
    expect(capped.frames.length).toBe(MIXER_SAMPLE_RATE * MIXER_CHANNELS);
  });

  it('reads only the decode window from a long MPEG file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ambient-read-'));
    const path = join(dir, 'long.mp3');
    const body = Buffer.alloc(8 * 1024 * 1024, 0xff);
    body[1] = 0xe3;
    await writeFile(path, body);
    const bytes = await readClipBytes(path);
    expect(bytes.byteLength).toBeLessThanOrEqual(MAX_MPEG_BYTES);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('loads a 90s WAV as a 60s loop window', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ambient-wav-'));
    const path = join(dir, 'long.wav');
    const frames = new Int16Array(90 * MIXER_SAMPLE_RATE * MIXER_CHANNELS);
    await writeFile(path, encodePcm16Wav(frames));
    const decoded = await loadClip(await readClipBytes(path));
    expect(decoded.frameCount).toBe(MAX_DECODED_SECONDS * MIXER_SAMPLE_RATE);
  });
});
