import { describe, expect, it } from 'vitest';
import {
  ART_WIDTH,
  ART_WIDTH_SMALL,
  WEATHER_ART,
  WEATHER_ART_SMALL,
  heroDigits,
  weatherArt,
} from './art.js';
import { weatherCodeInfo } from './codes.js';

describe('weather art', () => {
  it('keeps every icon the same height and width', () => {
    for (const lines of Object.values(WEATHER_ART)) {
      expect(lines).toHaveLength(5);
      for (const line of lines) {
        expect(line).toHaveLength(ART_WIDTH);
      }
    }
  });

  it('keeps the small set to its own fixed box', () => {
    expect(Object.keys(WEATHER_ART_SMALL)).toEqual(Object.keys(WEATHER_ART));
    for (const lines of Object.values(WEATHER_ART_SMALL)) {
      expect(lines).toHaveLength(3);
      for (const line of lines) {
        expect(line).toHaveLength(ART_WIDTH_SMALL);
      }
    }
  });

  it('closes cloud bodies on the right edge', () => {
    for (const kind of ['partly', 'cloudy', 'rain', 'snow', 'storm'] as const) {
      expect(WEATHER_ART[kind].some((line) => line.includes(')'))).toBe(true);
    }
  });

  it('maps WMO codes to an art family', () => {
    expect(weatherCodeInfo(0).art).toBe('clear');
    expect(weatherCodeInfo(63).art).toBe('rain');
    expect(weatherCodeInfo(95).art).toBe('storm');
    expect(weatherArt('storm')[0]).toContain('.--.');
  });

  it('formats digits for the block ascii-font', () => {
    expect(heroDigits(22.4)).toBe('22');
    expect(heroDigits(null)).toBe('--');
  });
});
