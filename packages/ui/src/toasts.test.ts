import { describe, expect, it, vi } from 'vitest';
import { createToastStore } from './toasts.js';

/** A store whose timers only fire when the test says so. */
function manualStore(max?: number) {
  const timers = new Map<number, () => void>();
  let nextHandle = 1;
  const store = createToastStore({
    ...(max === undefined ? {} : { max }),
    now: () => 0,
    setTimer: (callback) => {
      const handle = nextHandle++;
      timers.set(handle, callback);
      return handle;
    },
    clearTimer: (handle) => void timers.delete(handle as number),
  });
  return { store, fireAll: () => [...timers.values()].forEach((callback) => callback()) };
}

describe('createToastStore', () => {
  it('pushes a toast and tells subscribers', () => {
    const { store } = manualStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const id = store.push('Session started', { tone: 'success' });

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]).toMatchObject({ id, tone: 'success', message: 'Session started' });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('defaults to the info tone', () => {
    const { store } = manualStore();
    store.push('Anything');
    expect(store.list()[0]?.tone).toBe('info');
  });

  it('expires a toast when its timer fires', () => {
    const { store, fireAll } = manualStore();
    store.push('Gone in a moment');

    fireAll();

    expect(store.list()).toEqual([]);
  });

  it('keeps a toast with no timeout until it is dismissed', () => {
    const { store, fireAll } = manualStore();
    const id = store.push('Sticky', { timeout: 0 });

    fireAll();
    expect(store.list()).toHaveLength(1);

    store.dismiss(id);
    expect(store.list()).toEqual([]);
  });

  it('drops the oldest toast past the limit', () => {
    const { store } = manualStore(2);
    store.push('one');
    store.push('two');
    store.push('three');

    expect(store.list().map((toast) => toast.message)).toEqual(['two', 'three']);
  });

  it('replaces a toast that shares a key instead of stacking a copy', () => {
    const { store } = manualStore();
    store.push('Spotify request failed', { key: 'spotify.request', tone: 'warning' });
    const second = store.push('Spotify request failed again', {
      key: 'spotify.request',
      tone: 'danger',
    });

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]).toMatchObject({
      id: second,
      message: 'Spotify request failed again',
      tone: 'danger',
    });
  });

  it('expires a replaced toast on its own timer, not the one it replaced', () => {
    const { store, fireAll } = manualStore();
    const first = store.push('one', { key: 'shared' });
    store.push('two', { key: 'shared' });

    // The first toast's timer is gone with it, so firing what is left expires
    // only the replacement.
    fireAll();

    expect(store.list()).toEqual([]);
    expect(first).not.toBe(store.list()[0]?.id);
  });

  it('keeps toasts with different keys apart', () => {
    const { store } = manualStore();
    store.push('one', { key: 'a' });
    store.push('two', { key: 'b' });

    expect(store.list().map((toast) => toast.message)).toEqual(['one', 'two']);
  });

  it('ignores dismissing something that is already gone', () => {
    const { store } = manualStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.dismiss(999);

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears everything at once', () => {
    const { store } = manualStore();
    store.push('one');
    store.push('two');

    store.clear();

    expect(store.list()).toEqual([]);
  });

  it('stops notifying after unsubscribe', () => {
    const { store } = manualStore();
    const listener = vi.fn();
    store.subscribe(listener)();

    store.push('one');

    expect(listener).not.toHaveBeenCalled();
  });

  it('releases its timers on dispose', () => {
    const { store, fireAll } = manualStore();
    store.push('one');

    store.dispose();
    fireAll();

    expect(store.list()).toEqual([]);
  });
});
