import type { BadgeTone, IconName } from '@nightshift/sdk';
import type { WeatherArtKind } from './art.js';

/** WMO weather interpretation codes → label, icon, art family, tone. */

export interface WeatherCodeInfo {
  label: string;
  /** Nightshift `Icon` name — geometric glyphs, not emoji. */
  icon: IconName;
  art: WeatherArtKind;
  tone: BadgeTone;
}

const ART_ICONS: Record<WeatherArtKind, IconName> = {
  clear: 'weatherClear',
  partly: 'weatherPartly',
  cloudy: 'weatherCloudy',
  fog: 'weatherFog',
  rain: 'weatherRain',
  snow: 'weatherSnow',
  storm: 'weatherStorm',
  unknown: 'weatherUnknown',
};

const CODES: Record<number, Omit<WeatherCodeInfo, 'icon'>> = {
  0: { label: 'Clear', art: 'clear', tone: 'accent' },
  1: { label: 'Mainly clear', art: 'clear', tone: 'accent' },
  2: { label: 'Partly cloudy', art: 'partly', tone: 'neutral' },
  3: { label: 'Overcast', art: 'cloudy', tone: 'neutral' },
  45: { label: 'Fog', art: 'fog', tone: 'neutral' },
  48: { label: 'Rime fog', art: 'fog', tone: 'neutral' },
  51: { label: 'Light drizzle', art: 'rain', tone: 'neutral' },
  53: { label: 'Drizzle', art: 'rain', tone: 'neutral' },
  55: { label: 'Heavy drizzle', art: 'rain', tone: 'warning' },
  56: { label: 'Freezing drizzle', art: 'rain', tone: 'warning' },
  57: { label: 'Freezing drizzle', art: 'rain', tone: 'warning' },
  61: { label: 'Light rain', art: 'rain', tone: 'neutral' },
  63: { label: 'Rain', art: 'rain', tone: 'warning' },
  65: { label: 'Heavy rain', art: 'rain', tone: 'warning' },
  66: { label: 'Freezing rain', art: 'rain', tone: 'danger' },
  67: { label: 'Freezing rain', art: 'rain', tone: 'danger' },
  71: { label: 'Light snow', art: 'snow', tone: 'accent' },
  73: { label: 'Snow', art: 'snow', tone: 'accent' },
  75: { label: 'Heavy snow', art: 'snow', tone: 'warning' },
  77: { label: 'Snow grains', art: 'snow', tone: 'neutral' },
  80: { label: 'Rain showers', art: 'rain', tone: 'warning' },
  81: { label: 'Rain showers', art: 'rain', tone: 'warning' },
  82: { label: 'Heavy showers', art: 'rain', tone: 'danger' },
  85: { label: 'Snow showers', art: 'snow', tone: 'accent' },
  86: { label: 'Snow showers', art: 'snow', tone: 'warning' },
  95: { label: 'Thunderstorm', art: 'storm', tone: 'danger' },
  96: { label: 'Thunderstorm', art: 'storm', tone: 'danger' },
  99: { label: 'Thunderstorm', art: 'storm', tone: 'danger' },
};

function withIcon(info: Omit<WeatherCodeInfo, 'icon'>): WeatherCodeInfo {
  return { ...info, icon: ART_ICONS[info.art] };
}

export function weatherCodeInfo(code: number | null | undefined): WeatherCodeInfo {
  if (code === null || code === undefined) {
    return withIcon({ label: 'Unknown', art: 'unknown', tone: 'neutral' });
  }
  const known = CODES[code];
  if (known) return withIcon(known);
  return withIcon({ label: `Code ${code}`, art: 'unknown', tone: 'neutral' });
}
