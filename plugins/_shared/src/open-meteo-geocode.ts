/** Open-Meteo geocoding search — shared by clock (timezone) and weather (lat/lon). */
export const OPEN_METEO_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export type GeocodeFetch = (url: string) => Promise<Response>;

export interface OpenMeteoGeocodeHit {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

/** Display label, e.g. "Austin, Texas, United States". */
export function formatOpenMeteoLocationLabel(
  hit: Pick<OpenMeteoGeocodeHit, 'name' | 'admin1' | 'country'>,
): string {
  const parts = [hit.name, hit.admin1, hit.country].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return parts.join(', ');
}

/**
 * Resolves a place name via Open-Meteo's geocoding search. Callers pick the
 * fields they need — clock uses `timezone`, weather uses `latitude`/`longitude`.
 */
export async function geocodeOpenMeteo(
  fetchFn: GeocodeFetch,
  query: string,
): Promise<OpenMeteoGeocodeHit | undefined> {
  const trimmed = query.trim();
  if (trimmed === '') return undefined;

  const url = `${OPEN_METEO_GEOCODE_URL}?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status})`);
  }
  const body = (await response.json()) as { results?: OpenMeteoGeocodeHit[] };
  return body.results?.[0];
}
