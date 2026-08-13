import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NightshiftError } from '@nightshift/core';
import { isCapability, type Capability } from '@nightshift/sdk';
import { resolvePaths, type NightshiftPaths, type ResolvePathsOptions } from './paths.js';

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export const LOG_LEVELS: readonly LogLevel[] = [
  'silent',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
];

export interface NightshiftConfig {
  /** Config schema version, so future releases can migrate old files. */
  version: number;
  /** Dashboard opened by a bare `nightshift`. */
  defaultDashboard: string;
  /** Vibe activated at startup, or `null` to start without one. */
  defaultVibe: string | null;
  /** Name of the active theme. */
  theme: string;
  /** Verbosity of the log file and of `--verbose` output. */
  logLevel: LogLevel;
  /** Plugins to load, by package name or absolute path. */
  plugins: string[];
  /**
   * Capabilities granted per plugin, beyond the ones every plugin gets.
   * `"all"` grants everything the plugin asks for.
   */
  pluginPermissions: Record<string, Capability[] | 'all'>;
  /** Whether the one-time onboarding modal has already been shown. */
  onboarded: boolean;
}

export const CONFIG_VERSION = 11;

export const DEFAULT_CONFIG: NightshiftConfig = {
  version: CONFIG_VERSION,
  defaultDashboard: 'home',
  defaultVibe: null,
  theme: 'midnight',
  logLevel: 'info',
  plugins: [
    '@nightshift/plugin-clock',
    '@nightshift/plugin-habit',
    '@nightshift/plugin-home-assistant',
    '@nightshift/plugin-pomodoro',
    '@nightshift/plugin-spotify',
    '@nightshift/plugin-todo',
    '@nightshift/plugin-weather',
    '@nightshift/plugin-system-monitor',
    '@nightshift/plugin-ambient-noise',
  ],
  pluginPermissions: {
    weather: ['network'],
    spotify: ['network'],
    clock: ['network'],
    'home-assistant': ['network'],
  },
  onboarded: false,
};

export interface LoadedConfig {
  config: NightshiftConfig;
  paths: NightshiftPaths;
  /** False when no config file exists yet and defaults were used. */
  exists: boolean;
  /** True when an on-disk config was upgraded in memory (and should be written back). */
  migrated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const WEATHER_PLUGIN = '@nightshift/plugin-weather';
const CLOCK_PLUGIN = '@nightshift/plugin-clock';
const SPOTIFY_PLUGIN = '@nightshift/plugin-spotify';
const FOCUS_PLUGIN = '@nightshift/plugin-focus';
const POMODORO_PLUGIN = '@nightshift/plugin-pomodoro';
const HABIT_PLUGIN = '@nightshift/plugin-habit';
const HOME_ASSISTANT_PLUGIN = '@nightshift/plugin-home-assistant';
const SYSTEM_MONITOR_PLUGIN = '@nightshift/plugin-system-monitor';
const AMBIENT_NOISE_PLUGIN = '@nightshift/plugin-ambient-noise';

function ensurePlugin(config: NightshiftConfig, plugin: string): NightshiftConfig {
  if (config.plugins.includes(plugin)) {
    return config;
  }
  return { ...config, plugins: [...config.plugins, plugin] };
}

function ensureNetworkGrant(config: NightshiftConfig, pluginId: string): NightshiftConfig {
  const grant = config.pluginPermissions[pluginId];
  if (grant === 'all' || (Array.isArray(grant) && grant.includes('network'))) {
    return config;
  }
  const grants = Array.isArray(grant) ? grant : [];
  return {
    ...config,
    pluginPermissions: {
      ...config.pluginPermissions,
      [pluginId]: [...grants, 'network'],
    },
  };
}

type ConfigMigration = {
  toVersion: number;
  apply: (config: NightshiftConfig) => NightshiftConfig;
};

/**
 * Ordered config migrations. Each step bumps `version` to `toVersion` and may
 * ship bundled plugins or network grants so existing installs match fresh defaults.
 */
const CONFIG_MIGRATIONS: ConfigMigration[] = [
  {
    toVersion: 2,
    apply: (config) => ensureNetworkGrant(ensurePlugin(config, WEATHER_PLUGIN), 'weather'),
  },
  {
    toVersion: 3,
    apply: (config) => ensurePlugin(config, CLOCK_PLUGIN),
  },
  {
    toVersion: 4,
    apply: (config) => ensureNetworkGrant(ensurePlugin(config, SPOTIFY_PLUGIN), 'spotify'),
  },
  {
    toVersion: 5,
    apply: (config) => ensureNetworkGrant(config, 'clock'),
  },
  {
    toVersion: 6,
    apply: (config) => ensurePlugin(config, POMODORO_PLUGIN),
  },
  {
    toVersion: 7,
    apply: (config) => ensurePlugin(config, HABIT_PLUGIN),
  },
  {
    toVersion: 8,
    apply: (config) =>
      ensureNetworkGrant(ensurePlugin(config, HOME_ASSISTANT_PLUGIN), 'home-assistant'),
  },
  {
    toVersion: 9,
    apply: (config) => ensurePlugin(config, SYSTEM_MONITOR_PLUGIN),
  },
  {
    toVersion: 10,
    apply: (config) => ensurePlugin(config, AMBIENT_NOISE_PLUGIN),
  },
];

/**
 * Brings an older on-disk config forward. v1 → v2 ships the weather plugin and
 * its network grant; v2 → v3 ships the clock plugin; v3 → v4 ships the Spotify
 * plugin and its network grant; v4 → v5 grants the clock plugin network access,
 * needed once it can look up a location's timezone; v5 → v6 ships the pomodoro
 * plugin; v6 → v7 ships the habit tracker; v7 → v8 ships Home Assistant scenes
 * and its network grant; v8 → v9 ships the system monitor plugin; v9 → v10
 * ships the ambient noise player; v10 → v11 drops the focus plugin (superseded
 * by pomodoro) — so existing installs see the same defaults as a fresh one.
 */
export function migrateConfig(config: NightshiftConfig): {
  config: NightshiftConfig;
  migrated: boolean;
} {
  if (config.version >= CONFIG_VERSION) {
    return { config, migrated: false };
  }

  let next: NightshiftConfig = { ...config };
  let migrated = false;

  for (const { toVersion, apply } of CONFIG_MIGRATIONS) {
    if (next.version < toVersion) {
      next = { ...apply(next), version: toVersion };
      migrated = true;
    }
  }

  if (next.version < 11) {
    if (next.plugins.includes(FOCUS_PLUGIN)) {
      next = {
        ...next,
        plugins: next.plugins.filter((plugin) => plugin !== FOCUS_PLUGIN),
      };
      migrated = true;
    }
    next = { ...next, version: 11 };
    migrated = true;
  }

  return { config: next, migrated };
}

/**
 * Validates a parsed config object. Unknown keys are dropped rather than
 * rejected so an older Nightshift can still read a newer file.
 */
export function parseConfig(input: unknown, source = 'config'): NightshiftConfig {
  if (!isRecord(input)) {
    throw new NightshiftError('CONFIG_INVALID', `${source} must contain a JSON object.`);
  }

  const invalid = (key: string, expected: string): never => {
    throw new NightshiftError('CONFIG_INVALID', `${source}: "${key}" must be ${expected}.`, {
      hint: `Fix the value or delete the key to fall back to the default.`,
    });
  };

  const config: NightshiftConfig = { ...DEFAULT_CONFIG };

  if (input['version'] !== undefined) {
    if (typeof input['version'] !== 'number' || !Number.isInteger(input['version'])) {
      invalid('version', 'an integer');
    }
    config.version = input['version'] as number;
  }

  if (input['defaultDashboard'] !== undefined) {
    if (typeof input['defaultDashboard'] !== 'string' || input['defaultDashboard'] === '') {
      invalid('defaultDashboard', 'a non-empty string');
    }
    config.defaultDashboard = input['defaultDashboard'] as string;
  }

  if (input['defaultVibe'] !== undefined) {
    if (input['defaultVibe'] !== null && typeof input['defaultVibe'] !== 'string') {
      invalid('defaultVibe', 'a string or null');
    }
    config.defaultVibe = input['defaultVibe'] as string | null;
  }

  if (input['theme'] !== undefined) {
    if (typeof input['theme'] !== 'string' || input['theme'] === '') {
      invalid('theme', 'a non-empty string');
    }
    config.theme = input['theme'] as string;
  }

  if (input['logLevel'] !== undefined) {
    if (!LOG_LEVELS.includes(input['logLevel'] as LogLevel)) {
      invalid('logLevel', `one of ${LOG_LEVELS.join(', ')}`);
    }
    config.logLevel = input['logLevel'] as LogLevel;
  }

  if (input['plugins'] !== undefined) {
    const plugins = input['plugins'];
    if (!Array.isArray(plugins) || plugins.some((entry) => typeof entry !== 'string')) {
      invalid('plugins', 'an array of strings');
    }
    config.plugins = [...(plugins as string[])];
  }

  if (input['pluginPermissions'] !== undefined) {
    const grants = input['pluginPermissions'];
    if (!isRecord(grants)) invalid('pluginPermissions', 'an object keyed by plugin id');
    const parsed: Record<string, Capability[] | 'all'> = {};
    for (const [plugin, grant] of Object.entries(grants as Record<string, unknown>)) {
      if (grant === 'all') {
        parsed[plugin] = 'all';
        continue;
      }
      if (!Array.isArray(grant) || !grant.every(isCapability)) {
        invalid(`pluginPermissions.${plugin}`, '"all" or an array of capability names');
      }
      parsed[plugin] = [...(grant as Capability[])];
    }
    config.pluginPermissions = parsed;
  }

  if (input['onboarded'] !== undefined) {
    if (typeof input['onboarded'] !== 'boolean') {
      invalid('onboarded', 'a boolean');
    }
    config.onboarded = input['onboarded'] as boolean;
  }

  return migrateConfig(config).config;
}

/** Reads the config file, falling back to defaults when it does not exist. */
export async function loadConfig(options: ResolvePathsOptions = {}): Promise<LoadedConfig> {
  const paths = resolvePaths(options);

  let raw: string;
  try {
    raw = await readFile(paths.configFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { config: { ...DEFAULT_CONFIG }, paths, exists: false, migrated: false };
    }
    throw new NightshiftError('CONFIG_UNREADABLE', `Could not read ${paths.configFile}.`, {
      cause: error,
      hint: 'Check the file permissions, or run `nightshift doctor`.',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new NightshiftError('CONFIG_INVALID', `${paths.configFile} is not valid JSON.`, {
      cause: error,
      hint: 'Fix the syntax, or delete the file to regenerate it.',
    });
  }

  // parseConfig already applies migrateConfig; re-run so we know whether to
  // persist — comparing versions is enough for the current v1→v2 step.
  const before = (() => {
    if (!isRecord(parsed)) return CONFIG_VERSION;
    const version = parsed['version'];
    return typeof version === 'number' ? version : 0;
  })();
  const config = parseConfig(parsed, paths.configFile);
  const migrated = before < CONFIG_VERSION;

  if (migrated) {
    await saveConfig(config, options);
  }

  return { config, paths, exists: true, migrated };
}

/** Writes the config file, creating the config directory if needed. */
export async function saveConfig(
  config: NightshiftConfig,
  options: ResolvePathsOptions = {},
): Promise<NightshiftPaths> {
  const paths = resolvePaths(options);
  try {
    await mkdir(dirname(paths.configFile), { recursive: true });
    await writeFile(paths.configFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  } catch (error) {
    throw new NightshiftError('CONFIG_UNWRITABLE', `Could not write ${paths.configFile}.`, {
      cause: error,
      hint: 'Check that the config directory is writable.',
    });
  }
  return paths;
}

/** Creates the config directory tree. Safe to call when it already exists. */
export async function ensureConfigDirs(
  options: ResolvePathsOptions = {},
): Promise<NightshiftPaths> {
  const paths = resolvePaths(options);
  const targets = [
    paths.configDir,
    paths.dataDir,
    paths.logDir,
    paths.dashboardsDir,
    paths.vibesDir,
    paths.themesDir,
    paths.pluginsDir,
  ];
  try {
    await Promise.all(targets.map((dir) => mkdir(dir, { recursive: true })));
  } catch (error) {
    throw new NightshiftError('CONFIG_UNWRITABLE', 'Could not create the Nightshift directories.', {
      cause: error,
      hint: `Check that ${paths.configDir} is writable.`,
    });
  }
  return paths;
}
