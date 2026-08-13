import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationSpec,
  Disposable,
  Entity,
  EntityId,
  Json,
  PluginCommand,
  PluginContext,
  PluginWidget,
} from '@nightshift/sdk';
import { PLAYER_ENTITY, SETTINGS_STORAGE_KEY, type PlayerState } from './entity.js';
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

function fakeContext(init?: { storageData?: Record<string, Json> }) {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const storageData = new Map<string, Json>(Object.entries(init?.storageData ?? {}));
  const disposers: (() => void)[] = [];
  const notify = vi.fn();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: {
      id: 'ambient-noise',
      name: 'Ambient Noise',
      version: '0.1.0',
      apiVersion: 1,
      capabilities: [],
    },
    log: { error() {}, warn() {}, info() {}, debug() {} },
    notify,
    entities: {
      get: <State extends Json = Json>(id: EntityId) => entity(id) as Entity<State> | undefined,
      has: (id) => entities.has(id),
      list: () => [...entities.keys()].map((id) => entity(id)!),
      register: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      update: <State extends Json = Json>(id: EntityId, patch: Partial<State>) => {
        const next = { ...(entities.get(id) as Record<string, Json>), ...patch };
        entities.set(id, next);
        return entity(id)! as Entity<State>;
      },
      set: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      remove: (id) => entities.delete(id),
      subscribe: () => () => {},
      subscribeAll: () => () => {},
      events: undefined as never,
      clear: () => entities.clear(),
    },
    storage: {
      get: async (key) => storageData.get(key) as never,
      set: async (key, value) => void storageData.set(key, value),
      delete: async (key) => void storageData.delete(key),
    },
    fetch: async () => {
      throw new Error('ambient-noise tests do not use network');
    },
    registerCommand: (command) => void commands.set(command.id, command),
    registerWidget: (widget) => void widgets.push(widget),
    registerAutomation: (automation) => void automations.push(automation),
    registerEntity: (id, state) => void entities.set(id, state),
    own: (disposable: Disposable | (() => void)) =>
      void disposers.push(
        typeof disposable === 'function' ? disposable : () => disposable.dispose(),
      ),
  };

  return { context, entities, commands, widgets, automations, storageData, disposers, notify };
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
    const { context, entities, commands, widgets, disposers } = fakeContext();
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
    const { context, entities, commands, disposers } = fakeContext({
      storageData: {
        [SETTINGS_STORAGE_KEY]: { version: 1, currentClipId: 'does-not-exist' },
      },
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
    const { context, automations, disposers } = fakeContext();
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
    const { context, entities, commands, disposers } = fakeContext();
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

  it('wraps next/previous and ignores an unknown select id', async () => {
    const { context, entities, commands, disposers } = fakeContext();
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
    const { context, entities, commands, disposers } = fakeContext();
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
    const { context, entities, commands, disposers } = fakeContext();
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
    const { context, entities, commands, notify, disposers } = fakeContext();
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
    const { context, entities, commands, disposers } = fakeContext();
    await plugin.setup(context);

    await commands.get('ambient-noise.pause')?.run();
    expect(player(entities).status).toBe('paused');
    await commands.get('ambient-noise.play')?.run();
    expect(player(entities).status).toBe('playing');

    for (const dispose of disposers) dispose();
  });

  it('stays paused and toasts when toggle cannot decode, then play can retry', async () => {
    const { context, entities, commands, notify, disposers } = fakeContext();
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
    const { context, disposers } = fakeContext();
    await plugin.setup(context);
    expect(() => {
      for (const dispose of disposers) dispose();
    }).not.toThrow();
  });
});
