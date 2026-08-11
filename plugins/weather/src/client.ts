import type { PluginFetchInit } from '@nightshift/sdk';
import { weatherCodeInfo } from './codes.js';
import type { WeatherDay, WeatherHour, WeatherUnits } from './entity.js';

export type WeatherFetch = (url: string, init?: PluginFetchInit) => Promise<Response>;

export interface GeocodedPlace {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export interface ForecastResult {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  condition: string;
  sunrise: string | null;
  sunset: string | null;
  days: WeatherDay[];
  hours: WeatherHour[];
}

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Parse `"lat,lon"` when the user pastes coordinates instead of a place name. */
export function parseCoordinates(
  query: string,
): { latitude: number; longitude: number } | undefined {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

export async function geocode(
  fetchFn: WeatherFetch,
  query: string,
): Promise<GeocodedPlace | undefined> {
  const coords = parseCoordinates(query);
  if (coords) {
    return { name: query.trim(), ...coords };
  }

  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query.trim())}&count=1&language=en&format=json`;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status})`);
  }
  const body = (await response.json()) as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      admin1?: string;
    }>;
  };
  const hit = body.results?.[0];
  if (!hit) return undefined;

  const parts = [hit.name, hit.admin1, hit.country].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return {
    name: parts.join(', '),
    latitude: hit.latitude,
    longitude: hit.longitude,
    ...(hit.country === undefined ? {} : { country: hit.country }),
    ...(hit.admin1 === undefined ? {} : { admin1: hit.admin1 }),
  };
}

function unitParams(units: WeatherUnits): string {
  if (units === 'imperial') {
    return 'temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch';
  }
  return 'temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm';
}

export async function fetchForecast(
  fetchFn: WeatherFetch,
  latitude: number,
  longitude: number,
  units: WeatherUnits,
): Promise<ForecastResult> {
  const params = [
    `latitude=${latitude}`,
    `longitude=${longitude}`,
    'current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m',
    'daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum',
    'hourly=temperature_2m,weather_code',
    'forecast_days=7',
    'forecast_hours=24',
    'timezone=auto',
    unitParams(units),
  ].join('&');

  const response = await fetchFn(`${FORECAST_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Forecast failed (${response.status})`);
  }

  const body = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      wind_direction_10m?: number;
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      sunrise?: string[];
      sunset?: string[];
      precipitation_sum?: number[];
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      weather_code?: number[];
    };
  };

  const current = body.current ?? {};
  const weatherCode = current.weather_code ?? 0;
  const daily = body.daily;
  const days: WeatherDay[] = [];
  const dayCount = daily?.time?.length ?? 0;
  for (let i = 0; i < dayCount; i += 1) {
    const code = daily?.weather_code?.[i] ?? 0;
    days.push({
      date: daily?.time?.[i] ?? '',
      weatherCode: code,
      condition: weatherCodeInfo(code).label,
      tempMax: daily?.temperature_2m_max?.[i] ?? 0,
      tempMin: daily?.temperature_2m_min?.[i] ?? 0,
      precipitationSum: daily?.precipitation_sum?.[i] ?? 0,
    });
  }

  const hourly = body.hourly;
  const hours: WeatherHour[] = [];
  const hourCount = Math.min(24, hourly?.time?.length ?? 0);
  for (let i = 0; i < hourCount; i += 1) {
    hours.push({
      time: hourly?.time?.[i] ?? '',
      temperature: hourly?.temperature_2m?.[i] ?? 0,
      weatherCode: hourly?.weather_code?.[i] ?? 0,
    });
  }

  return {
    temperature: current.temperature_2m ?? 0,
    feelsLike: current.apparent_temperature ?? current.temperature_2m ?? 0,
    humidity: current.relative_humidity_2m ?? 0,
    windSpeed: current.wind_speed_10m ?? 0,
    windDirection: current.wind_direction_10m ?? 0,
    weatherCode,
    condition: weatherCodeInfo(weatherCode).label,
    sunrise: daily?.sunrise?.[0] ?? null,
    sunset: daily?.sunset?.[0] ?? null,
    days,
    hours,
  };
}
