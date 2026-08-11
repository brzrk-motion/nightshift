import type { WeatherArtSize } from './art.js';

/**
 * How much of the now-widget hero fits in the cells it was given.
 *
 * OpenTUI's `ascii-font` is a fixed-size framebuffer — `block` is always six
 * rows tall whatever the widget's size — and boxes do not clip by default, so
 * a hero drawn bigger than its slot spills over the toolbar and past the panel
 * border. Rather than let that happen, the widget walks a fixed ladder of
 * treatments and takes the first rung that fits — spending the blank rows
 * around the hero, and then the font itself, as the cells run out.
 */

/**
 * Fonts a value can be drawn in, largest first.
 *
 * Only these three. OpenTUI's remaining ascii fonts are no help: `slick`,
 * `grid`, `pallet`, `shade` and `huge` are all six rows or more, same as
 * `block`, so they buy nothing where rows are what ran out. `tiny` is the one
 * middle rung — two rows, so twice the height of plain text, at the cost of
 * being blockier to read (`▀█ / █▄` is a 2) — and plain text is the floor.
 */
export type HeroFont = 'block' | 'tiny' | 'text';

/** Rows each font's glyphs occupy, per `measureText` in @opentui/core. */
const FONT_ROWS: Record<HeroFont, number> = { block: 6, tiny: 2, text: 1 };

const ART_ROWS: Record<WeatherArtSize, number> = { large: 5, small: 3 };

/**
 * Rows the widget spends before the hero gets any, toolbar aside: the panel's
 * border and padding (4) and the place/status header (1).
 */
export const HERO_CHROME_ROWS = 5;

/**
 * The blank rows above and below the hero. Unlike the rest of the chrome these
 * are negotiable: two rows of breathing room are worth less than a temperature
 * legible at a glance, so `nowScale` spends them on a bigger font when that is
 * the difference between rungs.
 */
export const HERO_GAP_ROWS = 2;

/** `Button` is three rows; a row of pressable `[chips]` is one. */
const TOOLBAR_ROWS = { full: 3, compact: 1 };

/**
 * Below this height the toolbar's two spare rows are worth more to the hero
 * than the buttons' borders are — the same trade the clock plugin makes with
 * its own settings panel.
 */
export const COMPACT_TOOLBAR_HEIGHT = 14;

/**
 * Cells each value takes with its unit beside it, per `measureText`: the widest
 * each one realistically gets is `22 °C`, `100 %` and `108 km/h`.
 */
const VALUE_COLS: Record<HeroFont, { temp: number; humidity: number; wind: number }> = {
  block: { temp: 20, humidity: 26, wind: 29 },
  tiny: { temp: 8, humidity: 12, wind: 15 },
  text: { temp: 6, humidity: 5, wind: 8 },
};

/** Cells the widest label under each value takes: `Feels -12°C`, then the names. */
const LABEL_COLS = { temp: 12, humidity: 8, wind: 4 };

/** Cells the art column takes, including the gap to the values beside it. */
const ART_COLS: Record<WeatherArtSize | 'none', number> = { large: 15, small: 8, none: 2 };

/** The panel's own border and padding. */
const PANEL_COLS = 4;

/** Breathing room between the three values when they share a row. */
const GAP_COLS = 2;

/**
 * One rung of the ladder. The temperature can be drawn larger than humidity
 * and wind — it is the number the widget exists for — so a rung names a font
 * for each — and dropping them entirely, leaving the temperature alone, is
 * itself a rung rather than a special case, so that the temperature's own font
 * still outranks it. Rungs are ordered by what matters most: the temperature's
 * font first, then the art, then the stats' font. Widths are not listed here;
 * they are computed from the tables above, because what a rung needs depends on
 * whether its labels are showing.
 */
interface Rung {
  font: HeroFont;
  secondaryFont: HeroFont;
  art: WeatherArtSize | 'none';
  /** Humidity and wind beside the temperature at all. */
  showSecondary: boolean;
}

const LADDER: readonly Rung[] = [
  { font: 'block', secondaryFont: 'block', art: 'large', showSecondary: true },
  { font: 'block', secondaryFont: 'text', art: 'large', showSecondary: true },
  { font: 'block', secondaryFont: 'text', art: 'small', showSecondary: true },
  { font: 'block', secondaryFont: 'text', art: 'none', showSecondary: true },
  { font: 'tiny', secondaryFont: 'tiny', art: 'large', showSecondary: true },
  { font: 'tiny', secondaryFont: 'text', art: 'large', showSecondary: true },
  { font: 'tiny', secondaryFont: 'text', art: 'small', showSecondary: true },
  { font: 'tiny', secondaryFont: 'text', art: 'none', showSecondary: true },
  { font: 'tiny', secondaryFont: 'tiny', art: 'none', showSecondary: false },
  { font: 'text', secondaryFont: 'text', art: 'large', showSecondary: true },
  { font: 'text', secondaryFont: 'text', art: 'small', showSecondary: true },
  { font: 'text', secondaryFont: 'text', art: 'none', showSecondary: true },
  { font: 'text', secondaryFont: 'text', art: 'none', showSecondary: false },
];

/** Cells `rung` needs, laid out inline or stacked, with or without labels. */
function widthNeeded(rung: Rung, heroesInline: boolean, showLabel: boolean): number {
  const hero = VALUE_COLS[rung.font];
  const stats = VALUE_COLS[rung.secondaryFont];
  const widest = (value: number, label: number): number =>
    showLabel ? Math.max(value, label) : value;

  const temp = widest(hero.temp, LABEL_COLS.temp);
  if (!rung.showSecondary) return PANEL_COLS + ART_COLS[rung.art] + temp;

  const humidity = widest(stats.humidity, LABEL_COLS.humidity);
  const wind = widest(stats.wind, LABEL_COLS.wind);

  return (
    PANEL_COLS +
    ART_COLS[rung.art] +
    (heroesInline ? temp + humidity + wind + GAP_COLS : Math.max(temp, humidity + 1 + wind))
  );
}

export interface NowScale {
  /** Font for the temperature. */
  font: HeroFont;
  /** Font for humidity and wind, never larger than the temperature's. */
  secondaryFont: HeroFont;
  art: WeatherArtSize | 'none';
  /** Temperature, humidity and wind across one row rather than stacked. */
  heroesInline: boolean;
  /** The condition line under each value. */
  showLabel: boolean;
  /** The quieter "Feels 21°C" line under that. */
  showDetail: boolean;
  /** Humidity and wind at all — the last thing to go. */
  showSecondary: boolean;
  /** The blank rows around the hero, given up to draw it larger. */
  tightGaps: boolean;
  /** One row of pressable labels instead of three rows of bordered buttons. */
  compactToolbar: boolean;
}

/**
 * Label and "Feels 21°C" detail combinations, richest first. Dropping them is
 * always allowed: every value is drawn with its unit beside it (`°C`, `%`,
 * `km/h`) and the art says what the condition is, so a label-less hero is
 * still readable — which is what lets the six-row temperature survive down to
 * six hero rows.
 */
const LABELLING: readonly [boolean, boolean][] = [
  [true, true],
  [true, false],
  [false, false],
];

function fit(
  rung: Rung,
  width: number,
  heroRows: number,
  tightGaps: boolean,
  compactToolbar: boolean,
): NowScale | null {
  if (rung.art !== 'none' && heroRows < ART_ROWS[rung.art]) return null;

  for (const [showLabel, showDetail] of LABELLING) {
    const inlineFits = width >= widthNeeded(rung, true, showLabel);
    // A lone temperature is inline by definition — there is nothing beside it
    // to stack under, so its only width is the one `widthNeeded` returned.
    if (!inlineFits && (!rung.showSecondary || width < widthNeeded(rung, false, showLabel))) {
      continue;
    }
    const heroesInline = inlineFits || !rung.showSecondary;

    // At the plain-text size "Feels 21°C" is wider than the temperature it sits
    // under, so inline it squeezes humidity and wind rather than adding to them.
    if (showDetail && heroesInline && rung.showSecondary && rung.font === 'text') continue;

    const extra = (showLabel ? 1 : 0) + (showDetail ? 1 : 0);
    const hero = FONT_ROWS[rung.font] + extra;
    const secondary = FONT_ROWS[rung.secondaryFont] + extra;
    // Inline they share the rows; stacked they take their own, plus a gap.
    const rows = !rung.showSecondary
      ? hero
      : heroesInline
        ? Math.max(hero, secondary)
        : hero + 1 + secondary;
    if (rows > heroRows) continue;

    return {
      font: rung.font,
      secondaryFont: rung.secondaryFont,
      art: rung.art,
      heroesInline,
      showLabel,
      showDetail,
      showSecondary: rung.showSecondary,
      tightGaps,
      compactToolbar,
    };
  }

  return null;
}

/**
 * Picks the richest hero treatment that fits `width` x `height` widget cells.
 *
 * The ladder's order is the priority order: a readable temperature first, then
 * the art, then the size of the stats beside it, and the labels last — every
 * value is drawn with its unit, and the art says what the condition is, so
 * labels are the one thing here that repeats what is already on screen.
 */
export function nowScale(width: number, height: number): NowScale {
  const compactToolbar = height < COMPACT_TOOLBAR_HEIGHT;
  const rows =
    height - HERO_CHROME_ROWS - (compactToolbar ? TOOLBAR_ROWS.compact : TOOLBAR_ROWS.full);

  // Two passes over the ladder, roomy first, so the gaps are only spent when
  // they buy a rung the widget could not otherwise reach — searching above the
  // roomy result rather than from the top is what makes that "only".
  let best: NowScale | null = null;
  let bestRung = LADDER.length;
  for (const tightGaps of [false, true]) {
    const heroRows = rows - (tightGaps ? 0 : HERO_GAP_ROWS);
    for (let index = 0; index < bestRung; index += 1) {
      const scale = fit(LADDER[index]!, width, heroRows, tightGaps, compactToolbar);
      if (scale) {
        best = scale;
        bestRung = index;
        break;
      }
    }
  }
  if (best) return best;

  // Not even one row to draw in: plain temperature, everything else dropped.
  return {
    font: 'text',
    secondaryFont: 'text',
    art: 'none',
    heroesInline: true,
    showLabel: false,
    showDetail: false,
    showSecondary: false,
    tightGaps: true,
    compactToolbar,
  };
}
