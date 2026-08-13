import { vi, type Mock } from 'vitest';
import { NIGHTSHIFT_API_VERSION } from '@nightshift/core';
import type { AutomationSpec } from '@nightshift/automations';
import type { Entity, EntityId } from '@nightshift/entities';
import type {
  Disposable,
  Json,
  PluginCommand,
  PluginContext,
  PluginManifest,
  PluginWidget,
} from './index.js';

export interface CreatePluginTestContextOptions {
  /** Manifest the plugin under test would receive from the host. */
  manifest?: PluginManifest;
  /** Initial `context.storage` entries, keyed by storage key. */
  storageData?: Record<string, Json>;
  /** Overrides `context.fetch`; defaults to rejecting with `fetchErrorMessage`. */
  fetch?: PluginContext['fetch'];
  /** Message for the default rejecting `fetch` implementation. */
  fetchErrorMessage?: string;
}

export interface PluginTestContext {
  context: PluginContext;
  entities: Map<string, Json>;
  commands: Map<string, PluginCommand>;
  widgets: PluginWidget[];
  automations: AutomationSpec[];
  storageData: Map<string, Json>;
  disposers: (() => void)[];
  notify: Mock<PluginContext['notify']>;
}

/**
 * A minimal, in-memory `PluginContext` — enough to exercise `setup()` exactly
 * as the real plugin host would call it, without depending on
 * `@nightshift/services` from a plugin's own test suite.
 */
export function createPluginTestContext(
  options: CreatePluginTestContextOptions = {},
): PluginTestContext {
  const {
    manifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '0.0.0',
      apiVersion: NIGHTSHIFT_API_VERSION,
      capabilities: [],
    },
    storageData: storageSeed = {},
    fetch: fetchImpl,
    fetchErrorMessage = 'unexpected fetch in plugin test',
  } = options;

  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const disposers: (() => void)[] = [];
  const storageData = new Map<string, Json>(Object.entries(storageSeed));
  const notify = vi.fn<PluginContext['notify']>();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest,
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
    fetch:
      fetchImpl ??
      (async () => {
        throw new Error(fetchErrorMessage);
      }),
    registerCommand: (command) => void commands.set(command.id, command),
    registerWidget: (widget) => void widgets.push(widget),
    registerAutomation: (automation) => void automations.push(automation),
    registerEntity: (id, state) => void entities.set(id, state),
    own: (disposable: Disposable | (() => void)) =>
      void disposers.push(
        typeof disposable === 'function' ? disposable : () => disposable.dispose(),
      ),
  };

  return {
    context,
    entities,
    commands,
    widgets,
    automations,
    storageData,
    disposers,
    notify,
  };
}
