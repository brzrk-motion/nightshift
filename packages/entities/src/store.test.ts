import { describe, expect, it, vi } from 'vitest';
import { isNightshiftError } from '@nightshift/core';
import { createEntityStore } from './store.js';
import { isEntityId } from './types.js';

interface TimerState {
  status: string;
  remainingSeconds: number;
  [key: string]: string | number;
}

function timerStore() {
  let clock = 1_000;
  const store = createEntityStore({ now: () => (clock += 1) });
  store.register<TimerState>(
    'timer.focus',
    { status: 'idle', remainingSeconds: 1500 },
    { title: 'Focus', owner: 'focus' },
  );
  return store;
}

describe('isEntityId', () => {
  it.each(['timer.focus', 'spotify.now-playing', 'a.b'])('accepts %s', (id) => {
    expect(isEntityId(id)).toBe(true);
  });

  it.each(['timer', 'Timer.Focus', '.focus', 'timer.', '1timer.focus', 42])('rejects %s', (id) => {
    expect(isEntityId(id)).toBe(false);
  });
});

describe('createEntityStore', () => {
  it('registers entities and reads them back', () => {
    const store = timerStore();
    const entity = store.get<TimerState>('timer.focus');

    expect(entity?.state.status).toBe('idle');
    expect(entity?.meta.title).toBe('Focus');
    expect(store.has('timer.focus')).toBe(true);
    expect(store.list().map((item) => item.id)).toEqual(['timer.focus']);
  });

  it('registers the entities passed as initial state', () => {
    const store = createEntityStore({
      initial: [{ id: 'app.theme', state: 'midnight' }],
    });
    expect(store.get('app.theme')?.state).toBe('midnight');
  });

  it('rejects a malformed entity id', () => {
    const store = createEntityStore();
    expect(() => store.register('nope' as never, {})).toThrowError(/not a valid entity id/);
  });

  it('merges partial updates into the current state', () => {
    const store = timerStore();
    const updated = store.update<TimerState>('timer.focus', { status: 'running' });

    expect(updated.state).toEqual({ status: 'running', remainingSeconds: 1500 });
  });

  it('replaces the whole state with set()', () => {
    const store = timerStore();
    const updated = store.set<TimerState>('timer.focus', { status: 'idle', remainingSeconds: 60 });

    expect(updated.state).toEqual({ status: 'idle', remainingSeconds: 60 });
  });

  it('produces a new frozen entity on every write', () => {
    const store = timerStore();
    const before = store.get('timer.focus');
    const after = store.update<TimerState>('timer.focus', { remainingSeconds: 1499 });

    expect(after).not.toBe(before);
    expect(before?.state).toEqual({ status: 'idle', remainingSeconds: 1500 });
    expect(Object.isFrozen(after)).toBe(true);
    expect(after.updatedAt).toBeGreaterThan(before?.updatedAt ?? 0);
  });

  it('throws a typed error when updating something that is not registered', () => {
    const store = createEntityStore();
    try {
      store.update('timer.focus', {});
      expect.unreachable('update should have thrown');
    } catch (error) {
      expect(isNightshiftError(error)).toBe(true);
      if (isNightshiftError(error)) expect(error.code).toBe('ENTITY_NOT_FOUND');
    }
  });

  it('notifies subscribers of the entity they asked for, and nothing else', () => {
    const store = timerStore();
    store.register('app.theme', 'midnight');
    const listener = vi.fn();
    store.subscribe<TimerState>('timer.focus', listener);

    store.update<TimerState>('timer.focus', { status: 'running' });
    store.update('app.theme', {});

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0].state.status).toBe('running');
  });

  it('notifies subscribeAll of every change', () => {
    const store = timerStore();
    const listener = vi.fn();
    store.subscribeAll(listener);

    store.update<TimerState>('timer.focus', { status: 'running' });
    store.register('app.theme', 'midnight');

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const store = timerStore();
    const listener = vi.fn();
    const off = store.subscribe('timer.focus', listener);

    off();
    store.update<TimerState>('timer.focus', { status: 'running' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('reports the kind of each change on the bus', () => {
    const store = timerStore();
    const kinds: string[] = [];
    store.events.on('change', (change) => kinds.push(change.kind));

    store.register('app.theme', 'midnight');
    store.update<TimerState>('timer.focus', { status: 'running' });
    store.remove('app.theme');

    expect(kinds).toEqual(['registered', 'updated', 'removed']);
  });

  it('reports the previous state alongside an update', () => {
    const store = timerStore();
    const changes: unknown[] = [];
    store.events.on('updated', (change) => changes.push(change.previous));

    store.update<TimerState>('timer.focus', { status: 'running' });

    expect(changes).toEqual([{ status: 'idle', remainingSeconds: 1500 }]);
  });

  it('removes entities and reports whether anything was removed', () => {
    const store = timerStore();
    expect(store.remove('timer.focus')).toBe(true);
    expect(store.remove('timer.focus')).toBe(false);
    expect(store.get('timer.focus')).toBeUndefined();
  });

  it('clear() removes everything and announces each removal', () => {
    const store = timerStore();
    store.register('app.theme', 'midnight');
    const removed = vi.fn();
    store.events.on('removed', removed);

    store.clear();

    expect(store.list()).toEqual([]);
    expect(removed).toHaveBeenCalledTimes(2);
  });

  it('re-registering an id replaces the entity and its metadata', () => {
    const store = timerStore();
    store.register<TimerState>(
      'timer.focus',
      { status: 'running', remainingSeconds: 10 },
      { title: 'Deep work' },
    );

    expect(store.get<TimerState>('timer.focus')?.state.remainingSeconds).toBe(10);
    expect(store.get('timer.focus')?.meta.title).toBe('Deep work');
    expect(store.list()).toHaveLength(1);
  });
});
