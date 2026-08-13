import type { PluginFetch } from '@nightshift/sdk';

export interface GeocodedTimezone {
  /** Display name, e.g. "Austin, Texas, United States". */
  name: string;
  /** IANA zone, e.g. "America/Chicago". */
  timezone: string;
}

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

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
  const trimmed = query.trim();
  if (trimmed === '') return undefined;

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status})`);
  }
  const body = (await response.json()) as {
    results?: Array<{
      name: string;
      admin1?: string;
      country?: string;
      timezone?: string;
    }>;
  };
  const hit = body.results?.[0];
  if (!hit?.timezone) return undefined;

  const parts = [hit.name, hit.admin1, hit.country].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return { name: parts.join(', '), timezone: hit.timezone };
}
