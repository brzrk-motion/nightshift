import type { Disposable, Unsubscribe } from './types.js';

/**
 * Collects everything that has to be released when a scope ends — a plugin
 * being unloaded, a widget unmounting, the app shutting down. Disposal runs in
 * reverse order of registration, so resources come down in the order they were
 * built up, and one failure never prevents the rest from being released.
 */
export interface DisposableBag extends Disposable {
  /** Adds a disposable or a plain teardown function. */
  add(disposable: Disposable | Unsubscribe): void;
  readonly size: number;
  readonly disposed: boolean;
}

export interface DisposableBagOptions {
  /** Called for each teardown that throws. Defaults to ignoring the failure. */
  onError?: (error: unknown) => void;
}

function toDisposable(value: Disposable | Unsubscribe): Disposable {
  return typeof value === 'function' ? { dispose: value } : value;
}

export function createDisposableBag(options: DisposableBagOptions = {}): DisposableBag {
  const entries: Disposable[] = [];
  let disposed = false;

  return {
    add(disposable) {
      const entry = toDisposable(disposable);
      // A bag that has already been disposed owns nothing, so anything handed
      // to it afterwards is released immediately rather than leaking.
      if (disposed) {
        void entry.dispose();
        return;
      }
      entries.push(entry);
    },

    get size() {
      return entries.length;
    },

    get disposed() {
      return disposed;
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.reverse()) {
        try {
          await entry.dispose();
        } catch (error) {
          options.onError?.(error);
        }
      }
      entries.length = 0;
    },
  };
}
