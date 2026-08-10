import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NightshiftError } from '@nightshift/core';
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
}

export const CONFIG_VERSION = 1;

export const DEFAULT_CONFIG: NightshiftConfig = {
  version: CONFIG_VERSION,
  defaultDashboard: 'home',
  defaultVibe: null,
  theme: 'midnight',
  logLevel: 'info',
  plugins: ['@nightshift/plugin-focus'],
};

export interface LoadedConfig {
  config: NightshiftConfig;
  paths: NightshiftPaths;
  /** False when no config file exists yet and defaults were used. */
  exists: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  return config;
}

/** Reads the config file, falling back to defaults when it does not exist. */
export async function loadConfig(options: ResolvePathsOptions = {}): Promise<LoadedConfig> {
  const paths = resolvePaths(options);

  let raw: string;
  try {
    raw = await readFile(paths.configFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { config: { ...DEFAULT_CONFIG }, paths, exists: false };
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

  return { config: parseConfig(parsed, paths.configFile), paths, exists: true };
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
