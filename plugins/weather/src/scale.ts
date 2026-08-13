import type { WeatherArtSize } from './art.js';

/** Panel border/padding (4) + place/status header (1). */
export const HERO_CHROME_ROWS = 5;

/** Blank rows above and below the hero — negotiable when rows are tight. */
export const HERO_GAP_ROWS = 2;

export const COMPACT_TOOLBAR_HEIGHT = 14;

export type HeroFont = 'block' | 'tiny' | 'text';
export type NowLayout = 'large' | 'compact';

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

/**
 * Picks large or compact hero treatment for the widget's cell size.
 *
 * Large mode draws temperature, humidity, and wind in the same font tier with
 * optional ASCII art. Compact mode uses a single uniform row of smaller stats.
 *
 * Breakpoints stay intentionally coarse (Spotify / ambient-noise style). The
 * widget still uses `overflow: 'hidden'` as a backstop, but block font is only
 * offered when a single 6-row band fits (inline) or a stacked 6+1+6 band fits.
 */
export function nowScale(width: number, height: number): NowScale {
  const compactToolbar = height < COMPACT_TOOLBAR_HEIGHT;
  const tightGaps = height < 18;

  if (width < 12 || height < 7) {
    return {
      layout: 'compact',
      font: 'text',
      art: 'none',
      heroesInline: true,
      showLabel: false,
      showDetail: false,
      showSecondary: false,
      tightGaps: true,
      compactToolbar,
    };
  }

  if (width >= 44 && height >= 14) {
    const heroesInline = width >= 92;
    // `block` is always 6 rows. Stacked humidity/wind need another 6-row band
    // plus a gap (13 total) → height >= 24 after chrome+toolbar+gaps. Inline
    // only needs one band, so width >= 92 and height >= 20 is enough.
    const font: HeroFont =
      width >= 80 && height >= 20 && (heroesInline || height >= 24) ? 'block' : 'tiny';
    const art: WeatherArtSize | 'none' = width >= 60 && height >= 16 ? 'large' : 'small';

    return {
      layout: 'large',
      font,
      art,
      heroesInline,
      showLabel: heroesInline,
      showDetail: heroesInline,
      showSecondary: true,
      tightGaps,
      compactToolbar,
    };
  }

  const font: HeroFont = width >= 26 && height >= 9 ? 'tiny' : 'text';
  const showSecondary = width >= 24;
  const art: WeatherArtSize | 'none' = width >= 24 && height >= 8 ? 'small' : 'none';

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
