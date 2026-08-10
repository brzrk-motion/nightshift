import {
  NIGHTSHIFT_API_VERSION,
  NightshiftError,
  type Disposable,
  type Json,
} from '@nightshift/core';
import type { EntityId, EntityMeta, EntityStore } from '@nightshift/entities';

/**
 * The public plugin interface. This module is the *only* thing a plugin is
 * allowed to import from Nightshift — everything the runtime offers arrives
 * through the context object passed to `setup`.
 */

/** Capabilities a plugin must ask for, and the user must grant. */
export type Capability =
  | 'entities:read'
  | 'entities:write'
  | 'widgets:register'
  | 'commands:register'
  | 'network'
  | 'storage'
  | 'shell';

export interface PluginManifest {
  /** Unique, kebab-case plugin id, e.g. `focus`. */
  id: string;
  /** Name shown in the UI. */
  name: string;
  version: string;
  description?: string;
  /** SDK contract version this plugin was built against. */
  apiVersion: number;
  /** Capabilities the plugin needs; anything else is denied at runtime. */
  capabilities: Capability[];
}

export interface PluginLogger {
  error(message: string, fields?: Record<string, Json | undefined>): void;
  warn(message: string, fields?: Record<string, Json | undefined>): void;
  info(message: string, fields?: Record<string, Json | undefined>): void;
  debug(message: string, fields?: Record<string, Json | undefined>): void;
}

/** A command a plugin contributes to the command palette. */
export interface PluginCommand {
  id: string;
  title: string;
  run(): void | Promise<void>;
}

/** A widget a plugin contributes to the dashboard widget registry. */
export interface PluginWidget {
  /** Widget type referenced from a dashboard file, e.g. `focus.session`. */
  type: string;
  title: string;
  /** Entities the widget reads; the runtime re-renders when they change. */
  entities: EntityId[];
}

/** Everything the runtime grants a plugin at setup time. */
export interface PluginContext {
  manifest: Readonly<PluginManifest>;
  log: PluginLogger;
  /** Present when `entities:read` or `entities:write` was granted. */
  entities: EntityStore;
  /** Per-plugin key/value storage. Present when `storage` was granted. */
  storage: PluginStorage;
  registerCommand(command: PluginCommand): void;
  registerWidget(widget: PluginWidget): void;
  registerEntity<State extends Json>(id: EntityId, state: State, meta?: EntityMeta): void;
  /** Ties a resource to the plugin's lifetime; disposed on teardown. */
  own(disposable: Disposable): void;
}

export interface PluginStorage {
  get<T extends Json>(key: string): Promise<T | undefined>;
  set(key: string, value: Json): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Plugin {
  manifest: Readonly<PluginManifest>;
  /** Called once when the plugin is loaded. */
  setup(context: PluginContext): void | Promise<void>;
  /** Called when the plugin is unloaded or the app shuts down. */
  teardown?(): void | Promise<void>;
}

export interface PluginDefinition extends Omit<PluginManifest, 'apiVersion'> {
  apiVersion?: number;
  setup: Plugin['setup'];
  teardown?: Plugin['teardown'];
}

const PLUGIN_ID = /^[a-z][a-z0-9-]*$/;

/**
 * Declares a plugin. Validating here means a malformed plugin fails at import
 * time with a clear message, rather than halfway through startup.
 */
export function definePlugin(definition: PluginDefinition): Plugin {
  if (!PLUGIN_ID.test(definition.id)) {
    throw new NightshiftError(
      'PLUGIN_INVALID',
      `Plugin id "${definition.id}" must be lower-case kebab-case.`,
    );
  }
  if (definition.name.trim() === '') {
    throw new NightshiftError('PLUGIN_INVALID', `Plugin "${definition.id}" needs a name.`);
  }

  const manifest: PluginManifest = {
    id: definition.id,
    name: definition.name,
    version: definition.version,
    apiVersion: definition.apiVersion ?? NIGHTSHIFT_API_VERSION,
    capabilities: [...definition.capabilities],
    ...(definition.description === undefined ? {} : { description: definition.description }),
  };

  return {
    manifest: Object.freeze(manifest),
    setup: definition.setup,
    ...(definition.teardown ? { teardown: definition.teardown } : {}),
  };
}

/** True when a plugin's contract version is one this runtime can host. */
export function isCompatible(manifest: PluginManifest): boolean {
  return manifest.apiVersion === NIGHTSHIFT_API_VERSION;
}

export { NIGHTSHIFT_API_VERSION } from '@nightshift/core';
export type { EntityId, EntityMeta, EntityStore } from '@nightshift/entities';
export type { Disposable, Json } from '@nightshift/core';
