import type { Json } from '@nightshift/sdk';
import { isClockDateFormat, type ClockDateFormat } from './format.js';
import { detectSystemTimezone } from './location.js';

export const CLOCK_ENTITY = 'clock.settings';

export type ClockTimezoneSource = 'system' | 'location';
export type ClockLocationStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ClockSettings {
  hour12: boolean;
  showSeconds: boolean;
  dateFormat: ClockDateFormat;
  /** IANA zone used for display; `null` while nothing could be resolved. */
  timezone: string | null;
  /** Where `timezone` came from — the machine, or a location the user set. */
  timezoneSource: ClockTimezoneSource;
  /** Last location search submitted; only meaningful once `timezoneSource` is `location`. */
  locationQuery: string;
  /** Resolved place name for display, e.g. "Austin, Texas, United States". */
  locationLabel: string;
  locationStatus: ClockLocationStatus;
  locationError: string | null;
  [key: string]: Json;
}

export function initialClockSettings(): ClockSettings {
  return {
    hour12: false,
    showSeconds: true,
    dateFormat: 'long',
    timezone: detectSystemTimezone(),
    timezoneSource: 'system',
    locationQuery: '',
    locationLabel: '',
    locationStatus: 'idle',
    locationError: null,
  };
}

function isLegacyBase(
  value: unknown,
): value is { hour12: boolean; showSeconds: boolean; dateFormat: ClockDateFormat } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['hour12'] === 'boolean' &&
    typeof record['showSeconds'] === 'boolean' &&
    isClockDateFormat(record['dateFormat'])
  );
}

/**
 * Normalizes whatever storage handed back into a full `ClockSettings` —
 * including a shape saved before the timezone feature existed, which had
 * none of the new fields. The system zone is re-detected fresh each time
 * unless the user picked a location, since the machine's zone can change
 * (a container's `TZ`, a laptop that travelled) between runs.
 */
export function hydrateClockSettings(stored: unknown): ClockSettings {
  if (!isLegacyBase(stored)) return initialClockSettings();

  const record = stored as Record<string, unknown>;
  const timezoneSource: ClockTimezoneSource =
    record['timezoneSource'] === 'location' ? 'location' : 'system';
  const storedTimezone = typeof record['timezone'] === 'string' ? record['timezone'] : null;

  return {
    hour12: record['hour12'] as boolean,
    showSeconds: record['showSeconds'] as boolean,
    dateFormat: record['dateFormat'] as ClockDateFormat,
    timezone: timezoneSource === 'location' ? storedTimezone : detectSystemTimezone(),
    timezoneSource,
    locationQuery: typeof record['locationQuery'] === 'string' ? record['locationQuery'] : '',
    locationLabel: typeof record['locationLabel'] === 'string' ? record['locationLabel'] : '',
    locationStatus: 'idle',
    locationError: null,
  };
}
