import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname } from 'node:path';
import { ansi, shouldUseColor, type Json, type Unsubscribe } from '@nightshift/core';
import { LOG_LEVELS, type LogLevel } from './config.js';

export type LogFields = Record<string, Json | undefined>;

export interface LogRecord {
  time: string;
  level: Exclude<LogLevel, 'silent'>;
  scope: string;
  message: string;
  fields?: LogFields;
}

export interface Logger {
  readonly level: LogLevel;
  error(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  trace(message: string, fields?: LogFields): void;
  /** A logger that tags every record with a nested scope. */
  child(scope: string): Logger;
  setLevel(level: LogLevel): void;
  /**
   * Swaps the human-readable sink. `null` silences it without touching the file
   * sink — which is how the terminal UI stops log lines being drawn over the
   * frame it rendered while still keeping every record on disk.
   */
  setStream(stream: NodeJS.WritableStream | null): void;
  /**
   * Observes every record that passes the level filter, on this logger and its
   * children. The hook the CLI uses to surface warnings as toasts.
   */
  onRecord(listener: (record: LogRecord) => void): Unsubscribe;
  /** Flushes and closes the log file, if one is open. */
  close(): Promise<void>;
}

export interface LoggerOptions {
  /** Records below this level are dropped. Defaults to `info`. */
  level?: LogLevel;
  /** Scope tag for the root logger. Defaults to `nightshift`. */
  scope?: string;
  /** Human-readable sink. Defaults to `process.stderr`; pass `null` to silence. */
  stream?: NodeJS.WritableStream | null;
  /** Path to a JSON-lines log file. Every record is written regardless of colour. */
  file?: string | undefined;
  /** Forces ANSI colour on or off. Defaults to auto-detection. */
  color?: boolean;
}

const SEVERITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const LEVEL_STYLE = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  debug: 'magenta',
  trace: 'gray',
} as const satisfies Record<Exclude<LogLevel, 'silent'>, string>;

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && LOG_LEVELS.includes(value as LogLevel);
}

function formatFields(fields: LogFields): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    parts.push(`${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
  return parts.join(' ');
}

/**
 * Creates the root logger. Human output goes to stderr so that command output
 * on stdout stays pipeable; the optional file sink gets JSON lines at full
 * fidelity, which is what `nightshift doctor` points people at.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  let stream = options.stream === undefined ? process.stderr : options.stream;
  let color = shouldUseColor({
    stream,
    ...(options.color !== undefined ? { override: options.color } : {}),
  });

  let level: LogLevel = options.level ?? 'info';
  let file: WriteStream | null = null;
  let fileFailed = false;
  const listeners = new Set<(record: LogRecord) => void>();

  if (options.file) {
    try {
      mkdirSync(dirname(options.file), { recursive: true });
      file = createWriteStream(options.file, { flags: 'a' });
      // A broken log file must never take down the app it is logging for.
      file.on('error', () => {
        fileFailed = true;
        file = null;
      });
    } catch {
      fileFailed = true;
    }
  }

  const write = (record: LogRecord): void => {
    if (stream) {
      const tail = record.fields ? formatFields(record.fields) : '';
      const line =
        `${ansi(color, 'dim', record.time)} ${ansi(color, LEVEL_STYLE[record.level], record.level.padEnd(5))} ` +
        `${ansi(color, 'dim', record.scope)} ${record.message}${tail ? ` ${ansi(color, 'dim', tail)}` : ''}\n`;
      stream.write(line);
    }
    if (file) {
      file.write(`${JSON.stringify(record)}\n`);
    }
    for (const listener of [...listeners]) {
      // A subscriber that throws must not swallow the record or the call that
      // logged it.
      try {
        listener(record);
      } catch {
        /* ignored */
      }
    }
  };

  const make = (scope: string): Logger => {
    const log = (
      recordLevel: Exclude<LogLevel, 'silent'>,
      message: string,
      fields?: LogFields,
    ): void => {
      if (SEVERITY[recordLevel] > SEVERITY[level]) return;
      write({
        time: new Date().toISOString(),
        level: recordLevel,
        scope,
        message,
        ...(fields ? { fields } : {}),
      });
    };

    return {
      get level() {
        return level;
      },
      error: (message, fields) => log('error', message, fields),
      warn: (message, fields) => log('warn', message, fields),
      info: (message, fields) => log('info', message, fields),
      debug: (message, fields) => log('debug', message, fields),
      trace: (message, fields) => log('trace', message, fields),
      child: (childScope) => make(`${scope}:${childScope}`),
      setLevel: (next) => {
        level = next;
      },
      setStream: (next) => {
        stream = next;
        color = shouldUseColor({
          stream: next,
          ...(options.color !== undefined ? { override: options.color } : {}),
        });
      },
      onRecord: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close: () =>
        new Promise<void>((resolve) => {
          if (!file) return resolve();
          const stale = file;
          file = null;
          stale.end(() => resolve());
        }),
    };
  };

  const logger = make(options.scope ?? 'nightshift');
  if (fileFailed && options.file) {
    logger.warn('Log file is unavailable; logging to the terminal only.', { path: options.file });
  }
  return logger;
}

/** A logger that discards everything. Useful in tests. */
export function createNullLogger(): Logger {
  return createLogger({ level: 'silent', stream: null });
}
