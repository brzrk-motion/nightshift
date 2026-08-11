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
import { POMODORO_ENTITY } from './entity.js';
import { DEFAULT_WORK_MINUTES, todayKey } from './timer.js';

function fakeContext() {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const disposers: (() => void)[] = [];
  const storageData = new Map<string, Json>();
  const notify = vi.fn();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: {
      id: 'pomodoro',
      name: 'Pomodoro',
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
      throw new Error('pomodoro tests do not use network');
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
    expect(plugin.manifest.id).toBe('pomodoro');
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

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'idle',
      phase: 'work',
      completedPomodorosToday: 0,
    });
  });

  it('restores today’s count and cycle from storage', async () => {
    const { context, entities, storageData } = fakeContext();
    storageData.set('progress', { date: todayKey(), completedPomodorosToday: 2, cycleCount: 1 });

    await plugin.setup(context);

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      completedPomodorosToday: 2,
      cycleCount: 1,
    });
  });

  it('registers start, pause, stop, reset and skip commands', async () => {
    const { context, commands } = fakeContext();
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'pomodoro.pause',
      'pomodoro.reset',
      'pomodoro.skip',
      'pomodoro.start',
      'pomodoro.stop',
    ]);
  });

  it('pomodoro.start begins a work interval', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('pomodoro.start')?.run();

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'running',
      phase: 'work',
      durationSeconds: DEFAULT_WORK_MINUTES * 60,
    });
  });

  it('completing work queues a break and saves progress', async () => {
    const { context, entities, commands, storageData } = fakeContext();
    await plugin.setup(context);
    await commands.get('pomodoro.start')?.run();

    vi.advanceTimersByTime(DEFAULT_WORK_MINUTES * 60_000);
    await vi.waitFor(() => expect(storageData.get('progress')).toBeTruthy());

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'phaseComplete',
      pendingPhase: 'shortBreak',
      completedPomodorosToday: 1,
    });
  });

  it('pomodoro.skip moves to a break without counting a pomodoro', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);
    await commands.get('pomodoro.start')?.run();

    await commands.get('pomodoro.skip')?.run();

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'running',
      phase: 'shortBreak',
      completedPomodorosToday: 0,
    });
  });

  it('registers session and today widgets with renderers', async () => {
    const { context, widgets } = fakeContext();
    await plugin.setup(context);

    expect(widgets.map((widget) => widget.type)).toEqual(['pomodoro.session', 'pomodoro.today']);
    expect(widgets.every((widget) => typeof widget.render === 'function')).toBe(true);
  });

  it('registers automations for work and break completion', async () => {
    const { context, automations } = fakeContext();
    await plugin.setup(context);

    expect(automations).toHaveLength(3);
    expect(automations.map((automation) => automation.name)).toEqual([
      'pomodoro.notify-work-complete',
      'pomodoro.notify-short-break-complete',
      'pomodoro.notify-long-break-complete',
    ]);
  });

  it('cleans up the interval when torn down', async () => {
    const { context, entities, commands, disposers } = fakeContext();
    await plugin.setup(context);
    await commands.get('pomodoro.start')?.run();

    for (const dispose of disposers) dispose();
    const before = entities.get(POMODORO_ENTITY);
    vi.advanceTimersByTime(10_000);

    expect(entities.get(POMODORO_ENTITY)).toEqual(before);
  });
});
