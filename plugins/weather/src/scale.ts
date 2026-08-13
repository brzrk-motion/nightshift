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
    const font: HeroFont = width >= 80 && height >= 20 ? 'block' : 'tiny';
    const showSecondary = width >= 24;
    const showLabel = heroesInline && width >= 56;
    const showDetail = heroesInline && width >= 80;
    const art: WeatherArtSize | 'none' =
      width >= 60 && height >= 16 ? 'large' : width >= 30 ? 'small' : 'none';

    return {
      layout: 'large',
      font,
      art,
      heroesInline,
      showLabel,
      showDetail,
      showSecondary,
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
