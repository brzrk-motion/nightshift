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
import plugin from './index.js';
import { DEFAULT_SESSION_MINUTES, todayKey } from './timer.js';

/**
 * A minimal, in-memory `PluginContext` — enough to exercise `setup()` exactly
 * as the real plugin host would call it, without depending on
 * `@nightshift/services` from a plugin's own test suite.
 */
function fakeContext() {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const disposers: (() => void)[] = [];
  const storageData = new Map<string, Json>();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: {
      id: 'focus',
      name: 'Focus',
      version: '0.1.0',
      apiVersion: 1,
      capabilities: [],
    },
    log: { error() {}, warn() {}, info() {}, debug() {} },
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
      // Not exercised by this plugin.
      events: undefined as never,
      clear: () => entities.clear(),
    },
    storage: {
      get: async (key) => storageData.get(key) as never,
      set: async (key, value) => void storageData.set(key, value),
      delete: async (key) => void storageData.delete(key),
    },
    fetch: async () => {
      throw new Error('focus tests do not use network');
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

  return { context, entities, commands, widgets, automations, storageData, disposers };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('manifest', () => {
  it('declares the capabilities its setup uses', () => {
    expect(plugin.manifest.id).toBe('focus');
    expect(plugin.manifest.capabilities).toEqual([
      'entities:read',
      'entities:write',
      'widgets:register',
      'commands:register',
      'automations:register',
      'storage',
    ]);
  });
});

describe('setup', () => {
  it('registers the entity with a fresh, idle session', async () => {
    const { context, entities } = fakeContext();
    await plugin.setup(context);

    expect(entities.get('timer.focus')).toMatchObject({
      status: 'idle',
      durationSeconds: DEFAULT_SESSION_MINUTES * 60,
      completedToday: 0,
    });
  });

  it('restores today’s count from storage when it was saved today', async () => {
    const { context, entities, storageData } = fakeContext();
    storageData.set('progress', { date: todayKey(), completedToday: 2 });

    await plugin.setup(context);

    expect((entities.get('timer.focus') as { completedToday: number }).completedToday).toBe(2);
  });

  it('ignores a saved count from a previous day', async () => {
    const { context, entities, storageData } = fakeContext();
    storageData.set('progress', { date: '2000-01-01', completedToday: 9 });

    await plugin.setup(context);

    expect((entities.get('timer.focus') as { completedToday: number }).completedToday).toBe(0);
  });

  it('registers start, pause, stop and reset commands', async () => {
    const { context, commands } = fakeContext();
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'focus.pause',
      'focus.reset',
      'focus.start',
      'focus.stop',
    ]);
  });

  it('focus.start begins a session of the requested length', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('focus.start')?.run({ minutes: 50 });

    expect(entities.get('timer.focus')).toMatchObject({
      status: 'running',
      durationSeconds: 3000,
      remainingSeconds: 3000,
    });
  });

  it('focus.start without args uses the default length', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('focus.start')?.run();

    expect((entities.get('timer.focus') as { durationSeconds: number }).durationSeconds).toBe(
      DEFAULT_SESSION_MINUTES * 60,
    );
  });

  it('pause, then start, resumes rather than restarting', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('focus.start')?.run({ minutes: 50 });
    vi.advanceTimersByTime(10_000);
    await commands.get('focus.pause')?.run();
    const pausedRemaining = (entities.get('timer.focus') as { remainingSeconds: number })
      .remainingSeconds;

    await commands.get('focus.start')?.run();

    expect(entities.get('timer.focus')).toMatchObject({
      status: 'running',
      remainingSeconds: pausedRemaining,
    });
  });

  it('focus.stop returns to idle without counting a completed session', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });
    vi.advanceTimersByTime(30_000);

    await commands.get('focus.stop')?.run();

    expect(entities.get('timer.focus')).toMatchObject({ status: 'idle', completedToday: 0 });
  });

  it('focus.reset returns to the default length', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 90 });

    await commands.get('focus.reset')?.run();

    expect((entities.get('timer.focus') as { durationSeconds: number }).durationSeconds).toBe(
      DEFAULT_SESSION_MINUTES * 60,
    );
  });

  it('the interval ticks a running session down every second', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });

    vi.advanceTimersByTime(10_000);

    expect((entities.get('timer.focus') as { remainingSeconds: number }).remainingSeconds).toBe(50);
  });

  it('leaves an idle session untouched by the interval', async () => {
    const { context, entities } = fakeContext();
    await plugin.setup(context);
    const before = entities.get('timer.focus');

    vi.advanceTimersByTime(10_000);

    expect(entities.get('timer.focus')).toEqual(before);
  });

  it('finishing a session saves the new count to storage', async () => {
    const { context, commands, storageData } = fakeContext();
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });

    vi.advanceTimersByTime(60_000);
    await vi.waitFor(() => expect(storageData.get('progress')).toBeTruthy());

    expect(storageData.get('progress')).toMatchObject({ completedToday: 1 });
  });

  it('registers a session widget and a today widget with real renderers', async () => {
    const { context, widgets } = fakeContext();
    await plugin.setup(context);

    const types = widgets.map((widget) => widget.type);
    expect(types).toEqual(['focus.session', 'focus.today']);
    expect(widgets.every((widget) => typeof widget.render === 'function')).toBe(true);
  });

  it('registers an automation that notifies when a session finishes', async () => {
    const { context, automations } = fakeContext();
    await plugin.setup(context);

    expect(automations).toHaveLength(1);
    expect(automations[0]).toMatchObject({
      when: { type: 'entity', entity: 'timer.focus', key: 'status' },
      and: [{ type: 'equals', entity: 'timer.focus', key: 'status', value: 'finished' }],
      then: [{ command: 'app.notify' }],
    });
  });

  it('cleans up the interval when the plugin is torn down', async () => {
    const { context, entities, commands, disposers } = fakeContext();
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });

    for (const dispose of disposers) dispose();
    const before = entities.get('timer.focus');
    vi.advanceTimersByTime(10_000);

    expect(entities.get('timer.focus')).toEqual(before);
  });
});
