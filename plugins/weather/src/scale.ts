import type { WeatherArtSize } from './art.js';

/**
 * Two layout modes for the now-widget hero — large and compact — instead of a
 * ladder that mixes a block-font temperature with plain-text humidity and wind.
 *
 * OpenTUI's `ascii-font` is a fixed-size framebuffer and boxes do not clip by
 * default, so every rung is measured against the cells available before draw.
 */

export type HeroFont = 'block' | 'tiny' | 'text';
export type NowLayout = 'large' | 'compact';

const FONT_ROWS: Record<HeroFont, number> = { block: 6, tiny: 2, text: 1 };
const ART_ROWS: Record<WeatherArtSize, number> = { large: 5, small: 3 };

/** Panel border/padding (4) + place/status header (1). */
export const HERO_CHROME_ROWS = 5;

/** Blank rows above and below the hero — negotiable when rows are tight. */
export const HERO_GAP_ROWS = 2;

/** `Button` is three rows; a row of pressable chips is one. */
const TOOLBAR_ROWS = { full: 3, compact: 1 };

export const COMPACT_TOOLBAR_HEIGHT = 14;

const PANEL_COLS = 4;
const GAP_COLS = 2;

/** Cells each value takes with its unit, per font. */
const VALUE_COLS: Record<HeroFont, { temp: number; humidity: number; wind: number }> = {
  block: { temp: 20, humidity: 26, wind: 29 },
  tiny: { temp: 8, humidity: 12, wind: 15 },
  text: { temp: 6, humidity: 5, wind: 8 },
};

const LABEL_COLS = { temp: 12, humidity: 8, wind: 4 };
const ART_COLS: Record<WeatherArtSize | 'none', number> = { large: 15, small: 8, none: 0 };

/** Minimum widget size to attempt each mode. */
const LARGE_MIN_WIDTH = 44;
const LARGE_MIN_HEIGHT = 13;
const COMPACT_MIN_WIDTH = 18;
const COMPACT_MIN_HEIGHT = 7;

/** Inline block stats need this much width with large art. */
const LARGE_INLINE_WIDTH = 92;

export interface NowScale {
  layout: NowLayout;
  /** Same font for temperature, humidity, and wind — never mixed. */
  font: HeroFont;
  art: WeatherArtSize | 'none';
  /** Humidity and wind beside the temperature (large wide widgets only). */
  heroesInline: boolean;
  showLabel: boolean;
  showDetail: boolean;
  showSecondary: boolean;
  tightGaps: boolean;
  compactToolbar: boolean;
}

function widthForStats(
  font: HeroFont,
  art: WeatherArtSize | 'none',
  inline: boolean,
  showLabel: boolean,
  showSecondary: boolean,
): number {
  const hero = VALUE_COLS[font];
  const widest = (value: number, label: number): number =>
    showLabel ? Math.max(value, label) : value;

  const temp = widest(hero.temp, LABEL_COLS.temp);
  if (!showSecondary) return PANEL_COLS + ART_COLS[art] + temp + (art === 'none' ? 2 : 0);

  const humidity = widest(hero.humidity, LABEL_COLS.humidity);
  const wind = widest(hero.wind, LABEL_COLS.wind);

  if (inline) {
    return PANEL_COLS + ART_COLS[art] + temp + humidity + wind + GAP_COLS * 2;
  }

  return (
    PANEL_COLS +
    ART_COLS[art] +
    Math.max(temp, humidity + GAP_COLS + wind) +
    (art === 'none' ? 2 : 0)
  );
}

function rowsForStats(
  font: HeroFont,
  inline: boolean,
  showLabel: boolean,
  showDetail: boolean,
  showSecondary: boolean,
): number {
  const extra = (showLabel ? 1 : 0) + (showDetail ? 1 : 0);
  const hero = FONT_ROWS[font] + extra;
  const secondary = FONT_ROWS[font] + extra;

  if (!showSecondary) return hero;
  if (inline) return Math.max(hero, secondary);
  return hero + 1 + secondary;
}

function tryLarge(
  width: number,
  heroRows: number,
  tightGaps: boolean,
  compactToolbar: boolean,
): NowScale | null {
  if (width < LARGE_MIN_WIDTH || heroRows < FONT_ROWS.block) return null;

  const fonts: HeroFont[] =
    heroRows >= FONT_ROWS.block + 2
      ? ['block', 'tiny']
      : heroRows >= FONT_ROWS.tiny + 1
        ? ['tiny']
        : [];

  for (const font of fonts) {
    const inlineWidths = [width >= LARGE_INLINE_WIDTH, width >= LARGE_MIN_WIDTH];

    for (const art of ['large', 'small', 'none'] as const) {
      if (art !== 'none' && heroRows < ART_ROWS[art]) continue;

      for (const heroesInline of inlineWidths) {
        if (heroesInline && width < LARGE_MIN_WIDTH) continue;

        for (const [showLabel, showDetail] of [
          [true, true],
          [true, false],
          [false, false],
        ] as const) {
          if (showDetail && (!showLabel || !heroesInline)) continue;

          const cols = widthForStats(font, art, heroesInline, showLabel, true);
          if (width < cols) continue;

          const rows = rowsForStats(font, heroesInline, showLabel, showDetail, true);
          const artRows = art === 'none' ? 0 : ART_ROWS[art];
          if (Math.max(rows, artRows) > heroRows) continue;

          return {
            layout: 'large',
            font,
            art,
            heroesInline,
            showLabel,
            showDetail,
            showSecondary: true,
            tightGaps,
            compactToolbar,
          };
        }
      }
    }
  }

  return null;
}

function tryCompact(
  width: number,
  heroRows: number,
  tightGaps: boolean,
  compactToolbar: boolean,
): NowScale | null {
  if (width < COMPACT_MIN_WIDTH || heroRows < 1) return null;

  for (const art of ['small', 'none'] as const) {
    if (art !== 'none' && heroRows < ART_ROWS[art]) continue;

    const font: HeroFont = heroRows >= FONT_ROWS.tiny + 1 && width >= 26 ? 'tiny' : 'text';
    const showSecondary = width >= 24;

    const cols = widthForStats(font, art, true, false, showSecondary);
    if (width < cols) {
      if (showSecondary) {
        const solo = widthForStats(font, art, true, false, false);
        if (width >= solo) {
          return {
            layout: 'compact',
            font,
            art,
            heroesInline: true,
            showLabel: false,
            showDetail: false,
            showSecondary: false,
            tightGaps,
            compactToolbar,
          };
        }
      }
      continue;
    }

    const rows = rowsForStats(font, true, false, false, showSecondary);
    const artRows = art === 'none' ? 0 : ART_ROWS[art];
    if (Math.max(rows, artRows) > heroRows) continue;

    return {
      layout: 'compact',
      font,
      art,
      heroesInline: true,
      showLabel: false,
      showDetail: false,
      showSecondary,
      tightGaps,
      compactToolbar,
    };
  }

  return null;
}

/**
 * Picks large or compact hero treatment for the widget's cell size.
 *
 * Large mode draws temperature, humidity, and wind in the same font tier with
 * optional ASCII art. Compact mode uses a single uniform row of smaller stats.
 */
export function nowScale(width: number, height: number): NowScale {
  const compactToolbar = height < COMPACT_TOOLBAR_HEIGHT;
  const toolbarRows = compactToolbar ? TOOLBAR_ROWS.compact : TOOLBAR_ROWS.full;

  for (const tightGaps of [false, true]) {
    const heroRows = height - HERO_CHROME_ROWS - toolbarRows - (tightGaps ? 0 : HERO_GAP_ROWS);

    if (height >= LARGE_MIN_HEIGHT) {
      const large = tryLarge(width, heroRows, tightGaps, compactToolbar);
      if (large) return large;
    }

    if (height >= COMPACT_MIN_HEIGHT) {
      const compact = tryCompact(width, heroRows, tightGaps, compactToolbar);
      if (compact) return compact;
    }
  }

  return {
    layout: 'compact',
    font: 'text',
    art: 'none',
    heroesInline: true,
    showLabel: false,
    showDetail: false,
    showSecondary: false,
    tightGaps: true,
    compactToolbar: height < COMPACT_TOOLBAR_HEIGHT,
  };
}
