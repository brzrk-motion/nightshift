import { Writable } from 'node:stream';
import { createLogger } from '@nightshift/services';
import { createToastStore } from '@nightshift/ui';
import { describe, expect, it } from 'vitest';
import { attachLogToasts } from './toastLog.js';

function captureStream(): { stream: Writable; text: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return { stream, text: () => chunks.join('') };
}

function harness() {
  const { stream, text } = captureStream();
  const log = createLogger({ level: 'info', stream, color: false });
  const toasts = createToastStore({ setTimer: () => undefined, clearTimer: () => undefined });
  const detach = attachLogToasts({ log, toasts, restoreStream: stream });
  return { log, toasts, text, detach };
}

describe('attachLogToasts', () => {
  it('keeps log lines off the terminal while attached', () => {
    const { log, text, detach } = harness();
    log.warn('drawn over the dashboard');
    expect(text()).toBe('');
    detach();
    log.warn('back on stderr');
    expect(text()).toContain('back on stderr');
  });

  it('raises warnings and errors as toasts', () => {
    const { log, toasts } = harness();
    log.warn('Spotify request failed');
    log.error('Everything is on fire');
    expect(toasts.list().map((toast) => [toast.tone, toast.message])).toEqual([
      ['warning', 'Spotify request failed'],
      ['danger', 'Everything is on fire'],
    ]);
  });

  it('leaves quieter levels to the log file', () => {
    const { log, toasts } = harness();
    log.info('Opening dashboard');
    log.debug('Dashboard switched');
    expect(toasts.list()).toHaveLength(0);
  });

  it('includes the error field, which carries the detail', () => {
    const { log, toasts } = harness();
    log.warn('Spotify request failed', { error: 'Restriction violated' });
    expect(toasts.list()[0]?.message).toBe('Spotify request failed: Restriction violated');
  });

  it('replaces rather than stacks a repeating failure', () => {
    const { log, toasts } = harness();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      log.warn('Spotify request failed', { error: 'Restriction violated' });
    }
    expect(toasts.list()).toHaveLength(1);
  });

  it('keeps distinct failures apart', () => {
    const { log, toasts } = harness();
    log.warn('Spotify request failed');
    log.child('weather').warn('Weather refresh failed');
    expect(toasts.list()).toHaveLength(2);
  });

  it('stops toasting once detached', () => {
    const { log, toasts, detach } = harness();
    detach();
    log.error('after the dashboard closed');
    expect(toasts.list()).toHaveLength(0);
  });
});
