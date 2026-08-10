import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Where Nightshift keeps everything it owns on disk.
 *
 * Resolution follows the XDG base directory spec on Linux and macOS, and
 * `%APPDATA%` / `%LOCALAPPDATA%` on Windows. `NIGHTSHIFT_CONFIG_DIR` overrides
 * the config root, which is what the test suite and `--config-dir` use.
 */
export interface NightshiftPaths {
  /** User-authored files: settings, dashboards, vibes. */
  configDir: string;
  /** Plugin data and caches Nightshift may regenerate at will. */
  dataDir: string;
  /** Log files. */
  logDir: string;
  /** The settings file itself. */
  configFile: string;
  /** Directory holding dashboard definitions. */
  dashboardsDir: string;
  /** Directory holding vibe definitions. */
  vibesDir: string;
  /** Directory scanned for locally installed plugins. */
  pluginsDir: string;
}

export interface ResolvePathsOptions {
  /** Overrides the config root, ahead of every environment variable. */
  configDir?: string | undefined;
  /** Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Defaults to `process.platform`. */
  platform?: NodeJS.Platform;
  /** Defaults to `os.homedir()`. */
  home?: string;
}

const APP = 'nightshift';

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim() !== '');
}

export function resolvePaths(options: ResolvePathsOptions = {}): NightshiftPaths {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const home = options.home ?? homedir();
  const windows = platform === 'win32';

  const defaultConfigRoot = windows
    ? firstNonEmpty(env['APPDATA'], join(home, 'AppData', 'Roaming'))!
    : firstNonEmpty(env['XDG_CONFIG_HOME'], join(home, '.config'))!;

  const defaultDataRoot = windows
    ? firstNonEmpty(env['LOCALAPPDATA'], join(home, 'AppData', 'Local'))!
    : firstNonEmpty(env['XDG_DATA_HOME'], join(home, '.local', 'share'))!;

  const defaultStateRoot = windows
    ? defaultDataRoot
    : firstNonEmpty(env['XDG_STATE_HOME'], join(home, '.local', 'state'))!;

  const configDir =
    firstNonEmpty(options.configDir, env['NIGHTSHIFT_CONFIG_DIR']) ?? join(defaultConfigRoot, APP);

  // An explicit config dir keeps everything together, so a throwaway
  // NIGHTSHIFT_CONFIG_DIR is genuinely self-contained.
  const overridden = configDir !== join(defaultConfigRoot, APP);
  const dataDir = overridden ? join(configDir, 'data') : join(defaultDataRoot, APP);
  const logDir = overridden ? join(configDir, 'logs') : join(defaultStateRoot, APP, 'logs');

  return {
    configDir,
    dataDir,
    logDir,
    configFile: join(configDir, 'config.json'),
    dashboardsDir: join(configDir, 'dashboards'),
    vibesDir: join(configDir, 'vibes'),
    pluginsDir: join(configDir, 'plugins'),
  };
}
