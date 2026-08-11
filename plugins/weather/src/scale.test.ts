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
  it('draws everything in the block font when the widget is very wide', () => {
    expect(nowScale(96, 24)).toEqual({
      font: 'block',
      secondaryFont: 'block',
      art: 'large',
      heroesInline: true,
      showLabel: true,
      showDetail: true,
      showSecondary: true,
      tightGaps: false,
      compactToolbar: false,
    });
  });

  it('trades the toolbar borders for hero rows in a short widget', () => {
    expect(nowScale(48, COMPACT_TOOLBAR_HEIGHT).compactToolbar).toBe(false);
    expect(nowScale(48, COMPACT_TOOLBAR_HEIGHT - 1).compactToolbar).toBe(true);
    // The two rows the buttons give back are what keep the block font at 12.
    expect(nowScale(48, 12)).toMatchObject({ font: 'block', showSecondary: true });
    // ...and all three values survive at 10, where nothing fit before.
    expect(nowScale(30, 10)).toMatchObject({ font: 'tiny', showSecondary: true });
  });

  it('keeps the gaps around the hero when they cost it nothing', () => {
    expect(nowScale(96, 24).tightGaps).toBe(false);
    expect(nowScale(44, 24).tightGaps).toBe(false);
    expect(nowScale(30, 13).tightGaps).toBe(false);
  });

  it('keeps the big temperature and drops humidity and wind to plain text', () => {
    expect(nowScale(72, 22)).toMatchObject({
      font: 'block',
      secondaryFont: 'text',
      art: 'large',
      heroesInline: true,
      showDetail: true,
    });
    expect(nowScale(64, 18)).toMatchObject({
      font: 'block',
      secondaryFont: 'text',
      art: 'large',
      heroesInline: true,
    });
  });

  it('stacks the stats under the temperature in a tall narrow widget', () => {
    expect(nowScale(44, 24)).toMatchObject({
      font: 'block',
      secondaryFont: 'text',
      art: 'large',
      heroesInline: false,
      showLabel: true,
    });
  });

  it('drops the labels the units already imply rather than the art', () => {
    // The block temperature and the large art both fit at 48x18; naming the
    // values does not, and `°C`/`%`/`km/h` say what they are anyway.
    expect(nowScale(48, 18)).toMatchObject({
      font: 'block',
      art: 'large',
      showLabel: false,
      showDetail: false,
    });
  });

  it('spends the gaps around the hero before it steps the temperature down', () => {
    // At 13 rows the two blank rows are exactly what leaves six for `block`.
    expect(nowScale(48, 13)).toMatchObject({ font: 'block', tightGaps: true });
    // 11 rows cannot reach six however they are spent, so the font steps down —
    // to `tiny`, which is two rows, rather than all the way to plain text.
    expect(nowScale(48, 11)).toMatchObject({ font: 'tiny', showSecondary: true });
    expect(nowScale(40, 14)).toMatchObject({ font: 'tiny', art: 'large', showSecondary: true });
  });

  it('drops to the tiny font in a short widget, losing the extra lines first', () => {
    expect(nowScale(30, 12)).toMatchObject({
      font: 'tiny',
      art: 'small',
      showDetail: false,
    });
    // A stacked column has the width for "Feels 21°C" where an inline row does not.
    expect(nowScale(24, 30)).toMatchObject({
      font: 'tiny',
      heroesInline: false,
      showDetail: true,
    });
    // Two rows left: the three values keep their units and lose their names.
    expect(nowScale(30, 8)).toMatchObject({
      font: 'tiny',
      art: 'none',
      showLabel: false,
      showSecondary: true,
    });
  });

  it('keeps only the temperature when there is no width for the rest', () => {
    expect(nowScale(24, 8)).toMatchObject({ font: 'tiny', art: 'none', showSecondary: false });
    expect(nowScale(16, 40)).toMatchObject({ font: 'tiny', showSecondary: false });
    // Rows, not columns, ran out at 96x8 — all three values still fit across it.
    expect(nowScale(96, 8)).toMatchObject({ font: 'tiny', showSecondary: true });
    // Under 14 columns even the tiny digits do not fit; plain text is the floor.
    expect(nowScale(12, 8)).toMatchObject({ font: 'text', showSecondary: false });
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
        // With under a row to draw in there is no rung that would have helped;
        // the widget clips and `overflow: hidden` is what stops the bleed.
        if (heroRows < 1) continue;

        const extra = (scale.showLabel ? 1 : 0) + (scale.showDetail ? 1 : 0);
        const hero = GLYPH_ROWS[scale.font] + extra;
        const secondary = GLYPH_ROWS[scale.secondaryFont] + extra;
        const rows = !scale.showSecondary
          ? hero
          : scale.heroesInline
            ? Math.max(hero, secondary)
            : hero + 1 + secondary;
        const artRows = scale.art === 'none' ? 0 : weatherArt('clear', scale.art).length;

        expect({ width, height, rows: Math.max(rows, artRows) }).toEqual({
          width,
          height,
          rows: Math.min(Math.max(rows, artRows), heroRows),
        });
      }
    }
  });

  it('never draws the stats larger than the temperature', () => {
    for (let width = 8; width <= 140; width += 1) {
      for (let height = 4; height <= 48; height += 1) {
        const scale = nowScale(width, height);
        expect(RANK[scale.secondaryFont]).toBeLessThanOrEqual(RANK[scale.font]);
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
