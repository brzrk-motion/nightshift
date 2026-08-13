import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Disposable,
  Entity,
  EntityId,
  Json,
  PluginCommand,
  PluginContext,
  PluginWidget,
} from '@nightshift/sdk';
import plugin from './index.js';
import { METRICS_ENTITY, SETTINGS_ENTITY } from './entity.js';

function fakeContext() {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const storageData = new Map<string, Json>();
  const disposers: (() => void)[] = [];

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: {
      id: 'system-monitor',
      name: 'System Monitor',
      version: '0.1.0',
      apiVersion: 1,
      capabilities: [],
    },
    log: { error() {}, warn() {}, info() {}, debug() {} },
    notify: vi.fn(),
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
      throw new Error('system-monitor tests do not use network');
    },
    registerCommand: (command) => void commands.set(command.id, command),
    registerWidget: (widget) => void widgets.push(widget),
    registerAutomation: () => {},
    registerEntity: (id, state) => void entities.set(id, state),
    own: (disposable: Disposable | (() => void)) =>
      void disposers.push(
        typeof disposable === 'function' ? disposable : () => disposable.dispose(),
      ),
  };

  return { context, entities, commands, widgets, storageData, disposers };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('manifest', () => {
  it('declares storage and widget capabilities', () => {
    expect(plugin.manifest.id).toBe('system-monitor');
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
  it('registers settings and metrics entities', async () => {
    const { context, entities } = fakeContext();
    await plugin.setup(context);

    expect(entities.get(SETTINGS_ENTITY)).toMatchObject({
      version: 1,
      showCpu: true,
      showGpu: true,
      showNetwork: true,
      showRam: true,
    });
    expect(entities.get(METRICS_ENTITY)).toMatchObject({
      intervalMs: 1000,
      metrics: {
        cpu: { status: 'unavailable' },
        gpu: { status: 'unavailable' },
        network: { status: 'unavailable' },
        ram: { status: 'unavailable' },
      },
    });
  });

  it('registers mount, unmount, and settings commands', async () => {
    const { context, commands } = fakeContext();
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'system-monitor.reset-settings',
      'system-monitor.set-graph-enabled',
      'system-monitor.widget-mounted',
      'system-monitor.widget-unmounted',
    ]);
  });

  it('registers the overview widget', async () => {
    const { context, widgets } = fakeContext();
    await plugin.setup(context);

    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({
      type: 'system-monitor.overview',
      entities: [SETTINGS_ENTITY, METRICS_ENTITY],
    });
    expect(typeof widgets[0]?.render).toBe('function');
  });

  it('persists graph toggles via set-graph-enabled', async () => {
    const { context, entities, storageData, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('system-monitor.set-graph-enabled')?.run({ metric: 'ram', enabled: false });

    expect(entities.get(SETTINGS_ENTITY)).toMatchObject({ showRam: false });
    await vi.waitFor(() => expect(storageData.get('settings')).toBeTruthy());
    expect(storageData.get('settings')).toMatchObject({ showRam: false });
  });

  it('starts polling when a widget mounts and stops on unmount', async () => {
    const { context, entities, commands, disposers } = fakeContext();
    await plugin.setup(context);

    await commands.get('system-monitor.widget-mounted')?.run();
    expect((entities.get(METRICS_ENTITY) as { polling: boolean }).polling).toBe(true);

    vi.advanceTimersByTime(1000);
    await vi.waitFor(() =>
      expect((entities.get(METRICS_ENTITY) as { lastUpdatedAt: number | null }).lastUpdatedAt).not.toBeNull(),
    );

    await commands.get('system-monitor.widget-unmounted')?.run();
    expect((entities.get(METRICS_ENTITY) as { polling: boolean }).polling).toBe(false);

    for (const dispose of disposers) dispose();
  });
});
