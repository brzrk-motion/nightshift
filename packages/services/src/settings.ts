import { createEventBus, type EventBus, type Unsubscribe } from '@nightshift/core';
import { loadConfig, saveConfig, type NightshiftConfig } from './config.js';
import type { NightshiftPaths } from './paths.js';

/**
 * The settings loader the application shell reads from.
 *
 * `loadConfig` gives you a snapshot; this gives you a live value plus a way to
 * change it. Everything that reacts to settings — the theme, the default
 * dashboard, the log level — subscribes here, so a change made from a command
 * reaches the UI and the file on disk through one path.
 */
export interface SettingsEvents extends Record<string, unknown[]> {
  changed: [config: NightshiftConfig, previous: NightshiftConfig];
}

export interface SettingsStore {
  readonly current: NightshiftConfig;
  readonly paths: NightshiftPaths;
  /** False when no config file existed when the store was created. */
  readonly exists: boolean;
  /** Merges a patch, notifies subscribers, and writes the file. */
  update(patch: Partial<NightshiftConfig>): Promise<NightshiftConfig>;
  /** Merges a patch in memory only. Used for `--flag` overrides. */
  patch(patch: Partial<NightshiftConfig>): NightshiftConfig;
  /** Re-reads the file, discarding in-memory overrides. */
  reload(): Promise<NightshiftConfig>;
  /** Writes the current settings, creating the file if it does not exist. */
  save(): Promise<void>;
  subscribe(listener: (config: NightshiftConfig) => void): Unsubscribe;
  readonly events: EventBus<SettingsEvents>;
}

export interface SettingsStoreOptions {
  configDir?: string | undefined;
}

export async function createSettingsStore(
  options: SettingsStoreOptions = {},
): Promise<SettingsStore> {
  const loaded = await loadConfig({ configDir: options.configDir });
  const events = createEventBus<SettingsEvents>();

  let current = loaded.config;

  const publish = (next: NightshiftConfig): NightshiftConfig => {
    const previous = current;
    current = next;
    events.emit('changed', next, previous);
    return next;
  };

  return {
    get current() {
      return current;
    },
    paths: loaded.paths,
    exists: loaded.exists,

    patch(patch) {
      return publish({ ...current, ...patch });
    },

    async update(patch) {
      const next = publish({ ...current, ...patch });
      await saveConfig(next, { configDir: loaded.paths.configDir });
      return next;
    },

    async reload() {
      const fresh = await loadConfig({ configDir: loaded.paths.configDir });
      return publish(fresh.config);
    },

    async save() {
      await saveConfig(current, { configDir: loaded.paths.configDir });
    },

    subscribe(listener) {
      return events.on('changed', (config) => listener(config));
    },

    events,
  };
}
