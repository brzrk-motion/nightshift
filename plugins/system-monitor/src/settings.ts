import type { Json } from '@nightshift/sdk';
import { type MonitorSettings } from './entity.js';

export const SETTINGS_STORAGE_KEY = 'settings';

export function initialSettings(): MonitorSettings {
  return {
    version: 1,
    showCpu: true,
    showGpu: true,
    showNetwork: true,
    showRam: true,
  };
}

function isMonitorSettings(value: unknown): value is MonitorSettings {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record['version'] === 1 &&
    typeof record['showCpu'] === 'boolean' &&
    typeof record['showGpu'] === 'boolean' &&
    typeof record['showNetwork'] === 'boolean' &&
    typeof record['showRam'] === 'boolean'
  );
}

/** Normalizes storage into settings; corrupt or missing data falls back to defaults. */
export function hydrateSettings(stored: unknown): MonitorSettings {
  if (!isMonitorSettings(stored)) return initialSettings();
  return {
    version: 1,
    showCpu: stored.showCpu,
    showGpu: stored.showGpu,
    showNetwork: stored.showNetwork,
    showRam: stored.showRam,
  };
}

export function settingsToStorage(settings: MonitorSettings): Json {
  return {
    version: 1,
    showCpu: settings.showCpu,
    showGpu: settings.showGpu,
    showNetwork: settings.showNetwork,
    showRam: settings.showRam,
  };
}
