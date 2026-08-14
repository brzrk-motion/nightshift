import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPluginTestContext } from '@nightshift/sdk/testing';
import type { PluginContext } from '@nightshift/sdk';
import plugin from './index.js';
import { WEATHER_LOCATIONS_ENTITY, type WeatherLocationsState } from './entity.js';

function weatherTestContext(fetch?: PluginContext['fetch']) {
  return createPluginTestContext({
    manifest: plugin.manifest,
    ...(fetch ? { fetch } : {}),
    fetchErrorMessage: 'unexpected fetch',
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('manifest', () => {
  it('declares network among its capabilities', () => {
    expect(plugin.manifest.id).toBe('weather');
    expect(plugin.manifest.capabilities).toContain('network');
    expect(plugin.manifest.capabilities).toContain('storage');
  });
});

describe('setup', () => {
  it('registers entities, widgets, commands and the frost automation', async () => {
    const { context, entities, commands, widgets, automations, disposers } = weatherTestContext();
    await plugin.setup(context);

    expect(entities.has(WEATHER_LOCATIONS_ENTITY)).toBe(true);
    expect(entities.has('weather.now')).toBe(false);
    expect([...commands.keys()].sort()).toEqual([
      'weather.configure-location',
      'weather.ensure-location',
      'weather.refresh',
      'weather.remove-location',
      'weather.set-primary',
      'weather.set-units',
      'weather.widget-mounted',
      'weather.widget-unmounted',
    ]);
    expect(widgets.map((widget) => widget.type).sort()).toEqual([
      'weather.forecast',
      'weather.now',
    ]);
    expect(automations.map((automation) => automation.name)).toEqual(['weather.frost-warning']);
    expect(disposers).toHaveLength(1);
  });

  it('geocodes and fetches when a location is configured', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('geocoding-api')) {
        return jsonResponse({
          results: [{ name: 'Beverly Hills', latitude: 34.07, longitude: -118.4, country: 'US' }],
        });
      }
      return jsonResponse({
        current: {
          temperature_2m: 22,
          apparent_temperature: 21,
          relative_humidity_2m: 40,
          weather_code: 0,
          wind_speed_10m: 10,
          wind_direction_10m: 180,
        },
        daily: {
          time: ['2026-08-10'],
          weather_code: [0],
          temperature_2m_max: [25],
          temperature_2m_min: [15],
          sunrise: ['2026-08-10T06:30'],
          sunset: ['2026-08-10T20:00'],
          precipitation_sum: [0],
        },
        hourly: {
          time: ['2026-08-10T12:00'],
          temperature_2m: [22],
          weather_code: [0],
        },
      });
    });

    const { context, entities, commands, storageData } = weatherTestContext(fetchImpl);
    await plugin.setup(context);

    await commands.get('weather.configure-location')!.run({ id: 'home', query: '90210' });

    const locations = entities.get(WEATHER_LOCATIONS_ENTITY) as WeatherLocationsState;
    expect(locations.locations['home']?.status).toBe('ready');
    expect(locations.locations['home']?.temperature).toBe(22);
    expect(locations.locations['home']?.placeName).toContain('Beverly Hills');
    expect(locations.temperature).toBe(22);
    expect(storageData.get('weather')).toMatchObject({ primaryId: 'home' });
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('keeps independent slots for different location ids', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('geocoding-api')) {
        const name = url.includes('10001') ? 'New York' : 'Austin';
        return jsonResponse({
          results: [{ name, latitude: 1, longitude: 2, country: 'US' }],
        });
      }
      return jsonResponse({
        current: {
          temperature_2m: url.includes('latitude=1') ? 30 : 10,
          apparent_temperature: 10,
          relative_humidity_2m: 10,
          weather_code: 0,
          wind_speed_10m: 1,
          wind_direction_10m: 1,
        },
        daily: {
          time: [],
          weather_code: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          sunrise: [],
          sunset: [],
          precipitation_sum: [],
        },
        hourly: { time: [], temperature_2m: [], weather_code: [] },
      });
    });

    const { context, entities, commands } = weatherTestContext(fetchImpl);
    await plugin.setup(context);

    await commands.get('weather.configure-location')!.run({ id: 'home', query: '78701' });
    await commands.get('weather.configure-location')!.run({ id: 'office', query: '10001' });

    const locations = entities.get(WEATHER_LOCATIONS_ENTITY) as WeatherLocationsState;
    expect(locations.locations['home']?.placeName).toContain('Austin');
    expect(locations.locations['office']?.placeName).toContain('New York');
  });

  it('records an error when geocoding finds nothing', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('geocoding-api')) return jsonResponse({ results: [] });
      throw new Error('should not forecast');
    });

    const { context, entities, commands, notify } = weatherTestContext(fetchImpl);
    await plugin.setup(context);
    await commands.get('weather.configure-location')!.run({ id: 'home', query: 'zzzzz' });

    const locations = entities.get(WEATHER_LOCATIONS_ENTITY) as WeatherLocationsState;
    expect(locations.locations['home']?.status).toBe('error');
    // The widget has no readings to show, so it draws the error itself — a
    // toast on top of it would be saying the same thing twice.
    expect(notify).not.toHaveBeenCalled();
  });

  it('announces a refresh that fails once readings are already on screen', async () => {
    let failing = false;
    const fetchImpl = vi.fn(async (url: string) => {
      if (failing) throw new Error('Open-Meteo is unreachable');
      if (url.includes('geocoding-api')) {
        return jsonResponse({ results: [{ name: 'Austin', latitude: 1, longitude: 2 }] });
      }
      return jsonResponse({
        current: {
          temperature_2m: 30,
          apparent_temperature: 30,
          relative_humidity_2m: 10,
          weather_code: 0,
          wind_speed_10m: 1,
          wind_direction_10m: 1,
        },
        daily: {
          time: [],
          weather_code: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          sunrise: [],
          sunset: [],
          precipitation_sum: [],
        },
        hourly: { time: [], temperature_2m: [], weather_code: [] },
      });
    });

    const { context, entities, commands, notify } = weatherTestContext(fetchImpl);
    await plugin.setup(context);
    await commands.get('weather.configure-location')!.run({ id: 'home', query: '78701' });
    expect(notify).not.toHaveBeenCalled();

    failing = true;
    await commands.get('weather.refresh')!.run({ id: 'home' });
    await commands.get('weather.refresh')!.run({ id: 'home' });

    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('out of date'), {
      tone: 'warning',
      key: 'refresh:home',
    });
    // The last good reading stays on screen; only its currency is in doubt.
    const locations = entities.get(WEATHER_LOCATIONS_ENTITY) as WeatherLocationsState;
    expect(locations.locations['home']?.temperature).toBe(30);
  });

  it('does not hit the network on setup when locations are stored but no widget is mounted', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ results: [] }));
    const { context, commands, storageData } = weatherTestContext(fetchImpl);
    storageData.set('weather', {
      primaryId: 'home',
      units: 'metric',
      locations: {
        home: {
          id: 'home',
          label: 'Home',
          query: '90210',
          latitude: 34.07,
          longitude: -118.4,
          placeName: 'Beverly Hills',
          temperature: 22,
          feelsLike: 21,
          humidity: 40,
          windSpeed: 10,
          windDirection: 180,
          condition: 'Clear',
          weatherCode: 0,
          sunrise: null,
          sunset: null,
          days: [],
          hours: [],
          updatedAt: '2026-08-10T12:00:00.000Z',
        },
      },
    });
    await plugin.setup(context);

    expect(fetchImpl).not.toHaveBeenCalled();

    await commands.get('weather.widget-mounted')!.run();
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('stops polling when the widget unmounts', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('geocoding-api')) {
        return jsonResponse({ results: [{ name: 'Austin', latitude: 1, longitude: 2 }] });
      }
      return jsonResponse({
        current: {
          temperature_2m: 30,
          apparent_temperature: 30,
          relative_humidity_2m: 10,
          weather_code: 0,
          wind_speed_10m: 1,
          wind_direction_10m: 1,
        },
        daily: {
          time: [],
          weather_code: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          sunrise: [],
          sunset: [],
          precipitation_sum: [],
        },
        hourly: { time: [], temperature_2m: [], weather_code: [] },
      });
    });

    const { context, commands, storageData } = weatherTestContext(fetchImpl);
    storageData.set('weather', {
      primaryId: 'home',
      units: 'metric',
      locations: {
        home: {
          id: 'home',
          label: 'Home',
          query: '78701',
          latitude: 1,
          longitude: 2,
          placeName: 'Austin',
          temperature: 30,
          feelsLike: 30,
          humidity: 10,
          windSpeed: 1,
          windDirection: 1,
          condition: 'Clear',
          weatherCode: 0,
          sunrise: null,
          sunset: null,
          days: [],
          hours: [],
          updatedAt: '2026-08-10T12:00:00.000Z',
        },
      },
    });
    await plugin.setup(context);

    await commands.get('weather.widget-mounted')!.run();
    await vi.advanceTimersByTimeAsync(0);

    await commands.get('weather.widget-unmounted')!.run();
    fetchImpl.mockClear();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
