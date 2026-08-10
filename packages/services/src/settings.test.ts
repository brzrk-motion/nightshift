import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from './settings.js';
import { DEFAULT_CONFIG } from './config.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nightshift-settings-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createSettingsStore', () => {
  it('starts from the defaults when there is no file yet', async () => {
    const settings = await createSettingsStore({ configDir: dir });

    expect(settings.current).toEqual(DEFAULT_CONFIG);
    expect(settings.exists).toBe(false);
  });

  it('reads an existing file', async () => {
    await writeFile(join(dir, 'config.json'), JSON.stringify({ theme: 'ember' }));

    const settings = await createSettingsStore({ configDir: dir });

    expect(settings.current.theme).toBe('ember');
    expect(settings.exists).toBe(true);
  });

  it('patches in memory without touching the file', async () => {
    const settings = await createSettingsStore({ configDir: dir });

    settings.patch({ theme: 'daylight' });

    expect(settings.current.theme).toBe('daylight');
    await expect(readFile(join(dir, 'config.json'), 'utf8')).rejects.toThrow();
  });

  it('persists an update', async () => {
    const settings = await createSettingsStore({ configDir: dir });

    await settings.update({ defaultDashboard: 'work' });

    const written = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')) as {
      defaultDashboard: string;
    };
    expect(written.defaultDashboard).toBe('work');
  });

  it('tells subscribers about a change, with the value before it', async () => {
    const settings = await createSettingsStore({ configDir: dir });
    const listener = vi.fn();
    const changed = vi.fn();
    settings.subscribe(listener);
    settings.events.on('changed', changed);

    settings.patch({ theme: 'ember' });

    expect(listener).toHaveBeenCalledWith(settings.current);
    expect(changed.mock.calls[0]?.[1]).toMatchObject({ theme: 'midnight' });
  });

  it('stops notifying after unsubscribe', async () => {
    const settings = await createSettingsStore({ configDir: dir });
    const listener = vi.fn();
    settings.subscribe(listener)();

    settings.patch({ theme: 'ember' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('reload discards in-memory overrides', async () => {
    await writeFile(join(dir, 'config.json'), JSON.stringify({ theme: 'ember' }));
    const settings = await createSettingsStore({ configDir: dir });
    settings.patch({ theme: 'daylight' });

    await settings.reload();

    expect(settings.current.theme).toBe('ember');
  });

  it('saves whatever is currently in memory', async () => {
    const settings = await createSettingsStore({ configDir: dir });
    settings.patch({ logLevel: 'debug' });

    await settings.save();

    const written = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')) as {
      logLevel: string;
    };
    expect(written.logLevel).toBe('debug');
  });
});
