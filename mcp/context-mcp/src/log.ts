export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Logs to stderr only. Under the stdio transport stdout carries JSON-RPC
 * frames, so anything written there corrupts the session.
 */
export function createLogger(name: string, enabled = true): Logger {
  const write = (level: string, message: string): void => {
    if (!enabled) return;
    process.stderr.write(`${new Date().toISOString()} ${level} ${name}: ${message}\n`);
  };

  return {
    info: (message) => write('info', message),
    warn: (message) => write('warn', message),
    error: (message) => write('error', message),
  };
}

export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};
