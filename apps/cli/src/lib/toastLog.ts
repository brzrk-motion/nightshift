import type { LogRecord, Logger } from '@nightshift/services';
import type { ToastStore } from '@nightshift/ui';

/**
 * Bridging the logger to the toast stack for as long as a dashboard owns the
 * terminal.
 *
 * OpenTUI draws the whole screen; anything else writing to stderr lands on top
 * of the rendered frame and stays there, so a plugin logging a failed request
 * every few seconds scribbles over the dashboard. Detaching the logger's
 * terminal sink fixes the mess but would also hide real problems — the file
 * sink is not somewhere a user is looking — so the records worth seeing come
 * back as toasts instead.
 *
 * This lives in the CLI because it is the only layer that knows about both a
 * `Logger` (services) and a `ToastStore` (ui).
 */
export interface AttachLogToastsOptions {
  log: Logger;
  toasts: ToastStore;
  /** Sink to put back on detach. Defaults to `process.stderr`. */
  restoreStream?: NodeJS.WritableStream | null;
  /** How long a log toast stays up. */
  timeout?: number;
}

const TONES = { warn: 'warning', error: 'danger' } as const;

/** The message, plus the `error` field the message usually defers the detail to. */
function toastMessage(record: LogRecord): string {
  const detail = record.fields?.['error'];
  return typeof detail === 'string' && detail !== ''
    ? `${record.message}: ${detail}`
    : record.message;
}

export function attachLogToasts({
  log,
  toasts,
  restoreStream = process.stderr,
  timeout = 8000,
}: AttachLogToastsOptions): () => void {
  log.setStream(null);

  const off = log.onRecord((record) => {
    const tone = TONES[record.level as keyof typeof TONES];
    if (tone === undefined) return;
    toasts.push(toastMessage(record), {
      tone,
      timeout,
      // A poll that fails every few seconds is one problem, not hundreds: the
      // scope and message identify it, so a repeat replaces the toast already
      // on screen instead of burying the dashboard in copies.
      key: `log:${record.scope}:${record.message}`,
    });
  });

  return () => {
    off();
    log.setStream(restoreStream);
  };
}
