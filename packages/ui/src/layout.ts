/**
 * The layout system. OpenTUI does the actual flexbox work, so this module's
 * job is the part flexbox cannot decide on its own: how a dashboard should
 * *reshape* itself for the terminal it has been given, and how to split a
 * fixed number of cells between weighted children without losing one to
 * rounding.
 */

/** Below this many columns a row's widgets stack instead of sitting side by side. */
export const COMPACT_WIDTH = 72;
/** Above this many columns there is room for wider gutters and detail. */
export const WIDE_WIDTH = 132;
/** Nightshift refuses to draw a dashboard smaller than this. */
export const MIN_WIDTH = 40;
export const MIN_HEIGHT = 12;

export type Breakpoint = 'compact' | 'normal' | 'wide';

export interface TerminalSize {
  width: number;
  height: number;
}

export function resolveBreakpoint(width: number): Breakpoint {
  if (width < COMPACT_WIDTH) return 'compact';
  if (width < WIDE_WIDTH) return 'normal';
  return 'wide';
}

/** Whether a terminal this size can show a dashboard at all. */
export function isRenderable(size: TerminalSize): boolean {
  return size.width >= MIN_WIDTH && size.height >= MIN_HEIGHT;
}

/**
 * Splits `total` cells between weighted children, giving the leftover from
 * rounding to the largest remainders so the parts always add up to the whole.
 */
function weighted(total: number, weights: readonly number[], floor: number): number[] {
  const flexible = total - floor * weights.length;
  const sum = weights.reduce((accumulator, weight) => accumulator + weight, 0);
  const exact = weights.map((weight) => (flexible * weight) / sum);
  const sizes = exact.map((value) => floor + Math.floor(value));

  let remainder = total - sizes.reduce((accumulator, size) => accumulator + size, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let cursor = 0; remainder > 0; cursor = (cursor + 1) % order.length, remainder -= 1) {
    const target = order[cursor]?.index ?? 0;
    sizes[target] = (sizes[target] ?? 0) + 1;
  }

  return sizes;
}

/**
 * Splits `total` cells between weighted children, keeping every child at
 * `minimum` or above.
 *
 * The weights come first: the minimum is a rescue, not a tax. Only when a
 * straight weighted split would starve a child does every child get the
 * minimum up front and share out what is left — so the common case of `2:1`
 * across a wide terminal really is two thirds and one third.
 */
export function distribute(total: number, weights: readonly number[], minimum = 0): number[] {
  const count = weights.length;
  if (count === 0) return [];

  const safeWeights = weights.map((weight) => (weight > 0 ? weight : 1));
  const floor = Math.max(0, Math.floor(minimum));

  // Not enough room to honour the minimums: fall back to an even split of
  // whatever there is, which at least keeps every child visible.
  if (floor * count > total) {
    const even = Math.floor(total / count);
    const sizes = new Array<number>(count).fill(even);
    let spare = total - even * count;
    for (let index = 0; spare > 0; index = (index + 1) % count, spare -= 1) {
      sizes[index] = (sizes[index] ?? 0) + 1;
    }
    return sizes;
  }

  const proportional = weighted(total, safeWeights, 0);
  if (proportional.every((size) => size >= floor)) return proportional;
  return weighted(total, safeWeights, floor);
}

export interface LayoutItem {
  /** Relative width within its row. Defaults to an equal share. */
  span?: number | undefined;
  /** Columns below which this item is better off on a row of its own. */
  minWidth?: number | undefined;
}

export interface LayoutRow {
  /** Relative height within the dashboard. Defaults to an equal share. */
  height?: number | undefined;
  items: LayoutItem[];
}

export interface PlacedItem<Item extends LayoutItem = LayoutItem> {
  item: Item;
  /** Index of the item within the row it was authored in. */
  index: number;
  /** Flex weight to hand to the renderer. */
  grow: number;
  /** Columns this item will get at the current terminal width. */
  width: number;
}

export interface PlacedRow<Item extends LayoutItem = LayoutItem> {
  /** Index of the row this came from; several placed rows may share it. */
  source: number;
  grow: number;
  height: number;
  items: PlacedItem<Item>[];
}

export interface LayoutPlan<Item extends LayoutItem = LayoutItem> {
  breakpoint: Breakpoint;
  size: TerminalSize;
  /** False when the terminal is too small to draw anything useful. */
  renderable: boolean;
  rows: PlacedRow<Item>[];
}

/** Rows narrower than this are not worth splitting further. */
const MIN_COLUMN_WIDTH = 24;

/**
 * Turns authored rows into rows the renderer can draw at this terminal size.
 *
 * Two things happen here. A row whose widgets would each end up narrower than
 * a readable column is split into several rows — that is what makes the
 * dashboard responsive rather than merely squashed. And every row and widget
 * is given both a flex weight, which the renderer uses, and a concrete cell
 * size, which widgets that draw their own content (charts, tables) need in
 * advance.
 */
export function planLayout<Item extends LayoutItem>(
  rows: readonly { height?: number | undefined; items: readonly Item[] }[],
  size: TerminalSize,
): LayoutPlan<Item> {
  const breakpoint = resolveBreakpoint(size.width);
  const renderable = isRenderable(size);

  const groups: {
    source: number;
    offset: number;
    height: number | undefined;
    items: readonly Item[];
  }[] = [];

  for (const [source, row] of rows.entries()) {
    const items = row.items.filter(Boolean);
    if (items.length === 0) continue;

    // How many widgets fit side by side before they stop being readable.
    const perRow = Math.max(1, Math.min(items.length, Math.floor(size.width / MIN_COLUMN_WIDTH)));
    const chunks = breakpoint === 'compact' ? 1 : perRow;

    for (let start = 0; start < items.length; start += chunks) {
      groups.push({
        source,
        offset: start,
        height: row.height,
        items: items.slice(start, start + chunks),
      });
    }
  }

  if (groups.length === 0) {
    return { breakpoint, size, renderable, rows: [] };
  }

  // A row that was split contributes its authored height once per piece, so
  // splitting does not quietly shrink it relative to its neighbours.
  const heights = distribute(
    size.height,
    groups.map((group) => group.height ?? 1),
    Math.min(3, Math.floor(size.height / groups.length)),
  );

  return {
    breakpoint,
    size,
    renderable,
    rows: groups.map((group, rowIndex) => {
      const widths = distribute(
        size.width,
        group.items.map((item) => item.span ?? 1),
        Math.min(MIN_COLUMN_WIDTH, Math.floor(size.width / group.items.length)),
      );

      return {
        source: group.source,
        grow: group.height ?? 1,
        height: heights[rowIndex] ?? 0,
        items: group.items.map((item, itemIndex) => ({
          item,
          index: group.offset + itemIndex,
          grow: item.span ?? 1,
          width: widths[itemIndex] ?? 0,
        })),
      };
    }),
  };
}
