import {
  NIGHTSHIFT_API_VERSION,
  NightshiftError,
  type Disposable,
  type Json,
  type Unsubscribe,
} from '@nightshift/core';
import type { EntityId, EntityMeta, EntityStore } from '@nightshift/entities';
import type { AutomationSpec } from '@nightshift/automations';
import type { ReactNode } from 'react';

/**
 * The public plugin interface. This module is the *only* thing a plugin is
 * allowed to import from Nightshift — everything the runtime offers arrives
 * through the context object passed to `setup`, and everything a plugin needs
 * to *draw* with is re-exported at the bottom of this file.
 */

/** Capabilities a plugin must ask for, and the user must grant. */
export const CAPABILITIES = [
  'entities:read',
  'entities:write',
  'widgets:register',
  'commands:register',
  'automations:register',
  'network',
  'storage',
  'shell',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && (CAPABILITIES as readonly string[]).includes(value);
}

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

/**
 * How loudly a notification reads. Matches the toast tones the shell draws, so
 * a plugin's `notify` and the shell's own notifications look the same.
 */
export type NotificationTone = 'info' | 'success' | 'warning' | 'danger';

export interface NotifyOptions {
  /** Defaults to `info`. */
  tone?: NotificationTone;
  /** Milliseconds on screen; `0` stays until dismissed. */
  timeout?: number;
  /**
   * Identity for a notification that can recur — a failing poll, say. A
   * notification whose key is already on screen replaces it instead of
   * stacking, so a repeated failure stays one line rather than a wall of them.
   * Keys are scoped to the plugin, so two plugins can reuse the same one.
   */
  key?: string;
}

/** A command a plugin contributes to the command palette. */
export interface PluginCommand {
  id: string;
  title: string;
  /** Hidden from the palette but still callable (e.g. widget lifecycle hooks). */
  hidden?: boolean;
  /** Arguments a vibe's `onActivate` or an automation's `then` can pass in. */
  run(args?: Record<string, Json>): void | Promise<void>;
}

/**
 * What a widget is handed when the dashboard draws it. Everything else —
 * entity state, the active theme, the command registry — comes from the hooks
 * this module re-exports, so a widget stays a plain component.
 */
export interface WidgetProps {
  /** Options from the dashboard file, passed through untouched. */
  options: Record<string, Json>;
  /** Cells the widget has been given, for anything it draws itself. */
  width: number;
  height: number;
  /** Title from the dashboard file, when it overrode the widget's own. */
  title?: string;
}

export type WidgetComponent = (props: WidgetProps) => ReactNode;

/** A widget a plugin contributes to the dashboard widget registry. */
export interface PluginWidget {
  /** Widget type referenced from a dashboard file, e.g. `pomodoro.session`. */
  type: string;
  title: string;
  /** Entities the widget reads; the runtime re-renders when they change. */
  entities: EntityId[];
  /** Draws the widget. Without one the dashboard shows a placeholder. */
  render?: WidgetComponent;
  /** Short line shown when the widget is listed in the palette or docs. */
  description?: string;
}

/** Init bag for `PluginContext.fetch` — a small, JSON-friendly slice of `RequestInit`. */
export interface PluginFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** Everything the runtime grants a plugin at setup time. */
export interface PluginContext {
  manifest: Readonly<PluginManifest>;
  log: PluginLogger;
  /**
   * Tells the user something, wherever they are — the shell shows it as a
   * toast. This is the right place for a transient failure a plugin cannot fix
   * on its own (an API that would not answer, a device that is not there):
   * `log` is for the log file, an entity is for state a widget draws, and this
   * is for a message that has to reach whoever is at the keyboard now.
   *
   * Always available, like `log` — it neither leaves the process nor touches
   * state, so it needs no capability.
   */
  notify(message: string, options?: NotifyOptions): void;
  /** Present when `entities:read` or `entities:write` was granted. */
  entities: EntityStore;
  /** Per-plugin key/value storage. Present when `storage` was granted. */
  storage: PluginStorage;
  /**
   * Network fetch gated by the `network` capability. HTTPS is always allowed;
   * HTTP is allowed only for loopback and RFC1918 private IPv4 hosts (local
   * Home Assistant and similar). Other cleartext URLs are refused. Without an
   * explicit `signal`, the host applies a 15s timeout.
   */
  fetch(url: string, init?: PluginFetchInit): Promise<Response>;
  registerCommand(command: PluginCommand): void;
  registerWidget(widget: PluginWidget): void;
  registerEntity<State extends Json>(id: EntityId, state: State, meta?: EntityMeta): void;
  /**
   * Declares a trigger-condition-action rule — data, not code, so the runtime
   * can list, disable or report on it the same way it does for any other
   * plugin's. Actions reference command ids, exactly like a vibe's
   * `onActivate`, so an automation can only do what a command already allows.
   */
  registerAutomation(automation: AutomationSpec): void;
  /**
   * Ties a resource to the plugin's lifetime; released on teardown. Accepts a
   * disposable or a plain teardown function, since most of what a plugin needs
   * to clean up is an interval or an unsubscribe.
   */
  own(disposable: Disposable | Unsubscribe): void;
}

/** Network fetch function shape from `PluginContext.fetch`. */
export type PluginFetch = PluginContext['fetch'];

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

export { NIGHTSHIFT_API_VERSION, parseStoredVersion } from '@nightshift/core';
export type { EntityId, EntityMeta, EntityStore, Entity } from '@nightshift/entities';
export type { Disposable, Json, Unsubscribe } from '@nightshift/core';
export type { Action, AutomationSpec, Condition, Trigger } from '@nightshift/automations';

/**
 * The drawing half of the interface. Re-exporting it here is what makes the
 * SDK the *only* import a plugin needs: a widget gets the component library,
 * the theme and the hooks from the same place as the runtime contract, and
 * never reaches into Nightshift's internals to find them.
 */
export {
  ActivityWaveform,
  BarChart,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  KeyHint,
  LineChart,
  List,
  LoadingState,
  Meter,
  Metric,
  Modal,
  Panel,
  ProgressBar,
  SelectField,
  Sparkline,
  StatRow,
  StatusBadge,
  StatusDot,
  Table,
  Tabs,
  TextInput,
  Timeline,
  Toggle,
  Toolbar,
  resolveBreakpoint,
  useCommands,
  useEntities,
  useEntity,
  useShellContentSize,
  useTheme,
  useToasts,
  type BadgeTone,
  type Breakpoint,
  type IconName,
  type PanelDensity,
  type SelectOption,
  type TerminalSize,
  type Theme,
  type ThemeColors,
  type TimelineItem,
} from '@nightshift/ui';
