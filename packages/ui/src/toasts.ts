import type { Unsubscribe } from '@nightshift/core';

/**
 * Transient notifications. Kept out of the component so the shell can raise a
 * toast from a command, a plugin error or an automation without holding a
 * React reference — and so the expiry logic is testable with a fake clock.
 */
export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Milliseconds to stay on screen. `0` keeps it until dismissed. */
  timeout: number;
  createdAt: number;
  /** Identity across pushes; see `ToastOptions.key`. */
  key?: string;
}

export interface ToastOptions {
  tone?: ToastTone;
  timeout?: number;
  /**
   * Identity for a recurring notification. A push with a key already on screen
   * replaces that toast instead of stacking a copy — which is what keeps a
   * failing poll from burying the dashboard in identical warnings.
   */
  key?: string;
}

export interface ToastStore {
  list(): readonly Toast[];
  /** Shows a toast and returns its id, so it can be dismissed early. */
  push(message: string, options?: ToastOptions): number;
  dismiss(id: number): void;
  clear(): void;
  subscribe(listener: (toasts: readonly Toast[]) => void): Unsubscribe;
  /** Releases the timers this store owns. */
  dispose(): void;
}

export interface ToastStoreOptions {
  /** How long a toast lasts by default. */
  defaultTimeout?: number;
  /** Oldest toasts are dropped past this many. */
  max?: number;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function createToastStore(options: ToastStoreOptions = {}): ToastStore {
  const defaultTimeout = options.defaultTimeout ?? 4000;
  const max = options.max ?? 4;
  const now = options.now ?? Date.now;
  const setTimer =
    options.setTimer ??
    ((callback, ms) => {
      const handle = setTimeout(callback, ms);
      // A pending toast must never be the reason the process stays alive.
      handle.unref?.();
      return handle;
    });
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));

  let toasts: Toast[] = [];
  let nextId = 1;
  const timers = new Map<number, unknown>();
  const listeners = new Set<(toasts: readonly Toast[]) => void>();

  const publish = (): void => {
    const snapshot = Object.freeze([...toasts]);
    for (const listener of [...listeners]) listener(snapshot);
  };

  const drop = (id: number): void => {
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimer(timer);
      timers.delete(id);
    }
    toasts = toasts.filter((toast) => toast.id !== id);
  };

  return {
    list: () => toasts,

    push(message, toastOptions = {}) {
      const id = nextId++;
      const toast: Toast = {
        id,
        tone: toastOptions.tone ?? 'info',
        message,
        timeout: toastOptions.timeout ?? defaultTimeout,
        createdAt: now(),
        ...(toastOptions.key === undefined ? {} : { key: toastOptions.key }),
      };

      if (toast.key !== undefined) {
        const previous = toasts.find((entry) => entry.key === toast.key);
        if (previous) drop(previous.id);
      }

      toasts = [...toasts, toast];
      while (toasts.length > max) {
        const oldest = toasts[0];
        if (!oldest) break;
        drop(oldest.id);
      }

      if (toast.timeout > 0) {
        timers.set(
          id,
          setTimer(() => {
            drop(id);
            publish();
          }, toast.timeout),
        );
      }

      publish();
      return id;
    },

    dismiss(id) {
      if (!toasts.some((toast) => toast.id === id)) return;
      drop(id);
      publish();
    },

    clear() {
      for (const toast of [...toasts]) drop(toast.id);
      publish();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      for (const timer of timers.values()) clearTimer(timer);
      timers.clear();
      listeners.clear();
      toasts = [];
    },
  };
}
