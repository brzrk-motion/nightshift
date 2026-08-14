import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPluginTestContext } from '@nightshift/sdk/testing';
import { todayKey } from './countdown.js';
import { wireCountdownPlugin } from './wireCountdownPlugin.js';

const ENTITY = 'test.countdown' as const;

interface TestState {
  status: 'idle' | 'running' | 'finished';
  remainingSeconds: number;
  completedToday: number;
  [key: string]: string | number;
}

function initialState(completedToday = 0): TestState {
  return { status: 'idle', remainingSeconds: 3, completedToday };
}

function tick(state: TestState, elapsedSeconds: number): TestState {
  if (state.status !== 'running') return state;
  const remainingSeconds = Math.max(0, state.remainingSeconds - elapsedSeconds);
  if (remainingSeconds > 0) return { ...state, remainingSeconds };
  return {
    ...state,
    status: 'finished',
    remainingSeconds: 0,
    completedToday: state.completedToday + 1,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('wireCountdownPlugin', () => {
  it('registers the entity with fresh state when storage is empty', async () => {
    const { context, entities } = createPluginTestContext();
    await wireCountdownPlugin({
      context,
      entity: { id: ENTITY },
      reducers: { initialState: () => initialState(), tick },
    });

    expect(entities.get(ENTITY)).toEqual(initialState());
  });

  it('restores today’s stored progress', async () => {
    const { context, entities, storageData } = createPluginTestContext();
    storageData.set('progress', { date: todayKey(), completedToday: 2, remainingSeconds: 99 });

    await wireCountdownPlugin({
      context,
      entity: { id: ENTITY },
      reducers: {
        initialState: (stored) =>
          initialState(typeof stored?.completedToday === 'number' ? stored.completedToday : 0),
        tick,
      },
    });

    expect(entities.get(ENTITY)).toMatchObject({ completedToday: 2 });
  });

  it('ignores stored progress from another day', async () => {
    const { context, entities, storageData } = createPluginTestContext();
    storageData.set('progress', { date: '1999-01-01', completedToday: 9 });

    await wireCountdownPlugin({
      context,
      entity: { id: ENTITY },
      reducers: {
        initialState: (stored) =>
          initialState(typeof stored?.completedToday === 'number' ? stored.completedToday : 0),
        tick,
      },
    });

    expect(entities.get(ENTITY)).toMatchObject({ completedToday: 0 });
  });

  it('ignores non-dated storage values', async () => {
    const { context, entities, storageData } = createPluginTestContext();
    storageData.set('progress', { completedToday: 4 });

    await wireCountdownPlugin({
      context,
      entity: { id: ENTITY },
      reducers: {
        initialState: (stored) =>
          initialState(typeof stored?.completedToday === 'number' ? stored.completedToday : 0),
        tick,
      },
    });

    expect(entities.get(ENTITY)).toMatchObject({ completedToday: 0 });
  });

  it('ticks, persists on completion, and cleans up on teardown', async () => {
    const { context, entities, storageData, disposers } = createPluginTestContext();
    const { read, write } = await wireCountdownPlugin({
      context,
      entity: { id: ENTITY },
      reducers: {
        initialState: () => initialState(),
        tick,
        persistOnTick: (_before, after) => after.status === 'finished',
        toStoredProgress: (state) => ({ date: todayKey(), completedToday: state.completedToday }),
      },
    });

    write({ ...read(), status: 'running' });
    vi.advanceTimersByTime(3000);
    await vi.waitFor(() => expect(storageData.get('progress')).toBeTruthy());

    expect(entities.get(ENTITY)).toMatchObject({ status: 'finished', completedToday: 1 });
    expect(storageData.get('progress')).toMatchObject({ date: todayKey(), completedToday: 1 });

    for (const dispose of disposers) dispose();
    const frozen = entities.get(ENTITY);
    vi.advanceTimersByTime(5000);
    expect(entities.get(ENTITY)).toEqual(frozen);
  });
});
