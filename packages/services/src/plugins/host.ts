import {
  createDisposableBag,
  createEventBus,
  NightshiftError,
  type EventBus,
  type Json,
} from '@nightshift/core';
import type { Entity, EntityId, EntityMeta, EntityStore } from '@nightshift/entities';
import type { AutomationSpec } from '@nightshift/automations';
import {
  isCompatible,
  type Capability,
  type NotificationTone,
  type Plugin,
  type PluginCommand,
  type PluginContext,
  type PluginLogger,
  type PluginManifest,
  type PluginWidget,
} from '@nightshift/sdk';
import type { Logger } from '../logger.js';
import { createNullLogger } from '../logger.js';
import { assertCapability, createPermissionPolicy, type PermissionPolicy } from './permissions.js';
import { createPluginStorage } from './storage.js';
import type { PluginSource } from './discovery.js';
import { resolvePluginSpecifier, type ResolveBase } from './resolve.js';

/** A plugin that finished `setup`, and everything it contributed. */
export interface LoadedPlugin {
  manifest: Readonly<PluginManifest>;
  source: PluginSource;
  commands: readonly PluginCommand[];
  widgets: readonly PluginWidget[];
  automations: readonly AutomationSpec[];
  /** Entities the plugin registered, removed again when it unloads. */
  entities: readonly EntityId[];
}

export interface PluginFailure {
  source: PluginSource;
  error: unknown;
}

/**
 * A message a plugin raised through `context.notify`. The host does not know
 * how it gets shown — whoever assembled the runtime listens for these and puts
 * them wherever the user is looking, which for the CLI is the toast stack.
 */
export interface PluginNotification {
  pluginId: string;
  message: string;
  tone: NotificationTone;
  timeout?: number;
  /** The plugin's own key, namespaced so two plugins cannot collide. */
  key?: string;
}

export interface PluginHostEvents extends Record<string, unknown[]> {
  loaded: [plugin: LoadedPlugin];
  unloaded: [id: string];
  failed: [failure: PluginFailure];
  notification: [notification: PluginNotification];
}

export interface PluginHost {
  load(source: PluginSource): Promise<LoadedPlugin>;
  /** Loads every source, collecting failures instead of stopping at the first. */
  loadAll(sources: readonly PluginSource[]): Promise<{
    loaded: LoadedPlugin[];
    failed: PluginFailure[];
  }>;
  unload(id: string): Promise<boolean>;
  unloadAll(): Promise<void>;
  get(id: string): LoadedPlugin | undefined;
  list(): LoadedPlugin[];
  /** Every command contributed by a loaded plugin. */
  commands(): PluginCommand[];
  /** Every widget contributed by a loaded plugin. */
  widgets(): PluginWidget[];
  /** Every automation contributed by a loaded plugin. */
  automations(): AutomationSpec[];
  readonly events: EventBus<PluginHostEvents>;
}

export interface PluginHostOptions {
  entities: EntityStore;
  /** Where per-plugin storage files go. */
  dataDir: string;
  policy?: PermissionPolicy;
  log?: Logger;
  /**
   * Where bare specifiers are resolved from, most specific first — normally
   * the user's config directory and then the application.
   */
  resolveFrom?: readonly ResolveBase[];
  /** Overridable so tests can supply modules without touching the disk. */
  importer?: (specifier: string) => Promise<unknown>;
}

function pluginLogger(log: Logger): PluginLogger {
  return {
    error: (message, fields) => log.error(message, fields),
    warn: (message, fields) => log.warn(message, fields),
    info: (message, fields) => log.info(message, fields),
    debug: (message, fields) => log.debug(message, fields),
  };
}

/** Reads the plugin out of a module, whichever way it was exported. */
function pluginFrom(module: unknown, source: PluginSource): Plugin {
  const candidate =
    (module as { default?: unknown; plugin?: unknown } | null)?.default ??
    (module as { plugin?: unknown } | null)?.plugin;

  const plugin = candidate as Plugin | undefined;
  if (!plugin || typeof plugin.setup !== 'function' || typeof plugin.manifest !== 'object') {
    throw new NightshiftError(
      'PLUGIN_INVALID',
      `"${source.specifier}" does not export a Nightshift plugin.`,
      { hint: 'A plugin module must default-export the result of `definePlugin()`.' },
    );
  }
  return plugin;
}

/**
 * Wraps the entity store so a plugin can only do what it was granted, and so
 * the host knows which entities to take away when the plugin unloads.
 */
function guardEntities(
  entities: EntityStore,
  pluginId: string,
  policy: PermissionPolicy,
  owned: Set<EntityId>,
): EntityStore {
  const read = <T>(fn: () => T): T => {
    assertCapability(policy, pluginId, 'entities:read');
    return fn();
  };
  const write = <T>(fn: () => T): T => {
    assertCapability(policy, pluginId, 'entities:write');
    return fn();
  };

  return {
    get: <State extends Json = Json>(id: EntityId) => read(() => entities.get<State>(id)),
    has: (id) => read(() => entities.has(id)),
    list: () => read(() => entities.list()),
    register: <State extends Json = Json>(id: EntityId, state: State, meta?: EntityMeta) =>
      write(() => {
        owned.add(id);
        return entities.register<State>(id, state, { owner: pluginId, ...meta });
      }),
    update: <State extends Json = Json>(id: EntityId, state: Partial<State>) =>
      write(() => entities.update<State>(id, state)),
    set: <State extends Json = Json>(id: EntityId, state: State) =>
      write(() => entities.set<State>(id, state)),
    remove: (id) =>
      write(() => {
        owned.delete(id);
        return entities.remove(id);
      }),
    subscribe: <State extends Json = Json>(
      id: EntityId,
      listener: (entity: Entity<State>) => void,
    ) => read(() => entities.subscribe<State>(id, listener)),
    subscribeAll: (listener) => read(() => entities.subscribeAll(listener)),
    events: entities.events,
    clear: () => write(() => entities.clear()),
  };
}

/**
 * The plugin host: discovery hands it sources, it imports them, checks the
 * contract and the permissions, runs `setup`, and keeps hold of everything the
 * plugin contributed so it can all be taken back on unload.
 *
 * A plugin that fails at any of those steps is reported and skipped. One bad
 * plugin must never be the reason Nightshift will not start.
 */
export function createPluginHost(options: PluginHostOptions): PluginHost {
  const log = options.log ?? createNullLogger();
  const policy = options.policy ?? createPermissionPolicy();
  const bases = options.resolveFrom ?? [];
  const load =
    options.importer ??
    ((specifier: string) => import(/* @vite-ignore */ resolvePluginSpecifier(specifier, bases)));
  const events = createEventBus<PluginHostEvents>();

  const loaded = new Map<string, LoadedPlugin>();
  const teardowns = new Map<string, () => Promise<void>>();

  const host: PluginHost = {
    async load(source) {
      const module = await load(source.specifier).catch((error: unknown) => {
        throw new NightshiftError('PLUGIN_LOAD_FAILED', `Could not import "${source.specifier}".`, {
          cause: error,
          hint: 'Check that the plugin is installed and that its path is right.',
        });
      });

      const plugin = pluginFrom(module, source);
      const { manifest } = plugin;

      if (loaded.has(manifest.id)) {
        throw new NightshiftError('PLUGIN_INVALID', `Plugin "${manifest.id}" is already loaded.`, {
          hint: 'Two plugins cannot share an id; remove one of them from your config.',
        });
      }

      if (!isCompatible(manifest)) {
        throw new NightshiftError(
          'PLUGIN_INCOMPATIBLE',
          `Plugin "${manifest.id}" targets SDK version ${manifest.apiVersion}.`,
          { hint: 'Update the plugin, or update Nightshift.' },
        );
      }

      const missing = policy.missing(manifest.id, manifest.capabilities);
      if (missing.length > 0) {
        throw new NightshiftError(
          'PERMISSION_DENIED',
          `Plugin "${manifest.id}" needs capabilities it has not been granted: ${missing.join(', ')}.`,
          {
            hint: `Add "${manifest.id}": [${missing.map((entry) => `"${entry}"`).join(', ')}] to "pluginPermissions" in config.json.`,
          },
        );
      }

      const scoped = log.child(manifest.id);
      const owned = new Set<EntityId>();
      const commands: PluginCommand[] = [];
      const widgets: PluginWidget[] = [];
      const automations: AutomationSpec[] = [];
      const bag = createDisposableBag({
        onError: (error) =>
          scoped.warn('A plugin resource failed to dispose', { error: `${error}` }),
      });

      const requires = (capability: Capability): void =>
        assertCapability(policy, manifest.id, capability);

      const context: PluginContext = {
        manifest,
        log: pluginLogger(scoped),
        notify(message, notifyOptions) {
          const trimmed = message.trim();
          if (trimmed === '') return;
          events.emit('notification', {
            pluginId: manifest.id,
            message: trimmed,
            tone: notifyOptions?.tone ?? 'info',
            ...(notifyOptions?.timeout === undefined ? {} : { timeout: notifyOptions.timeout }),
            ...(notifyOptions?.key === undefined
              ? {}
              : { key: `${manifest.id}:${notifyOptions.key}` }),
          });
        },
        entities: guardEntities(options.entities, manifest.id, policy, owned),
        storage: createPluginStorage({ dataDir: options.dataDir, pluginId: manifest.id }),
        registerCommand(command) {
          requires('commands:register');
          commands.push(command);
        },
        registerWidget(widget) {
          requires('widgets:register');
          widgets.push(widget);
        },
        registerAutomation(automation) {
          requires('automations:register');
          automations.push(automation);
        },
        registerEntity(id, state, meta) {
          requires('entities:write');
          owned.add(id);
          options.entities.register(id, state, { owner: manifest.id, ...meta });
        },
        async fetch(url, init) {
          requires('network');
          let parsed: URL;
          try {
            parsed = new URL(url);
          } catch (error) {
            throw new NightshiftError('NETWORK_DENIED', `Invalid URL "${url}".`, {
              cause: error,
              hint: 'Pass an absolute https URL.',
            });
          }
          if (parsed.protocol !== 'https:') {
            throw new NightshiftError(
              'NETWORK_DENIED',
              `Plugin "${manifest.id}" may only fetch https URLs.`,
              { hint: `Refused "${url}".` },
            );
          }
          const signal = init?.signal ?? AbortSignal.timeout(15_000);
          return globalThis.fetch(url, {
            ...(init?.method === undefined ? {} : { method: init.method }),
            ...(init?.headers === undefined ? {} : { headers: init.headers }),
            ...(init?.body === undefined ? {} : { body: init.body }),
            signal,
          });
        },
        own(disposable) {
          bag.add(disposable);
        },
      };

      try {
        await plugin.setup(context);
      } catch (error) {
        // Setup got partway through, so undo whatever it managed to do.
        await bag.dispose();
        for (const id of owned) options.entities.remove(id);
        throw new NightshiftError(
          'PLUGIN_LOAD_FAILED',
          `Plugin "${manifest.id}" failed during setup.`,
          { cause: error },
        );
      }

      const entry: LoadedPlugin = {
        manifest,
        source,
        commands,
        widgets,
        automations,
        entities: [...owned],
      };
      loaded.set(manifest.id, entry);

      teardowns.set(manifest.id, async () => {
        try {
          await plugin.teardown?.();
        } catch (error) {
          scoped.warn('Plugin teardown failed', { error: `${error}` });
        }
        await bag.dispose();
        for (const id of owned) options.entities.remove(id);
      });

      scoped.info('Plugin loaded', {
        version: manifest.version,
        commands: commands.length,
        widgets: widgets.length,
      });
      events.emit('loaded', entry);
      return entry;
    },

    async loadAll(sources) {
      const ok: LoadedPlugin[] = [];
      const failed: PluginFailure[] = [];

      for (const source of sources) {
        try {
          ok.push(await host.load(source));
        } catch (error) {
          const failure = { source, error };
          failed.push(failure);
          log.warn('Plugin failed to load', {
            plugin: source.id,
            error: error instanceof Error ? error.message : `${error}`,
          });
          events.emit('failed', failure);
        }
      }

      return { loaded: ok, failed };
    },

    async unload(id) {
      const teardown = teardowns.get(id);
      if (!teardown) return false;
      teardowns.delete(id);
      loaded.delete(id);
      await teardown();
      events.emit('unloaded', id);
      return true;
    },

    async unloadAll() {
      for (const id of [...teardowns.keys()]) await host.unload(id);
    },

    get: (id) => loaded.get(id),
    list: () => [...loaded.values()],
    commands: () => [...loaded.values()].flatMap((entry) => [...entry.commands]),
    widgets: () => [...loaded.values()].flatMap((entry) => [...entry.widgets]),
    automations: () => [...loaded.values()].flatMap((entry) => [...entry.automations]),
    events,
  };

  return host;
}
