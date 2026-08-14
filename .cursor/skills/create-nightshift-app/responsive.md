# Responsive widgets

A widget is handed a rectangle of terminal cells it does not control. The user resizes the
terminal, another widget joins its row, a dashboard gives it `span: 2` instead of `1`.
Nothing about this is handled for you:

- **OpenTUI boxes do not clip.** Content larger than its box draws over whatever is next
  to it — the toolbar below, the panel border, the neighbouring widget.
- **`ascii-font` is a fixed-size framebuffer.** `block` is always 6 rows tall, whatever
  space it has.
- **`Button` is always 3 rows tall.** Three buttons in a 6-row widget leave nothing for
  content.
- **Text does not truncate itself.** A long track name pushes its row wider.

So responsiveness is something a widget _is written to do_.

## Method

1. **Budget the cells.** Subtract the chrome you cannot avoid from `width`/`height`.
2. **Decide in a pure module.** A function `(width, height) => Treatment`, unit-tested,
   living in `format.ts` or `scale.ts`. Not `width < 40` scattered through JSX.
3. **Render the treatment.** JSX branches on named fields (`scale.showSecondary`,
   `layout === 'compact'`), never on raw numbers.
4. **Backstop with `overflow: 'hidden'`** on the box holding the flexible content, so a
   mistake loses detail instead of drawing over the controls.

## Cell budget

`WidgetProps.width`/`height` include the panel the dashboard wraps you in.

| Cost                                  | Cells                  |
| ------------------------------------- | ---------------------- |
| Panel border + `normal` padding       | 4 columns, 4 rows      |
| Each `gap: 1` between children        | 1 row / 1 column       |
| `Button` row (any number of buttons)  | 3 rows                 |
| `IconButton` / `Toggle` / chip row    | 1 row                  |
| `TextInput` row                       | 1 row                  |
| `ProgressBar`, `Sparkline`, `StatRow` | 1 row each             |
| `Tabs`                                | 1 row plus its content |
| `ascii-font` `block` / `tiny`         | 6 rows / 2 rows        |
| A text line                           | 1 row                  |

Name these as constants and derive the rest, the way `plugins/weather/src/scale.ts` does
with `HERO_CHROME_ROWS = 7` (4 panel + 1 header + 2 gaps).

## Pattern 1 — layout tiers

The simplest useful thing, and enough for most widgets. One function, three names.

```ts
export type SpotifyLayout = 'compact' | 'regular' | 'wide';

export function resolveLayout(width: number, height: number): SpotifyLayout {
  if (width < 44 || height < 8) return 'compact';
  if (width >= 72 && height >= 14) return 'wide';
  return 'regular';
}
```

`compact` trades bordered `Button`s for `IconButton`s, drops gaps to `0`, collapses the
title/artist/device stack to two lines. `wide` adds a `Divider` and a Disconnect button.
See `plugins/spotify/src/{format.ts,widgets.tsx}`.

## Pattern 2 — the ladder

For a widget with a hero that must shrink through several treatments. Enumerate the rungs
richest-first, measure each against the cells available, take the first that fits.
Prefer Pattern 1 breakpoints when coarse tiers are enough — weather's now-widget
(`plugins/weather/src/scale.ts`) does that now. Reach for a measured ladder only when
a breakpoint table would hide real fit bugs; the shape:

```ts
const LADDER: readonly Rung[] = [
  { font: 'block', secondaryFont: 'block', art: 'large' },
  { font: 'block', secondaryFont: 'text', art: 'large' },
  { font: 'block', secondaryFont: 'text', art: 'small' },
  { font: 'block', secondaryFont: 'text', art: 'none' },
  { font: 'text', secondaryFont: 'text', art: 'large' },
  // ...
];

export function nowScale(width: number, height: number): NowScale {
  const heroRows = height - HERO_CHROME_ROWS - toolbarRows;
  for (const rung of LADDER) {
    const scale = fit(rung, width, heroRows, compactToolbar);
    if (scale) return scale;
  }
  return FLOOR; // always renders something
}
```

Three things make this work:

- **The ladder's order is the priority order.** Weather keeps a readable temperature
  first, then the art, then the size of the stats beside it, and drops labels last —
  because every value already carries its unit and the art already says the condition, so
  labels are the one thing repeating information already on screen. Write that reasoning
  down; it is the design decision, not the code.
- **Widths are computed, not listed.** Rungs name treatments; a table of measured column
  costs per font turns a rung into a number. Adding a rung then cannot contradict a width.
- **There is always a floor rung** that fits anything, so the function is total.

## Pattern 3 — fit as many as will fit

For lists and strips, compute the count from the cells rather than slicing a constant.

```ts
function visibleDayCount(height: number): number {
  // Each day is one text row plus a gap cell between rows.
  return Math.max(3, Math.min(7, Math.floor((height - 5) / 2)));
}
```

Always clamp with both `Math.max` (a floor that stays useful) and `Math.min` (never more
than you have data for). Comment the arithmetic — `(height - 5) / 2` is unreadable without
the "row plus gap" note.

## Pattern 4 — reorient

When one axis runs out, use the other. Weather's forecast flips a vertical list of day
rows into a horizontal strip of day columns below 24 rows, and recounts how many fit from
`width` instead of `height`. Two small components (`ForecastDayRow`, `ForecastDayColumn`),
one boolean, no shared half-broken layout.

## What to trade, in order

Give up the things that repeat information already on screen before the things that carry
it.

| Pressure | Trade                                                                       |
| -------- | --------------------------------------------------------------------------- |
| Rows     | `Button` (3 rows) → `IconButton` or a `[chip]` (1 row)                      |
| Rows     | `gap: 1` → `gap: 0` between stacked sections                                |
| Rows     | Drop the label under a value that already shows its unit                    |
| Rows     | Drop the secondary detail line ("Feels 21°C", "on <device>")                |
| Rows     | Big ASCII art → small → a single `Icon` glyph → nothing                     |
| Rows     | Stacked heroes → one row of heroes                                          |
| Columns  | Full words → abbreviations (`Location` → `Loc`, `Show seconds` → `Seconds`) |
| Columns  | Drop the secondary column of a row (`BrowseRow`'s `meta` below 56 columns)  |
| Columns  | Truncate with an ellipsis via a `clip(text, width)` helper                  |
| Either   | Hide the whole secondary stat block — the last thing to go                  |

Never trade away: the value the widget exists to show, and the control that fixes a broken
state (the "Change location" button on an error).

## Clipping and layout traps

- `overflow: 'hidden'` on the flexible content box. Without it a squeezed hero draws over
  the toolbar and past the panel border.
- `flexShrink: 0` plus an explicit `height: 1` on rows that must survive: the header, the
  toolbar. Otherwise flexbox shrinks the pinned row and clips the content instead.
- A padded ASCII block needs an explicit `width`/`minWidth` and `wrapMode="none"`, and
  should pad with `\u00A0` — trailing ordinary spaces do not reserve layout width in
  OpenTUI text, so the right edge gets clipped.
- `wrapMode="none"` on any single-line label that could exceed its box.
- `Divider` inside a column needs `length={Math.max(4, width - 4)}`; left to grow it runs
  down the column instead of across it.
- `<scrollbox style={{ flexGrow: 1 }}>` for long lists — **no `flexDirection`**. Its own
  top-level box is internally `row` (content pane beside the scrollbar); setting `column`
  starves the content pane of height. Rows inside stack vertically regardless.
- `<box style={{ flexGrow: 1 }} />` as a spacer is how you push something to the right.
- Charts need real numbers: `width={Math.max(10, Math.min(28, width - 8))}`, never a
  constant and never the raw `width`.
- Pass `width - N` to anything that measures itself, where `N` is the chrome you already
  spent — `ProgressBar width={Math.max(10, width - 6)}`.

## The dashboard's own responsiveness

`packages/ui/src/layout.ts` handles the level above a widget, and a widget author only
needs to know what it guarantees:

- Terminal breakpoints: `compact` below 72 columns (rows stack, one widget per row),
  `wide` at 132+. Below 40x12 nothing renders at all.
- A row whose widgets would each fall below their `minWidth` (default 24 columns) is split
  into several rows, so a widget is restacked rather than squashed.
- A widget's `minHeight` grows its row to fit it (default row floor is 3 rows).

So: pick a real `minWidth`/`minHeight` for your widget when you document it in the README
and in `DEFAULT_DASHBOARD`, and design for the smallest size you claim to support — the
layout engine will honour it, but only if you name it.

## Testing sizes

Render the same widget at two or three sizes with `testRender` and assert what changed:

```tsx
<NowWidget options={{ location: 'home' }} width={30} height={11} />
// frame does not contain the large art, does contain '22 °C' and '[Refresh]',
// and does not contain '╭─────────╮' — the bordered buttons are what freed the rows
```

Assert both directions: what the small size **dropped** and what it **kept**. Asserting
only presence lets a regression that draws over the border pass. `pnpm start` and dragging
the terminal narrow is the final check — a widget that looks right in a test frame can
still spill when a neighbour takes its columns.

## Review checklist

```
- [ ] Every size decision is a pure function in its own module, with tests
- [ ] The function is total — there is a floor treatment that always fits
- [ ] JSX branches on named treatment fields, not on raw width/height comparisons
- [ ] overflow: 'hidden' on the flexible content box
- [ ] Pinned header/toolbar rows have flexShrink: 0
- [ ] Every label that can overflow is clipped or wrapMode="none"
- [ ] Charts, progress bars and dividers get computed widths
- [ ] Long lists are in a scrollbox
- [ ] Controls stay reachable at the smallest supported size
- [ ] Tests cover a large, a small, and (if it reorients) a short size
```
