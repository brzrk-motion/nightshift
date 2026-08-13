import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NightshiftError } from '@nightshift/core';
import {
  DEFAULT_CONFIG,
  ensureConfigDirs,
  loadConfig,
  migrateConfig,
  parseConfig,
  saveConfig,
} from './config.js';
import { resolvePaths } from './paths.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nightshift-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolvePaths', () => {
  it('honours an explicit config dir and keeps everything under it', () => {
    const paths = resolvePaths({ configDir: dir });
    expect(paths.configDir).toBe(dir);
    expect(paths.configFile).toBe(join(dir, 'config.json'));
    expect(paths.logDir.startsWith(dir)).toBe(true);
    expect(paths.dataDir.startsWith(dir)).toBe(true);
  });

  it('follows XDG on linux', () => {
    const paths = resolvePaths({
      env: { XDG_CONFIG_HOME: '/xdg/config', XDG_STATE_HOME: '/xdg/state' },
      platform: 'linux',
      home: '/home/tester',
    });
    expect(paths.configDir).toBe(join('/xdg/config', 'nightshift'));
    expect(paths.logDir).toBe(join('/xdg/state', 'nightshift', 'logs'));
  });

  it('falls back to ~/.config when XDG is unset', () => {
    const paths = resolvePaths({ env: {}, platform: 'linux', home: '/home/tester' });
    expect(paths.configDir).toBe(join('/home/tester', '.config', 'nightshift'));
  });

  it('uses APPDATA on windows', () => {
    const paths = resolvePaths({
      env: { APPDATA: 'C:\\Users\\t\\AppData\\Roaming' },
      platform: 'win32',
      home: 'C:\\Users\\t',
    });
    expect(paths.configDir).toBe(join('C:\\Users\\t\\AppData\\Roaming', 'nightshift'));
  });
});

describe('parseConfig', () => {
  it('fills in defaults for missing keys', () => {
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it('keeps recognised overrides', () => {
    const config = parseConfig({ theme: 'dawn', logLevel: 'debug', defaultVibe: 'morning' });
    expect(config.theme).toBe('dawn');
    expect(config.logLevel).toBe('debug');
    expect(config.defaultVibe).toBe('morning');
  });

  it('ignores unknown keys rather than failing', () => {
    expect(parseConfig({ somethingNew: 42 }).theme).toBe(DEFAULT_CONFIG.theme);
  });

  it('rejects a bad log level', () => {
    expect(() => parseConfig({ logLevel: 'loud' })).toThrow(NightshiftError);
  });

  it('defaults onboarded to false and keeps an explicit true', () => {
    expect(parseConfig({}).onboarded).toBe(false);
    expect(parseConfig({ onboarded: true }).onboarded).toBe(true);
  });

  it('rejects a non-boolean onboarded', () => {
    expect(() => parseConfig({ onboarded: 'yes' })).toThrow(NightshiftError);
  });

  it('rejects a non-object document', () => {
    expect(() => parseConfig(['nope'])).toThrow(NightshiftError);
  });
});

describe('loadConfig / saveConfig', () => {
  it('returns defaults when no file exists', async () => {
    const loaded = await loadConfig({ configDir: dir });
    expect(loaded.exists).toBe(false);
    expect(loaded.config).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips through disk', async () => {
    await saveConfig({ ...DEFAULT_CONFIG, theme: 'dawn' }, { configDir: dir });
    const loaded = await loadConfig({ configDir: dir });
    expect(loaded.exists).toBe(true);
    expect(loaded.config.theme).toBe('dawn');
    expect(await readFile(join(dir, 'config.json'), 'utf8')).toMatch(/\n$/);
  });

  it('reports invalid JSON with a CONFIG_INVALID code', async () => {
    await saveConfig(DEFAULT_CONFIG, { configDir: dir });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(dir, 'config.json'), '{ not json', 'utf8');
    await expect(loadConfig({ configDir: dir })).rejects.toMatchObject({ code: 'CONFIG_INVALID' });
  });
});

describe('migrateConfig', () => {
  it('adds the weather, clock and spotify plugins and network grants when upgrading from v1', () => {
    const result = migrateConfig({
      version: 1,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: ['@nightshift/plugin-focus', '@nightshift/plugin-todo'],
      pluginPermissions: {},
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-weather');
    expect(result.config.plugins).toContain('@nightshift/plugin-clock');
    expect(result.config.plugins).toContain('@nightshift/plugin-spotify');
    expect(result.config.plugins).toContain('@nightshift/plugin-pomodoro');
    expect(result.config.plugins).toContain('@nightshift/plugin-habit');
    expect(result.config.plugins).toContain('@nightshift/plugin-home-assistant');
    expect(result.config.plugins).toContain('@nightshift/plugin-system-monitor');
    expect(result.config.plugins).toContain('@nightshift/plugin-ambient-noise');
    expect(result.config.pluginPermissions['weather']).toEqual(['network']);
    expect(result.config.pluginPermissions['spotify']).toEqual(['network']);
    expect(result.config.pluginPermissions['clock']).toEqual(['network']);
    expect(result.config.pluginPermissions['home-assistant']).toEqual(['network']);
  });

  it('adds the clock and spotify plugins when upgrading from v2', () => {
    const result = migrateConfig({
      version: 2,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-focus',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
      ],
      pluginPermissions: { weather: ['network'] },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-clock');
    expect(result.config.plugins).toContain('@nightshift/plugin-spotify');
    expect(result.config.plugins).toContain('@nightshift/plugin-habit');
    expect(result.config.pluginPermissions['spotify']).toEqual(['network']);
    expect(result.config.pluginPermissions['clock']).toEqual(['network']);
  });

  it('adds the spotify plugin and network grant when upgrading from v3', () => {
    const result = migrateConfig({
      version: 3,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-clock',
        '@nightshift/plugin-focus',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
      ],
      pluginPermissions: { weather: ['network'] },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-spotify');
    expect(result.config.plugins).toContain('@nightshift/plugin-habit');
    expect(result.config.pluginPermissions['spotify']).toEqual(['network']);
    expect(result.config.pluginPermissions['clock']).toEqual(['network']);
  });

  it('adds the clock network grant when upgrading from v4', () => {
    const result = migrateConfig({
      version: 4,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-clock',
        '@nightshift/plugin-focus',
        '@nightshift/plugin-spotify',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
      ],
      pluginPermissions: { weather: ['network'], spotify: ['network'] },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.pluginPermissions['clock']).toEqual(['network']);
    expect(result.config.plugins).toContain('@nightshift/plugin-habit');
  });

  it('adds the pomodoro plugin when upgrading from v5', () => {
    const result = migrateConfig({
      version: 5,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-clock',
        '@nightshift/plugin-focus',
        '@nightshift/plugin-spotify',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
      ],
      pluginPermissions: { weather: ['network'], spotify: ['network'], clock: ['network'] },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-pomodoro');
    expect(result.config.plugins).toContain('@nightshift/plugin-habit');
    expect(result.config.plugins).toContain('@nightshift/plugin-home-assistant');
    expect(result.config.pluginPermissions['home-assistant']).toEqual(
      expect.arrayContaining(['network']),
    );
  });

  it('adds the habit plugin when upgrading from v6', () => {
    const result = migrateConfig({
      version: 6,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-clock',
        '@nightshift/plugin-focus',
        '@nightshift/plugin-pomodoro',
        '@nightshift/plugin-spotify',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
      ],
      pluginPermissions: { weather: ['network'], spotify: ['network'], clock: ['network'] },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-habit');
  });

  it('adds the home-assistant plugin when upgrading from v7', () => {
    const result = migrateConfig({
      version: 7,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-clock',
        '@nightshift/plugin-focus',
        '@nightshift/plugin-habit',
        '@nightshift/plugin-pomodoro',
        '@nightshift/plugin-spotify',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
      ],
      pluginPermissions: { weather: ['network'], spotify: ['network'], clock: ['network'] },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-home-assistant');
    expect(result.config.pluginPermissions['home-assistant']).toEqual(['network']);
  });

  it('adds the system-monitor plugin when upgrading from v8', () => {
    const result = migrateConfig({
      version: 8,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-clock',
        '@nightshift/plugin-focus',
        '@nightshift/plugin-habit',
        '@nightshift/plugin-home-assistant',
        '@nightshift/plugin-pomodoro',
        '@nightshift/plugin-spotify',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
      ],
      pluginPermissions: {
        weather: ['network'],
        spotify: ['network'],
        clock: ['network'],
        'home-assistant': ['network'],
      },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-system-monitor');
  });

  it('adds the ambient-noise plugin when upgrading from v9', () => {
    const result = migrateConfig({
      version: 9,
      defaultDashboard: 'home',
      defaultVibe: null,
      theme: 'midnight',
      logLevel: 'info',
      plugins: [
        '@nightshift/plugin-clock',
        '@nightshift/plugin-focus',
        '@nightshift/plugin-habit',
        '@nightshift/plugin-home-assistant',
        '@nightshift/plugin-pomodoro',
        '@nightshift/plugin-spotify',
        '@nightshift/plugin-todo',
        '@nightshift/plugin-weather',
        '@nightshift/plugin-system-monitor',
      ],
      pluginPermissions: {
        weather: ['network'],
        spotify: ['network'],
        clock: ['network'],
        'home-assistant': ['network'],
      },
      onboarded: true,
    });

    expect(result.migrated).toBe(true);
    expect(result.config.version).toBe(10);
    expect(result.config.plugins).toContain('@nightshift/plugin-ambient-noise');
    expect(result.config.pluginPermissions['ambient-noise']).toBeUndefined();
  });

  it('is a no-op once the config is current', () => {
    const result = migrateConfig({ ...DEFAULT_CONFIG });
    expect(result.migrated).toBe(false);
    expect(result.config).toEqual(DEFAULT_CONFIG);
  });

  it('persists a v1 config upgrade on load', async () => {
    await saveConfig(
      {
        version: 1,
        defaultDashboard: 'home',
        defaultVibe: null,
        theme: 'midnight',
        logLevel: 'info',
        plugins: ['@nightshift/plugin-focus', '@nightshift/plugin-todo'],
        pluginPermissions: {},
        onboarded: true,
      },
      { configDir: dir },
    );

    const loaded = await loadConfig({ configDir: dir });
    expect(loaded.migrated).toBe(true);
    expect(loaded.config.plugins).toContain('@nightshift/plugin-weather');
    expect(loaded.config.plugins).toContain('@nightshift/plugin-clock');
    expect(loaded.config.plugins).toContain('@nightshift/plugin-spotify');
    expect(loaded.config.plugins).toContain('@nightshift/plugin-pomodoro');
    expect(loaded.config.plugins).toContain('@nightshift/plugin-habit');
    expect(loaded.config.plugins).toContain('@nightshift/plugin-home-assistant');
    expect(loaded.config.plugins).toContain('@nightshift/plugin-system-monitor');
    expect(loaded.config.plugins).toContain('@nightshift/plugin-ambient-noise');
    expect(loaded.config.pluginPermissions['weather']).toEqual(['network']);
    expect(loaded.config.pluginPermissions['spotify']).toEqual(['network']);
    expect(loaded.config.pluginPermissions['clock']).toEqual(['network']);
    expect(loaded.config.pluginPermissions['home-assistant']).toEqual(['network']);

    const onDisk = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8')) as {
      version: number;
      plugins: string[];
    };
    expect(onDisk.version).toBe(10);
    expect(onDisk.plugins).toContain('@nightshift/plugin-weather');
    expect(onDisk.plugins).toContain('@nightshift/plugin-clock');
    expect(onDisk.plugins).toContain('@nightshift/plugin-spotify');
    expect(onDisk.plugins).toContain('@nightshift/plugin-pomodoro');
    expect(onDisk.plugins).toContain('@nightshift/plugin-habit');
    expect(onDisk.plugins).toContain('@nightshift/plugin-home-assistant');
  });
});

describe('ensureConfigDirs', () => {
  it('creates the whole tree and is safe to repeat', async () => {
    const paths = await ensureConfigDirs({ configDir: dir });
    await ensureConfigDirs({ configDir: dir });
    const { stat } = await import('node:fs/promises');
    for (const target of [
      paths.dashboardsDir,
      paths.vibesDir,
      paths.themesDir,
      paths.pluginsDir,
      paths.logDir,
    ]) {
      expect((await stat(target)).isDirectory()).toBe(true);
    }
  });
});
