import { describe, expect, it } from 'vitest';
import {
  formatOpenMeteoLocationLabel,
  geocodeOpenMeteo,
  OPEN_METEO_GEOCODE_URL,
} from './open-meteo-geocode.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('formatOpenMeteoLocationLabel', () => {
  it('joins name, admin1 and country', () => {
    expect(
      formatOpenMeteoLocationLabel({
        name: 'Austin',
        admin1: 'Texas',
        country: 'United States',
      }),
    ).toBe('Austin, Texas, United States');
  });

  it('skips empty parts', () => {
    expect(formatOpenMeteoLocationLabel({ name: 'Tokyo', country: 'Japan' })).toBe('Tokyo, Japan');
  });
});

describe('geocodeOpenMeteo', () => {
  it('returns undefined for blank queries without fetching', async () => {
    const fetchFn = async () => {
      throw new Error('should not fetch');
    };
    expect(await geocodeOpenMeteo(fetchFn, '   ')).toBeUndefined();
  });

  it('requests the Open-Meteo search endpoint and returns the first hit', async () => {
    const hit = {
      name: 'Austin',
      admin1: 'Texas',
      country: 'United States',
      latitude: 30.27,
      longitude: -97.74,
      timezone: 'America/Chicago',
    };
    const fetchFn = async (url: string) => {
      expect(url.startsWith(OPEN_METEO_GEOCODE_URL)).toBe(true);
      expect(url).toContain('name=Austin');
      return jsonResponse({ results: [hit] });
    };

    expect(await geocodeOpenMeteo(fetchFn, 'Austin')).toEqual(hit);
  });

  it('returns undefined when there are no results', async () => {
    const fetchFn = async () => jsonResponse({ results: [] });
    expect(await geocodeOpenMeteo(fetchFn, 'Nowhere')).toBeUndefined();
  });

  it('throws when the response is not ok', async () => {
    const fetchFn = async () => jsonResponse({}, 500);
    await expect(geocodeOpenMeteo(fetchFn, 'Austin')).rejects.toThrow(/Geocoding failed/);
  });
});
