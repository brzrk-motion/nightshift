import {
  createLogger,
  ensureConfigDirs,
  isLogLevel,
  loadConfig,
  type LoadedConfig,
  type LogLevel,
  type Logger,
  type NightshiftConfig,
  type NightshiftPaths,
} from '@nightshift/services';
import { join } from 'node:path';

/** Options every command accepts, parsed off the root program. */
export interface GlobalOptions {
  configDir?: string | undefined;
  logLevel?: string | undefined;
  verbose?: boolean | undefined;
  color?: boolean | undefined;
  json?: boolean | undefined;
}

/** Everything a command needs: resolved config, paths and a logger. */
export interface CliContext {
  config: NightshiftConfig;
  paths: NightshiftPaths;
  /** False when the config file does not exist yet. */
  configExists: boolean;
  log: Logger;
  json: boolean;
}

function resolveLevel(options: GlobalOptions, config: NightshiftConfig): LogLevel {
  if (options.logLevel !== undefined) {
    if (!isLogLevel(options.logLevel)) {
      throw new Error(`Unknown log level "${options.logLevel}".`);
    }
    return options.logLevel;
  }
  if (options.verbose) return 'debug';
  return config.logLevel;
}

/**
 * Builds the context for a command. Reading config before creating the logger
 * means the configured log level applies to everything except config loading
 * itself, which is the trade-off worth making — a broken config file should
 * report loudly no matter what level it asks for.
 */
export async function createContext(options: GlobalOptions = {}): Promise<CliContext> {
  const loaded: LoadedConfig = await loadConfig({ configDir: options.configDir });
  const level = resolveLevel(options, loaded.config);

  const log = createLogger({
    level,
    file: join(loaded.paths.logDir, 'nightshift.log'),
    ...(options.color === undefined ? {} : { color: options.color }),
    // Structured output on stdout must not be interleaved with log lines.
    ...(options.json ? { stream: null } : {}),
  });

  log.debug('Configuration resolved', {
    configFile: loaded.paths.configFile,
    exists: loaded.exists,
    level,
  });

  return {
    config: loaded.config,
    paths: loaded.paths,
    configExists: loaded.exists,
    log,
    json: options.json === true,
  };
}

/** Creates the config directory tree and returns the resolved paths. */
export async function initConfigDirs(context: CliContext): Promise<NightshiftPaths> {
  const paths = await ensureConfigDirs({ configDir: context.paths.configDir });
  context.log.debug('Configuration directories ready', { configDir: paths.configDir });
  return paths;
}
