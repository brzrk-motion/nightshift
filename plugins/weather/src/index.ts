import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';
import { fetchForecast, geocode } from './client.js';
import {
  WEATHER_LOCATIONS_ENTITY,
  WEATHER_NOW_ENTITY,
  emptyLocation,
  initialLocationsState,
  type WeatherLocationsState,
  type WeatherUnits,
} from './entity.js';
import {
  applyError,
  applyForecast,
  applyPlace,
  fromStored,
  isStoredWeather,
  markLoading,
  mirrorPrimary,
  removeSlot,
  setPrimary,
  setUnits,
  toStored,
  upsertSlot,
} from './state.js';
import { ForecastWidget, NowWidget } from './widgets.js';

const POLL_MS = 15 * 60 * 1000;

function stringArg(args: Record<string, Json> | undefined, key: string): string | undefined {
  const value = args?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function unitsArg(args: Record<string, Json> | undefined): WeatherUnits | undefined {
  const value = args?.['units'];
  return value === 'metric' || value === 'imperial' ? value : undefined;
}

export default definePlugin({
  id: 'weather',
  name: 'Weather',
  version: '0.1.0',
  description: 'Current conditions and forecast from Open-Meteo, per location slot.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'automations:register',
    'storage',
    'network',
  ],

  async setup(context: PluginContext) {
    const stored = await context.storage.get('weather');
    const initial = isStoredWeather(stored)
      ? fromStored(stored)
      : initialLocationsState();

    context.registerEntity(WEATHER_LOCATIONS_ENTITY, initial, {
      title: 'Weather locations',
      owner: 'weather',
    });
    context.registerEntity(WEATHER_NOW_ENTITY, mirrorPrimary(initial), {
      title: 'Weather now',
      unit: 'degrees',
      owner: 'weather',
    });

    const read = (): WeatherLocationsState =>
      context.entities.get<WeatherLocationsState>(WEATHER_LOCATIONS_ENTITY)?.state ??
      initialLocationsState();

    const write = (next: WeatherLocationsState): void => {
      context.entities.set(WEATHER_LOCATIONS_ENTITY, next);
      context.entities.set(WEATHER_NOW_ENTITY, mirrorPrimary(next));
    };

    const persist = (next: WeatherLocationsState): void => {
      context.storage.set('weather', toStored(next)).catch((error: unknown) => {
        context.log.warn('Could not save weather locations', { error: `${error}` });
      });
    };

    const refreshSlot = async (id: string): Promise<void> => {
      const before = read();
      const location = before.locations[id];
      if (!location || location.query.trim() === '') return;

      write(markLoading(before, id));
      try {
        let latitude = location.latitude;
        let longitude = location.longitude;
        let placeName = location.placeName;

        if (!placeName || (latitude === 0 && longitude === 0)) {
          const place = await geocode(context.fetch, location.query);
          if (!place) {
            const failed = applyError(read(), id, `No place found for "${location.query}".`);
            write(failed);
            persist(failed);
            return;
          }
          latitude = place.latitude;
          longitude = place.longitude;
          placeName = place.name;
          write(applyPlace(read(), id, place));
        }

        const forecast = await fetchForecast(
          context.fetch,
          latitude,
          longitude,
          read().units,
        );
        const next = applyForecast(read(), id, forecast);
        write(next);
        persist(next);
      } catch (error) {
        const failed = applyError(
          read(),
          id,
          error instanceof Error ? error.message : `${error}`,
        );
        write(failed);
        persist(failed);
        context.log.warn('Weather refresh failed', { id, error: `${error}` });
      }
    };

    const refreshAll = async (): Promise<void> => {
      const ids = Object.keys(read().locations).filter(
        (id) => (read().locations[id]?.query.trim() ?? '') !== '',
      );
      for (const id of ids) await refreshSlot(id);
    };

    const configure = async (id: string, query: string, label?: string): Promise<void> => {
      const next = upsertSlot(read(), id, query, label);
      write(next);
      persist(next);
      await refreshSlot(id);
    };

    // Bootstrap any slot that arrived with options.query in YAML but empty storage.
    // Widgets call configure when the user saves; commands cover the palette.

    context.registerCommand({
      id: 'weather.configure-location',
      title: 'Configure weather location',
      run: async (args) => {
        const id = stringArg(args, 'id') ?? 'default';
        const query = stringArg(args, 'query');
        if (!query) {
          context.log.warn('weather.configure-location needs a query');
          return;
        }
        await configure(id, query, stringArg(args, 'label'));
      },
    });

    context.registerCommand({
      id: 'weather.remove-location',
      title: 'Remove weather location',
      run: (args) => {
        const id = stringArg(args, 'id');
        if (!id) return;
        const next = removeSlot(read(), id);
        write(next);
        persist(next);
      },
    });

    context.registerCommand({
      id: 'weather.refresh',
      title: 'Refresh weather',
      run: async (args) => {
        const id = stringArg(args, 'id');
        if (id) await refreshSlot(id);
        else await refreshAll();
      },
    });

    context.registerCommand({
      id: 'weather.set-units',
      title: 'Set weather units',
      run: async (args) => {
        const units = unitsArg(args);
        if (!units) return;
        const next = setUnits(read(), units);
        write(next);
        persist(next);
        await refreshAll();
      },
    });

    context.registerCommand({
      id: 'weather.set-primary',
      title: 'Set primary weather location',
      run: (args) => {
        const id = stringArg(args, 'id');
        if (!id) return;
        const next = setPrimary(read(), id);
        write(next);
        persist(next);
      },
    });

    // Ensure bootstrap queries from dashboard options can be applied via refresh
    // after a widget has upserted an idle slot — widgets only mutate via commands.
    context.registerCommand({
      id: 'weather.ensure-location',
      title: 'Ensure weather location slot',
      run: async (args) => {
        const id = stringArg(args, 'id') ?? 'default';
        const query = stringArg(args, 'query');
        const current = read().locations[id];
        if (current?.query) {
          if (current.status === 'idle') await refreshSlot(id);
          return;
        }
        if (!query) {
          if (!current) {
            write({
              ...read(),
              locations: { ...read().locations, [id]: emptyLocation(id) },
            });
          }
          return;
        }
        await configure(id, query);
      },
    });

    context.registerWidget({
      type: 'weather.now',
      title: 'Weather',
      entities: [WEATHER_LOCATIONS_ENTITY],
      description: 'Current conditions for a configured location slot.',
      render: NowWidget,
    });
    context.registerWidget({
      type: 'weather.forecast',
      title: 'Forecast',
      entities: [WEATHER_LOCATIONS_ENTITY],
      description: 'Multi-day forecast for a configured location slot.',
      render: ForecastWidget,
    });

    context.registerAutomation({
      name: 'weather.frost-warning',
      when: { type: 'entity', entity: WEATHER_NOW_ENTITY, key: 'temperature' },
      and: [{ type: 'below', entity: WEATHER_NOW_ENTITY, key: 'temperature', value: 0 }],
      then: [
        {
          command: 'app.notify',
          args: { message: 'Frost warning: temperature below freezing.', tone: 'warning' },
        },
      ],
    });

    const timer = setInterval(() => {
      void refreshAll();
    }, POLL_MS);
    timer.unref?.();
    context.own(() => clearInterval(timer));

    void refreshAll();
    context.log.info('Weather plugin ready', {
      locations: Object.keys(initial.locations).length,
    });
  },
});

export {
  WEATHER_LOCATIONS_ENTITY,
  WEATHER_NOW_ENTITY,
  initialLocationsState,
  initialNowState,
} from './entity.js';
export { weatherCodeInfo } from './codes.js';
export { weatherArt, heroDigits, WEATHER_ART, ART_WIDTH } from './art.js';
export { parseCoordinates } from './client.js';
export { NowWidget, ForecastWidget } from './widgets.js';
