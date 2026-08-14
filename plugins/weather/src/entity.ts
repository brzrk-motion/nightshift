import type { Json } from '@nightshift/sdk';

/** Aggregate map of every configured location slot. */
export const WEATHER_LOCATIONS_ENTITY = 'weather.locations';

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
  /** Primary slot temperature — denormalized for automation flat-key triggers. */
  temperature: number | null;
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
  return { units, primaryId, locations: {}, temperature: null };
}

/** Persisted location slot — same fields as {@link WeatherLocation} minus live status. */
export type StoredWeatherLocation = {
  [K in keyof WeatherLocation as K extends 'status' | 'error' ? never : K]: WeatherLocation[K];
};

export interface StoredWeather {
  units: WeatherUnits;
  primaryId: string;
  locations: Record<string, StoredWeatherLocation>;
  [key: string]: Json;
}
