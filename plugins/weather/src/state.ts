import type {
  StoredWeather,
  StoredWeatherLocation,
  WeatherLocation,
  WeatherLocationsState,
  WeatherUnits,
} from './entity.js';
import { emptyLocation } from './entity.js';
import type { ForecastResult, GeocodedPlace } from './client.js';

export function slotId(optionsLocation: unknown, fallback = 'default'): string {
  return typeof optionsLocation === 'string' && optionsLocation.trim() !== ''
    ? optionsLocation.trim()
    : fallback;
}

export function serializeLocation(location: WeatherLocation): StoredWeatherLocation {
  const { status: _status, error: _error, ...stored } = location;
  return stored;
}

function hydrateLocation(id: string, stored: StoredWeatherLocation): WeatherLocation {
  return {
    ...stored,
    id,
    label: stored.label || id,
    status: stored.updatedAt ? 'ready' : 'idle',
    error: null,
    days: stored.days ?? [],
    hours: stored.hours ?? [],
  };
}

export function primaryLocation(state: WeatherLocationsState): WeatherLocation | undefined {
  return state.locations[state.primaryId];
}

export function publishLocationsState(state: WeatherLocationsState): WeatherLocationsState {
  return { ...state, temperature: primaryLocation(state)?.temperature ?? null };
}

export function fromStored(stored: StoredWeather): WeatherLocationsState {
  const locations: Record<string, WeatherLocation> = {};
  for (const [id, entry] of Object.entries(stored.locations)) {
    locations[id] = hydrateLocation(id, entry);
  }
  const state: WeatherLocationsState = {
    units: stored.units === 'imperial' ? 'imperial' : 'metric',
    primaryId: stored.primaryId || Object.keys(locations)[0] || 'default',
    locations,
    temperature: null,
  };
  return publishLocationsState(state);
}

export function toStored(state: WeatherLocationsState): StoredWeather {
  const locations: Record<string, StoredWeatherLocation> = {};
  for (const [id, location] of Object.entries(state.locations)) {
    if (location.query.trim() === '') continue;
    locations[id] = serializeLocation(location);
  }
  return {
    units: state.units,
    primaryId: state.primaryId,
    locations,
  };
}

export function upsertSlot(
  state: WeatherLocationsState,
  id: string,
  query: string,
  label?: string,
): WeatherLocationsState {
  const existing = state.locations[id];
  const trimmed = query.trim();
  const queryChanged = existing !== undefined && existing.query !== trimmed;
  const base = existing ?? emptyLocation(id, trimmed);
  const next: WeatherLocation = {
    ...base,
    id,
    query: trimmed,
    label: label?.trim() || existing?.label || id,
    status: 'loading',
    error: null,
    ...(queryChanged
      ? {
          placeName: '',
          latitude: 0,
          longitude: 0,
          temperature: null,
          feelsLike: null,
          humidity: null,
          windSpeed: null,
          windDirection: null,
          condition: '',
          weatherCode: null,
          sunrise: null,
          sunset: null,
          days: [],
          hours: [],
          updatedAt: null,
        }
      : {}),
  };
  const locations = { ...state.locations, [id]: next };
  const primaryId = state.primaryId && locations[state.primaryId] ? state.primaryId : id;
  return { ...state, primaryId, locations };
}

export function removeSlot(state: WeatherLocationsState, id: string): WeatherLocationsState {
  if (!(id in state.locations)) return state;
  const locations = { ...state.locations };
  delete locations[id];
  const ids = Object.keys(locations);
  const primaryId = state.primaryId === id ? (ids[0] ?? 'default') : state.primaryId;
  return { ...state, primaryId, locations };
}

export function setPrimary(state: WeatherLocationsState, id: string): WeatherLocationsState {
  if (!(id in state.locations)) return state;
  return { ...state, primaryId: id };
}

export function setUnits(state: WeatherLocationsState, units: WeatherUnits): WeatherLocationsState {
  if (state.units === units) return state;
  return { ...state, units };
}

export function markLoading(state: WeatherLocationsState, id: string): WeatherLocationsState {
  const location = state.locations[id];
  if (!location) return state;
  return {
    ...state,
    locations: {
      ...state.locations,
      [id]: { ...location, status: 'loading', error: null },
    },
  };
}

export function applyPlace(
  state: WeatherLocationsState,
  id: string,
  place: GeocodedPlace,
): WeatherLocationsState {
  const location = state.locations[id];
  if (!location) return state;
  return {
    ...state,
    locations: {
      ...state.locations,
      [id]: {
        ...location,
        placeName: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
      },
    },
  };
}

export function applyForecast(
  state: WeatherLocationsState,
  id: string,
  forecast: ForecastResult,
  updatedAt = new Date().toISOString(),
): WeatherLocationsState {
  const location = state.locations[id];
  if (!location) return state;
  const next: WeatherLocation = {
    ...location,
    status: 'ready',
    error: null,
    temperature: forecast.temperature,
    feelsLike: forecast.feelsLike,
    humidity: forecast.humidity,
    windSpeed: forecast.windSpeed,
    windDirection: forecast.windDirection,
    weatherCode: forecast.weatherCode,
    condition: forecast.condition,
    sunrise: forecast.sunrise,
    sunset: forecast.sunset,
    days: forecast.days,
    hours: forecast.hours,
    updatedAt,
  };
  return {
    ...state,
    locations: {
      ...state.locations,
      [id]: next,
    },
  };
}

export function applyError(
  state: WeatherLocationsState,
  id: string,
  message: string,
): WeatherLocationsState {
  const location = state.locations[id];
  if (!location) return state;
  return {
    ...state,
    locations: {
      ...state.locations,
      [id]: { ...location, status: 'error', error: message },
    },
  };
}

export function formatTemp(value: number | null, units: WeatherUnits): string {
  if (value === null) return '—';
  return `${Math.round(value)}°${units === 'imperial' ? 'F' : 'C'}`;
}

export function formatWind(value: number | null, units: WeatherUnits): string {
  if (value === null) return '—';
  return `${Math.round(value)} ${units === 'imperial' ? 'mph' : 'km/h'}`;
}

export function formatClock(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    // Open-Meteo sunrise/sunset are often local ISO without Z — show HH:MM slice.
    const match = iso.match(/T(\d{2}:\d{2})/);
    return match?.[1] ?? iso;
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function shortDate(isoDate: string): string {
  const match = isoDate.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  return `${match[1]}/${match[2]}`;
}

/** Locale weekday abbreviation for a `YYYY-MM-DD` calendar date. */
export function weekdayShort(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return shortDate(isoDate);
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

export function formatHiLo(min: number, max: number): string {
  return `${Math.round(min)}°/${Math.round(max)}°`;
}

export function isStoredWeather(value: unknown): value is StoredWeather {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record['units'] === 'metric' || record['units'] === 'imperial') &&
    typeof record['primaryId'] === 'string' &&
    typeof record['locations'] === 'object' &&
    record['locations'] !== null
  );
}
