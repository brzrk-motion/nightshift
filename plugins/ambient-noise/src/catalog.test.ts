import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCatalog } from './catalog.js';
import { encodePcm16Wav, toneBuffer } from './wav.js';

describe('loadCatalog', () => {
  it('loads clips.json and marks missing files unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ambient-catalog-'));
    const wav = encodePcm16Wav(toneBuffer(32, 180).frames);
    await writeFile(join(dir, 'rainy-day.wav'), wav);
    await writeFile(
      join(dir, 'clips.json'),
      JSON.stringify([
        { id: 'rainy-day', name: 'Rainy Day', file: 'rainy-day.wav' },
        { id: 'white-noise', name: 'White Noise', file: 'missing.wav' },
      ]),
    );

    const clips = await loadCatalog(dir);
    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({ id: 'rainy-day', name: 'Rainy Day', status: 'ok' });
    expect(clips[1]).toMatchObject({ id: 'white-noise', status: 'unavailable' });
  });

  it('returns an empty list when clips.json is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ambient-empty-'));
    await mkdir(dir, { recursive: true });
    expect(await loadCatalog(dir)).toEqual([]);
  });

  it('rejects path traversal in file entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ambient-escape-'));
    await writeFile(
      join(dir, 'clips.json'),
      JSON.stringify([{ id: 'evil', name: 'Evil', file: '../secret.wav' }]),
    );
    expect(await loadCatalog(dir)).toEqual([]);
  });

  it('keeps the last duplicate id', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ambient-dup-'));
    const wav = encodePcm16Wav(toneBuffer(8, 100).frames);
    await writeFile(join(dir, 'a.wav'), wav);
    await writeFile(join(dir, 'b.wav'), wav);
    await writeFile(
      join(dir, 'clips.json'),
      JSON.stringify([
        { id: 'rainy-day', name: 'First', file: 'a.wav' },
        { id: 'rainy-day', name: 'Second', file: 'b.wav' },
      ]),
    );
    const clips = await loadCatalog(dir);
    expect(clips).toHaveLength(1);
    expect(clips[0]?.name).toBe('Second');
    expect(clips[0]?.file).toBe('b.wav');
  });

  it('lists the bundled MP3 beds', async () => {
    const clips = await loadCatalog();
    expect(clips.map((clip) => clip.id)).toEqual(['rainy-day', 'soft-static', 'ambient-noise']);
    expect(clips.map((clip) => clip.name)).toEqual(['Rainy Day', 'Soft Static', 'Ambient Noise']);
    expect(clips.every((clip) => clip.status === 'ok' && clip.file.endsWith('.mp3'))).toBe(true);
  });
});
