import { describe, expect, it } from 'vitest';
import { weatherCodeInfo } from './codes.js';
import { parseCoordinates } from './client.js';
import {
  applyError,
  applyForecast,
  fromStored,
  primaryLocation,
  publishLocationsState,
  removeSlot,
  setPrimary,
  slotId,
  upsertSlot,
  weekdayShort,
  formatHiLo,
} from './state.js';
import { initialLocationsState, type StoredWeather } from './entity.js';

describe('weatherCodeInfo', () => {
  it('maps known WMO codes', () => {
    expect(weatherCodeInfo(0).label).toBe('Clear');
    expect(weatherCodeInfo(95).icon).toBe('weatherStorm');
  });

  it('falls back for unknown codes', () => {
    expect(weatherCodeInfo(1234).label).toContain('1234');
    expect(weatherCodeInfo(0).tone).toBe('accent');
  });
});

describe('weekdayShort / formatHiLo', () => {
  it('formats calendar helpers', () => {
    expect(weekdayShort('2026-08-10')).toMatch(/^\w{3}/);
    expect(formatHiLo(8.2, 18.7)).toBe('8°/19°');
  });
});

describe('parseCoordinates', () => {
  it('parses lat,lon', () => {
    expect(parseCoordinates('30.27, -97.74')).toEqual({
      latitude: 30.27,
      longitude: -97.74,
    });
  });

  it('rejects garbage', () => {
    expect(parseCoordinates('Austin, TX')).toBeUndefined();
    expect(parseCoordinates('91,0')).toBeUndefined();
  });
});

describe('state', () => {
  it('resolves slot ids from widget options', () => {
    expect(slotId('home')).toBe('home');
    expect(slotId('')).toBe('default');
    expect(slotId(undefined)).toBe('default');
  });

  it('upserts and removes location slots', () => {
    let state = upsertSlot(initialLocationsState(), 'home', '90210', 'Home');
    expect(state.primaryId).toBe('home');
    expect(state.locations['home']?.query).toBe('90210');
    expect(state.locations['home']?.status).toBe('loading');

    state = upsertSlot(state, 'office', '10001');
    expect(Object.keys(state.locations)).toEqual(['home', 'office']);

    state = removeSlot(state, 'home');
    expect(state.primaryId).toBe('office');
    expect(state.locations['home']).toBeUndefined();
  });

  it('applies forecast data to the primary slot', () => {
    let state = upsertSlot(initialLocationsState(), 'home', '90210');
    state = applyForecast(state, 'home', {
      temperature: 11,
      feelsLike: 9,
      humidity: 40,
      windSpeed: 12,
      windDirection: 180,
      weatherCode: 0,
      condition: 'Clear',
      sunrise: '2026-08-10T06:30',
      sunset: '2026-08-10T20:00',
      days: [
        {
          date: '2026-08-10',
          condition: 'Clear',
          weatherCode: 0,
          tempMax: 18,
          tempMin: 8,
          precipitationSum: 0,
        },
      ],
      hours: [{ time: '2026-08-10T12:00', temperature: 11, weatherCode: 0 }],
    });

    expect(state.locations['home']?.status).toBe('ready');
    expect(primaryLocation(state)?.temperature).toBe(11);
    // Mutators leave top-level temperature stale until publishLocationsState.
    expect(state.temperature).toBeNull();
    expect(publishLocationsState(state).temperature).toBe(11);
  });

  it('denormalizes the active primary temperature for flat-key automations', () => {
    let state = upsertSlot(initialLocationsState(), 'home', '90210');
    state = applyForecast(state, 'home', {
      temperature: 11,
      feelsLike: 9,
      humidity: 40,
      windSpeed: 12,
      windDirection: 180,
      weatherCode: 0,
      condition: 'Clear',
      sunrise: '2026-08-10T06:30',
      sunset: '2026-08-10T20:00',
      days: [],
      hours: [],
    });
    state = upsertSlot(state, 'office', '10001');
    state = applyForecast(state, 'office', {
      temperature: -3,
      feelsLike: -5,
      humidity: 60,
      windSpeed: 8,
      windDirection: 90,
      weatherCode: 71,
      condition: 'Snow',
      sunrise: '2026-08-10T07:00',
      sunset: '2026-08-10T19:00',
      days: [],
      hours: [],
    });

    expect(publishLocationsState(state).temperature).toBe(11);

    state = setPrimary(state, 'office');
    expect(publishLocationsState(state).temperature).toBe(-3);

    state = removeSlot(state, 'office');
    expect(publishLocationsState(state).temperature).toBe(11);

    state = removeSlot(state, 'home');
    expect(publishLocationsState(state).temperature).toBeNull();
  });

  it('records errors without dropping the slot', () => {
    let state = upsertSlot(initialLocationsState(), 'home', 'nowhere');
    state = applyError(state, 'home', 'No place found');
    expect(state.locations['home']?.status).toBe('error');
    expect(state.locations['home']?.error).toBe('No place found');
  });

  it('restores from storage', () => {
    const stored: StoredWeather = {
      units: 'imperial',
      primaryId: 'home',
      locations: {
        home: {
          id: 'home',
          query: '90210',
          label: 'Home',
          placeName: 'Beverly Hills',
          latitude: 34.07,
          longitude: -118.4,
          temperature: 72,
          feelsLike: 70,
          humidity: 20,
          windSpeed: 5,
          windDirection: 90,
          condition: 'Clear',
          weatherCode: 0,
          sunrise: null,
          sunset: null,
          days: [],
          hours: [],
          updatedAt: '2026-08-10T12:00:00.000Z',
        },
      },
    };
    const state = fromStored(stored);
    expect(state.units).toBe('imperial');
    expect(state.locations['home']?.status).toBe('ready');
    expect(primaryLocation(state)?.placeName).toBe('Beverly Hills');
    expect(state.temperature).toBe(72);
  });
});
