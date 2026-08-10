import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationSpec,
  Disposable,
  Entity,
  EntityId,
  Json,
  PluginCommand,
  PluginContext,
  PluginWidget,
} from '@nightshift/sdk';
import plugin from './index.js';
import { WEATHER_LOCATIONS_ENTITY, WEATHER_NOW_ENTITY, type WeatherLocationsState } from './entity.js';

function fakeContext(fetchImpl?: PluginContext['fetch']) {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const disposers: (() => void)[] = [];
  const storageData = new Map<string, Json>();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: {
      id: 'weather',
      name: 'Weather',
      version: '0.1.0',
      apiVersion: 1,
      capabilities: [],
    },
    log: { error() {}, warn() {}, info() {}, debug() {} },
    entities: {
      get: <State extends Json = Json>(id: EntityId) => entity(id) as Entity<State> | undefined,
      has: (id) => entities.has(id),
      list: () => [...entities.keys()].map((id) => entity(id)!),
      register: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      update: <State extends Json = Json>(id: EntityId, patch: Partial<State>) => {
        const next = { ...(entities.get(id) as Record<string, Json>), ...patch };
        entities.set(id, next);
        return entity(id)! as Entity<State>;
      },
      set: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      remove: (id) => entities.delete(id),
      subscribe: () => () => {},
      subscribeAll: () => () => {},
      events: undefined as never,
      clear: () => entities.clear(),
    },
    storage: {
      get: async (key) => storageData.get(key) as never,
      set: async (key, value) => void storageData.set(key, value),
      delete: async (key) => void storageData.delete(key),
    },
    fetch:
      fetchImpl ??
      (async () => {
        throw new Error('unexpected fetch');
      }),
    registerCommand: (command) => void commands.set(command.id, command),
    registerWidget: (widget) => void widgets.push(widget),
    registerAutomation: (automation) => void automations.push(automation),
    registerEntity: (id, state) => void entities.set(id, state),
    own: (disposable: Disposable | (() => void)) =>
      void disposers.push(
        typeof disposable === 'function' ? disposable : () => disposable.dispose(),
      ),
  };

  return { context, entities, commands, widgets, automations, storageData, disposers };
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
    const { context, entities, commands, widgets, automations, disposers } = fakeContext();
    await plugin.setup(context);

    expect(entities.has(WEATHER_LOCATIONS_ENTITY)).toBe(true);
    expect(entities.has(WEATHER_NOW_ENTITY)).toBe(true);
    expect([...commands.keys()].sort()).toEqual([
      'weather.configure-location',
      'weather.ensure-location',
      'weather.refresh',
      'weather.remove-location',
      'weather.set-primary',
      'weather.set-units',
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

    const { context, entities, commands, storageData } = fakeContext(fetchImpl);
    await plugin.setup(context);

    await commands.get('weather.configure-location')!.run({ id: 'home', query: '90210' });

    const locations = entities.get(WEATHER_LOCATIONS_ENTITY) as WeatherLocationsState;
    expect(locations.locations['home']?.status).toBe('ready');
    expect(locations.locations['home']?.temperature).toBe(22);
    expect(locations.locations['home']?.placeName).toContain('Beverly Hills');

    const now = entities.get(WEATHER_NOW_ENTITY) as { temperature: number };
    expect(now.temperature).toBe(22);
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

    const { context, entities, commands } = fakeContext(fetchImpl);
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

    const { context, entities, commands } = fakeContext(fetchImpl);
    await plugin.setup(context);
    await commands.get('weather.configure-location')!.run({ id: 'home', query: 'zzzzz' });

    const locations = entities.get(WEATHER_LOCATIONS_ENTITY) as WeatherLocationsState;
    expect(locations.locations['home']?.status).toBe('error');
  });
});
