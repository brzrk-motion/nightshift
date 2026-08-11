import { describe, expect, it } from 'vitest';
import {
  COMPACT_TOOLBAR_HEIGHT,
  HERO_CHROME_ROWS,
  HERO_GAP_ROWS,
  nowScale,
  type HeroFont,
} from './scale.js';
import { WEATHER_ART, WEATHER_ART_SMALL, weatherArt } from './art.js';

const GLYPH_ROWS: Record<HeroFont, number> = { block: 6, tiny: 2, text: 1 };
const RANK: Record<HeroFont, number> = { text: 0, tiny: 1, block: 2 };

describe('nowScale', () => {
  it('uses large mode with one font tier for every stat in a wide widget', () => {
    expect(nowScale(96, 24)).toMatchObject({
      layout: 'large',
      font: 'block',
      showSecondary: true,
      heroesInline: true,
    });
  });

  it('never mixes font sizes — humidity and wind match the temperature', () => {
    for (let width = 8; width <= 140; width += 1) {
      for (let height = 4; height <= 48; height += 1) {
        const scale = nowScale(width, height);
        expect(scale).not.toHaveProperty('secondaryFont');
      }
    }
  });

  it('uses large stacked layout in a medium widget instead of shrinking only the stats', () => {
    expect(nowScale(72, 22)).toMatchObject({
      layout: 'large',
      font: 'tiny',
      heroesInline: false,
      showSecondary: true,
    });
    expect(nowScale(48, 18)).toMatchObject({
      layout: 'large',
      showSecondary: true,
    });
  });

  it('switches to compact mode with a uniform smaller font when large does not fit', () => {
    expect(nowScale(30, 11)).toMatchObject({
      layout: 'compact',
      font: 'tiny',
    });
    expect(nowScale(22, 9)).toMatchObject({
      layout: 'compact',
      font: 'text',
      showSecondary: false,
    });
  });

  it('trades the toolbar borders for hero rows in a short widget', () => {
    expect(nowScale(48, COMPACT_TOOLBAR_HEIGHT).compactToolbar).toBe(false);
    expect(nowScale(48, COMPACT_TOOLBAR_HEIGHT - 1).compactToolbar).toBe(true);
    expect(nowScale(48, 12)).toMatchObject({ layout: 'compact', font: 'tiny' });
    expect(nowScale(30, 10)).toMatchObject({ layout: 'compact', showSecondary: true });
  });

  it('keeps the gaps around the hero when they cost it nothing', () => {
    expect(nowScale(96, 24).tightGaps).toBe(false);
    expect(nowScale(44, 24).tightGaps).toBe(false);
  });

  it('spends the gaps around the hero before stepping down a mode', () => {
    expect(nowScale(48, 13)).toMatchObject({ layout: 'compact' });
    expect(nowScale(48, 11)).toMatchObject({ layout: 'compact', font: 'tiny' });
  });

  it('keeps only the temperature when there is no width for the rest', () => {
    expect(nowScale(16, 40)).toMatchObject({ layout: 'compact', showSecondary: false });
    expect(nowScale(12, 8)).toMatchObject({ layout: 'compact', font: 'text', showSecondary: false });
  });

  it('never asks for more rows than the widget has', () => {
    for (let width = 8; width <= 140; width += 1) {
      for (let height = 4; height <= 48; height += 1) {
        const scale = nowScale(width, height);
        const heroRows =
          height -
          HERO_CHROME_ROWS -
          (scale.tightGaps ? 0 : HERO_GAP_ROWS) -
          (scale.compactToolbar ? 1 : 3);
        if (heroRows < 1) continue;

        const extra = (scale.showLabel ? 1 : 0) + (scale.showDetail ? 1 : 0);
        const hero = GLYPH_ROWS[scale.font] + extra;
        const rows = !scale.showSecondary
          ? hero
          : scale.heroesInline
            ? hero
            : hero + 1 + hero;
        const artRows = scale.art === 'none' ? 0 : weatherArt('clear', scale.art).length;

        expect({ width, height, rows: Math.max(rows, artRows) }).toEqual({
          width,
          height,
          rows: Math.min(Math.max(rows, artRows), heroRows),
        });
      }
    }
  });

  it('only ever grows as the widget grows', () => {
    for (let width = 8; width <= 140; width += 1) {
      for (let height = 5; height <= 48; height += 1) {
        const here = RANK[nowScale(width, height).font];
        expect(here).toBeGreaterThanOrEqual(RANK[nowScale(width, height - 1).font]);
        expect(here).toBeGreaterThanOrEqual(RANK[nowScale(width - 1, height).font]);
      }
    }
  });
});

describe('weatherArt sizes', () => {
  it('returns the large art by default', () => {
    expect(weatherArt('clear')).toBe(WEATHER_ART.clear);
    expect(weatherArt('clear', 'large')).toBe(WEATHER_ART.clear);
    expect(weatherArt('clear', 'small')).toBe(WEATHER_ART_SMALL.clear);
  });
});
