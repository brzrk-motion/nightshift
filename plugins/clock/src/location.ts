import { geocodeOpenMeteo, formatOpenMeteoLocationLabel } from '@nightshift/plugin-shared';
import type { PluginFetch } from '@nightshift/sdk';

export interface GeocodedTimezone {
  /** Display name, e.g. "Austin, Texas, United States". */
  name: string;
  /** IANA zone, e.g. "America/Chicago". */
  timezone: string;
}

/**
 * The IANA zone Node/the OS reports (e.g. from `TZ`, or the system clock's
 * own setting), or `null` if the runtime can't determine one. No network
 * involved — this is the "if possible" half of "use the machine's timezone
 * if possible, otherwise ask for a location."
 */
export function detectSystemTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone === '' ? null : timezone;
  } catch {
    return null;
  }
}

/**
 * Resolves a place name (or `lat,lon`) to a timezone via Open-Meteo's
 * geocoding search — the same endpoint and response shape the weather
 * plugin's `geocode()` uses, trimmed to just the field the clock needs.
 */
export async function geocodeTimezone(
  fetchFn: PluginFetch,
  query: string,
): Promise<GeocodedTimezone | undefined> {
  const hit = await geocodeOpenMeteo(fetchFn, query);
  if (!hit?.timezone) return undefined;

  return { name: formatOpenMeteoLocationLabel(hit), timezone: hit.timezone };
}
