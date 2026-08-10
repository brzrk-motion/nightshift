/**
 * Design tokens that are not colour: the spacing scale and the border styles
 * every new component draws from, so density and framing stay consistent
 * without every component re-deciding what "compact" means.
 *
 * These live outside `theme.ts` because they do not vary by theme — a vibe
 * can retint the palette, but the rhythm of the layout stays put.
 */

/**
 * Terminal cells are coarse, so this scale is deliberately short: most of
 * Nightshift's density lives in `normal`, with `tight` for dense chrome (the
 * header, the nav rail) and `loose` for a widget that wants to breathe.
 */
export const SPACING = {
  none: 0,
  tight: 1,
  normal: 1,
  loose: 2,
  wide: 3,
} as const;

export type SpacingToken = keyof typeof SPACING;

/** Border styles OpenTUI supports, named for what they are used for here. */
export const BORDERS = {
  /** The frame around a panel or widget. */
  panel: 'rounded',
  /** A modal or overlay — the same style, kept as its own name so the two can
   * diverge later without hunting down every call site. */
  overlay: 'rounded',
  /** A quieter, single-line rule for chrome that should not read as a panel. */
  chrome: 'single',
} as const;

export type BorderToken = keyof typeof BORDERS;
