import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { HABIT_ENTITY } from './entity.js';
import { STORAGE_KEY, STORAGE_VERSION } from './storage.js';

function fakeContext(storageSeed?: Json) {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const disposers: (() => void)[] = [];
  const storageData = new Map<string, Json>();
  if (storageSeed !== undefined) storageData.set(STORAGE_KEY, storageSeed);
  const notify = vi.fn();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: {
      id: 'habit',
      name: 'Habit Tracker',
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
      set: async (key, value) => {
        storageData.set(key, value);
      },
      delete: async (key) => {
        storageData.delete(key);
      },
    },
    fetch: async () => {
      throw new Error('habit tests do not use network');
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

  return { context, entities, commands, widgets, storageData };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('manifest', () => {
  it('declares the capabilities its setup uses', () => {
    expect(plugin.manifest.id).toBe('habit');
    expect(plugin.manifest.capabilities).toEqual([
      'entities:read',
      'entities:write',
      'widgets:register',
      'commands:register',
      'storage',
    ]);
  });
});

describe('setup', () => {
  it('registers the entity, commands and widget without throwing on corrupt storage', async () => {
    const { context, entities, commands, widgets } = fakeContext({
      version: 99,
      habits: 'nope',
    } as unknown as Json);

    await expect(plugin.setup(context)).resolves.toBeUndefined();

    expect(entities.get(HABIT_ENTITY)).toEqual({ habits: [], completions: {} });
    expect([...commands.keys()].sort()).toEqual([
      'habit.add',
      'habit.remove',
      'habit.rename',
      'habit.toggle',
    ]);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ type: 'habit.tracker', entities: [HABIT_ENTITY] });
    expect(typeof widgets[0]?.render).toBe('function');
  });

  it('hydrates habits from storage', async () => {
    const { context, entities } = fakeContext({
      version: STORAGE_VERSION,
      habits: [{ id: 'h1', name: 'Water', createdAt: '2026-08-11T00:00:00.000Z' }],
      completions: { h1: ['2026-08-11'] },
    });

    await plugin.setup(context);

    expect(entities.get(HABIT_ENTITY)).toEqual({
      habits: [{ id: 'h1', name: 'Water', createdAt: '2026-08-11T00:00:00.000Z' }],
      completions: { h1: ['2026-08-11'] },
    });
  });

  it('habit.add writes through entity and storage', async () => {
    const { context, entities, commands, storageData } = fakeContext();
    await plugin.setup(context);

    await commands.get('habit.add')?.run({ name: 'Meditate' });

    const state = entities.get(HABIT_ENTITY) as {
      habits: { id: string; name: string }[];
      completions: Record<string, string[]>;
    };
    expect(state.habits).toHaveLength(1);
    expect(state.habits[0]?.name).toBe('Meditate');
    await vi.waitFor(() => {
      const stored = storageData.get(STORAGE_KEY) as { habits: { name: string }[] };
      expect(stored.habits[0]?.name).toBe('Meditate');
    });
  });

  it('habit.add ignores blank names', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('habit.add')?.run({ name: '   ' });

    expect(entities.get(HABIT_ENTITY)).toEqual({ habits: [], completions: {} });
  });
});
