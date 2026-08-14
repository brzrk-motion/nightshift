import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPluginTestContext } from '@nightshift/sdk/testing';
import type { Json } from '@nightshift/sdk';
import { PLAYER_ENTITY, SETTINGS_STORAGE_KEY, LEVELS_MS, type PlayerState } from './entity.js';
import type { PcmBuffer } from './wav.js';

const loadGate = vi.hoisted(() => ({
  entered: 0,
  failNext: false,
  wait: null as Promise<void> | null,
}));

vi.mock('./decode.js', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    loadClip: (bytes: Uint8Array) => Promise<PcmBuffer>;
  };
  return {
    ...actual,
    loadClip: async (bytes: Uint8Array) => {
      loadGate.entered += 1;
      if (loadGate.wait) await loadGate.wait;
      if (loadGate.failNext) {
        loadGate.failNext = false;
        throw new Error('decode failed');
      }
      return actual.loadClip(bytes);
    },
  };
});

const { default: plugin } = await import('./index.js');

function ambientNoiseTestContext(storageData?: Record<string, Json>) {
  return createPluginTestContext({
    manifest: plugin.manifest,
    ...(storageData ? { storageData } : {}),
    fetchErrorMessage: 'ambient-noise tests do not use network',
  });
}

function player(entities: Map<string, Json>): PlayerState {
  return entities.get(PLAYER_ENTITY) as PlayerState;
}

beforeEach(() => {
  vi.useFakeTimers();
  loadGate.entered = 0;
  loadGate.failNext = false;
  loadGate.wait = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ambient-noise plugin', () => {
  it('declares automations among its capabilities', () => {
    expect(plugin.manifest.capabilities).toContain('automations:register');
  });

  it('registers the player entity, commands, and widget without auto-playing', async () => {
    const { context, entities, commands, widgets, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);

    expect(plugin.manifest.id).toBe('ambient-noise');
    expect(entities.has(PLAYER_ENTITY)).toBe(true);
    const state = player(entities);
    expect(state.status === 'paused' || state.status === 'empty').toBe(true);
    expect(state.status).not.toBe('playing');
    expect(commands.has('ambient-noise.play')).toBe(true);
    expect(commands.has('ambient-noise.pause')).toBe(true);
    expect(commands.has('ambient-noise.toggle')).toBe(true);
    expect(commands.has('ambient-noise.next')).toBe(true);
    expect(commands.has('ambient-noise.previous')).toBe(true);
    expect(widgets.some((widget) => widget.type === 'ambient-noise.player')).toBe(true);

    for (const dispose of disposers) dispose();
  });

  it('starts paused and can play when the stored clip id is missing', async () => {
    const { context, entities, commands, disposers } = ambientNoiseTestContext({
      [SETTINGS_STORAGE_KEY]: { version: 1, currentClipId: 'does-not-exist' },
    });
    await plugin.setup(context);
    const state = player(entities);
    expect(state.status).toBe('paused');
    expect(state.currentClipId).not.toBe('does-not-exist');
    expect(state.clips.find((clip) => clip.id === state.currentClipId)?.status).toBe('ok');

    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');

    for (const dispose of disposers) dispose();
  });

  it('pauses Spotify when ambient playback starts', async () => {
    const { context, automations, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);

    expect(automations).toHaveLength(1);
    expect(automations[0]).toMatchObject({
      name: 'ambient-noise.pause-spotify',
      when: { type: 'entity', entity: PLAYER_ENTITY, key: 'status' },
      and: [
        { type: 'equals', entity: PLAYER_ENTITY, key: 'status', value: 'playing' },
        { type: 'equals', entity: PLAYER_ENTITY, key: 'output', value: 'device' },
      ],
      then: [{ command: 'spotify.pause' }],
    });

    for (const dispose of disposers) dispose();
  });

  it('play, pause, and toggle mutate player status with a silent sink', async () => {
    const { context, entities, commands, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    expect(player(entities).clips.length).toBeGreaterThan(0);
    expect(player(entities).status).not.toBe('empty');

    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');
    expect(player(entities).output === 'silent' || player(entities).output === 'device').toBe(true);

    await commands.get('ambient-noise.pause')?.run();
    expect(player(entities).status).toBe('paused');

    await commands.get('ambient-noise.toggle')?.run();
    expect(player(entities).status).toBe('playing');
    await commands.get('ambient-noise.toggle')?.run();
    expect(player(entities).status).toBe('paused');

    for (const dispose of disposers) dispose();
  });

  it('publishes levels from a UI clock, not by mixing on that timer', async () => {
    const { context, entities, commands, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');
    const before = player(entities).levels.length;
    await vi.advanceTimersByTimeAsync(LEVELS_MS * 3);
    expect(player(entities).status).toBe('playing');
    expect(player(entities).levels.length).toBeGreaterThanOrEqual(before);
    await commands.get('ambient-noise.pause')?.run();
    const pausedLevels = player(entities).levels.length;
    await vi.advanceTimersByTimeAsync(LEVELS_MS * 3);
    expect(player(entities).status).toBe('paused');
    expect(player(entities).levels.length).toBe(pausedLevels);

    for (const dispose of disposers) dispose();
  });

  it('can pause and play again without getting stuck behind an in-flight drain', async () => {
    const { context, entities, commands, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');
    await commands.get('ambient-noise.pause')?.run();
    expect(player(entities).status).toBe('paused');
    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');
    await vi.advanceTimersByTimeAsync(LEVELS_MS * 2);
    expect(player(entities).status).toBe('playing');
    expect(player(entities).levels.length).toBeGreaterThan(0);

    for (const dispose of disposers) dispose();
  });

  it('wraps next/previous and ignores an unknown select id', async () => {
    const { context, entities, commands, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    const first = player(entities);
    expect(first.clips.filter((clip) => clip.status === 'ok').length).toBeGreaterThanOrEqual(2);

    const startId = first.currentClipId;
    await commands.get('ambient-noise.next')?.run();
    const afterNext = player(entities);
    expect(afterNext.currentClipId).not.toBe(startId);
    expect(afterNext.currentName).not.toBe('');
    expect(afterNext.status).toBe('paused');

    await commands.get('ambient-noise.previous')?.run();
    expect(player(entities).currentClipId).toBe(startId);

    const last = first.clips[first.clips.length - 1];
    if (last) {
      await commands.get('ambient-noise.select')?.run({ id: last.id });
      expect(player(entities).currentClipId).toBe(last.id);
    }
    await commands.get('ambient-noise.select')?.run({ id: 'does-not-exist' });
    expect(player(entities).currentClipId).toBe(last?.id ?? startId);

    for (const dispose of disposers) dispose();
  });

  it('crossfades when next runs during playback', async () => {
    const { context, entities, commands, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    expect(
      player(entities).clips.filter((clip) => clip.status === 'ok').length,
    ).toBeGreaterThanOrEqual(2);

    await commands.get('ambient-noise.play')?.run();
    const startId = player(entities).currentClipId;
    await commands.get('ambient-noise.next')?.run();
    const after = player(entities);
    expect(after.currentClipId).not.toBe(startId);
    expect(after.status === 'fading' || after.status === 'playing').toBe(true);

    for (const dispose of disposers) dispose();
  });

  it('does not start playback if pause arrives while a clip is still loading', async () => {
    vi.useRealTimers();
    const { context, entities, commands, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    expect(player(entities).clips.length).toBeGreaterThan(0);

    let release!: () => void;
    loadGate.wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const playRun = commands.get('ambient-noise.play')?.run() ?? Promise.resolve();
    expect(player(entities).status).toBe('loading');
    await commands.get('ambient-noise.pause')?.run();
    release();
    await playRun;
    expect(player(entities).status).toBe('paused');

    for (const dispose of disposers) dispose();
  });

  it('keeps playing the current clip when a skip load fails', async () => {
    const { context, entities, commands, notify, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    expect(
      player(entities).clips.filter((clip) => clip.status === 'ok').length,
    ).toBeGreaterThanOrEqual(2);

    await commands.get('ambient-noise.play')?.run();
    const startId = player(entities).currentClipId;
    loadGate.failNext = true;
    await commands.get('ambient-noise.next')?.run();
    expect(player(entities).status).toBe('playing');
    expect(player(entities).currentClipId).toBe(startId);
    expect(notify).toHaveBeenCalled();

    for (const dispose of disposers) dispose();
  });

  it('does not cancel an in-flight play when pause is a no-op', async () => {
    vi.useRealTimers();
    const { context, entities, commands, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);

    await commands.get('ambient-noise.pause')?.run();
    expect(player(entities).status).toBe('paused');
    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');

    for (const dispose of disposers) dispose();
  });

  it('stays paused and toasts when toggle cannot decode, then play can retry', async () => {
    const { context, entities, commands, notify, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    loadGate.failNext = true;
    await commands.get('ambient-noise.toggle')?.run();
    expect(player(entities).status).toBe('paused');
    expect(player(entities).error).toMatch(/could not load/i);
    expect(notify).toHaveBeenCalled();

    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');
    expect(player(entities).error).toBeNull();

    for (const dispose of disposers) dispose();
  });

  it('teardown closes the mixer without throwing', async () => {
    const { context, disposers } = ambientNoiseTestContext();
    await plugin.setup(context);
    expect(() => {
      for (const dispose of disposers) dispose();
    }).not.toThrow();
  });
});
