import type { Json } from '@nightshift/sdk';

/** Aggregate map of every configured location slot. */
export const WEATHER_LOCATIONS_ENTITY = 'weather.locations';

/** Current conditions for the primary slot — used by automations and simple consumers. */
export const WEATHER_NOW_ENTITY = 'weather.now';

export type WeatherUnits = 'metric' | 'imperial';
export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WeatherDay {
  date: string;
  condition: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  [key: string]: Json;
}

export interface WeatherHour {
  time: string;
  temperature: number;
  weatherCode: number;
  [key: string]: Json;
}

/** One named location slot (bound from a widget via `options.location`). */
export interface WeatherLocation {
  id: string;
  query: string;
  label: string;
  placeName: string;
  latitude: number;
  longitude: number;
  status: WeatherStatus;
  error: string | null;
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  condition: string;
  weatherCode: number | null;
  sunrise: string | null;
  sunset: string | null;
  days: WeatherDay[];
  hours: WeatherHour[];
  updatedAt: string | null;
  [key: string]: Json;
}

export interface WeatherLocationsState {
  units: WeatherUnits;
  primaryId: string;
  locations: Record<string, WeatherLocation>;
  [key: string]: Json;
}

/** Flat current-conditions projection of the primary slot. */
export interface WeatherNowState {
  status: WeatherStatus;
  error: string | null;
  locationId: string | null;
  placeName: string | null;
  units: WeatherUnits;
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  condition: string;
  weatherCode: number | null;
  sunrise: string | null;
  sunset: string | null;
  updatedAt: string | null;
  [key: string]: Json;
}

export function emptyLocation(id: string, query = ''): WeatherLocation {
  return {
    id,
    query,
    label: id,
    placeName: '',
    latitude: 0,
    longitude: 0,
    status: query === '' ? 'idle' : 'loading',
    error: null,
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
  };
}

export function initialLocationsState(
  units: WeatherUnits = 'metric',
  primaryId = 'default',
): WeatherLocationsState {
  return { units, primaryId, locations: {} };
}

export function initialNowState(units: WeatherUnits = 'metric'): WeatherNowState {
  return {
    status: 'idle',
    error: null,
    locationId: null,
    placeName: null,
    units,
    temperature: null,
    feelsLike: null,
    humidity: null,
    windSpeed: null,
    windDirection: null,
    condition: '',
    weatherCode: null,
    sunrise: null,
    sunset: null,
    updatedAt: null,
  };
}

/** JSON-safe storage shape for slots (without live status noise). */
export interface StoredLocation {
  id: string;
  query: string;
  label: string;
  placeName: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  condition: string;
  weatherCode: number | null;
  sunrise: string | null;
  sunset: string | null;
  days: WeatherDay[];
  hours: WeatherHour[];
  updatedAt: string | null;
  [key: string]: Json;
}

export interface StoredWeather {
  units: WeatherUnits;
  primaryId: string;
  locations: Record<string, StoredLocation>;
  [key: string]: Json;
}
