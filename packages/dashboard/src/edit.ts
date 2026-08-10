import type { DashboardSpec, RowSpec, WidgetSpec } from './schema.js';

/**
 * Dashboard edit mode, as pure functions from one `DashboardSpec` to the
 * next. Keeping the editing rules here — not in the component that binds
 * them to keys — is what makes "shift+left shrinks a widget" testable
 * without a terminal, the same reason `layout.ts` and `timer.ts` are built
 * this way.
 */
export interface WidgetAddress {
  row: number;
  widget: number;
}

export interface EditResult {
  dashboard: DashboardSpec;
  selected: WidgetAddress | null;
}

/** Every widget's address, in reading order — row 0 first, left to right. */
export function flattenAddresses(dashboard: DashboardSpec): WidgetAddress[] {
  return dashboard.rows.flatMap((row, r) => row.widgets.map((_, w) => ({ row: r, widget: w })));
}

function sameAddress(a: WidgetAddress, b: WidgetAddress): boolean {
  return a.row === b.row && a.widget === b.widget;
}

/** The nearest still-valid address to `address` — its own, if it still
 * exists, otherwise the first widget, or nothing if the dashboard is empty. */
export function clampAddress(
  dashboard: DashboardSpec,
  address: WidgetAddress | null,
): WidgetAddress | null {
  const all = flattenAddresses(dashboard);
  if (all.length === 0) return null;
  if (address && all.some((entry) => sameAddress(entry, address))) return address;
  return all[0] ?? null;
}

/** The next (or, with `direction: -1`, previous) address after `current`,
 * wrapping around — what Tab/Shift+Tab cycle through. */
export function nextAddress(
  dashboard: DashboardSpec,
  current: WidgetAddress | null,
  direction: 1 | -1,
): WidgetAddress | null {
  const all = flattenAddresses(dashboard);
  if (all.length === 0) return null;
  if (!current) return all[0] ?? null;
  const index = all.findIndex((entry) => sameAddress(entry, current));
  if (index === -1) return all[0] ?? null;
  return all[(index + direction + all.length) % all.length] ?? null;
}

/** A deep-enough clone that editing the copy never touches the original —
 * every dashboard field is plain JSON, so `structuredClone` is exact. */
export function cloneDashboard(dashboard: DashboardSpec): DashboardSpec {
  return structuredClone(dashboard);
}

function cloneRows(dashboard: DashboardSpec): RowSpec[] {
  return dashboard.rows.map((row) => ({ ...row, widgets: [...row.widgets] }));
}

/** Swaps the widget at `address` with its left (`-1`) or right (`1`)
 * neighbour in the same row. A widget at either end of its row does not move. */
export function moveHorizontal(
  dashboard: DashboardSpec,
  address: WidgetAddress,
  direction: 1 | -1,
): EditResult {
  const rows = cloneRows(dashboard);
  const row = rows[address.row];
  if (!row) return { dashboard, selected: address };

  const target = address.widget + direction;
  if (target < 0 || target >= row.widgets.length) return { dashboard, selected: address };

  const widgets = [...row.widgets];
  const a = widgets[address.widget];
  const b = widgets[target];
  if (!a || !b) return { dashboard, selected: address };
  widgets[address.widget] = b;
  widgets[target] = a;
  rows[address.row] = { ...row, widgets };

  return { dashboard: { ...dashboard, rows }, selected: { row: address.row, widget: target } };
}

/**
 * Moves the widget at `address` to the end of the row above (`-1`) or below
 * (`1`). A row the move empties is dropped; moving past either end of the
 * dashboard creates a fresh row there rather than doing nothing.
 */
export function moveVertical(
  dashboard: DashboardSpec,
  address: WidgetAddress,
  direction: 1 | -1,
): EditResult {
  const rows = cloneRows(dashboard);
  const sourceRow = rows[address.row];
  const widget = sourceRow?.widgets[address.widget];
  if (!sourceRow || !widget) return { dashboard, selected: address };

  const remaining = sourceRow.widgets.filter((_, index) => index !== address.widget);
  const targetIndex = address.row + direction;

  if (targetIndex < 0 || targetIndex >= rows.length) {
    const newRow: RowSpec = { widgets: [widget] };
    const withoutSource =
      remaining.length === 0
        ? rows.filter((_, index) => index !== address.row)
        : rows.map((row, index) => (index === address.row ? { ...row, widgets: remaining } : row));
    const insertAt = direction === -1 ? 0 : withoutSource.length;
    const nextRows = [
      ...withoutSource.slice(0, insertAt),
      newRow,
      ...withoutSource.slice(insertAt),
    ];
    return { dashboard: { ...dashboard, rows: nextRows }, selected: { row: insertAt, widget: 0 } };
  }

  const targetRow = rows[targetIndex];
  if (!targetRow) return { dashboard, selected: address };
  const targetWidgets = [...targetRow.widgets, widget];

  if (remaining.length === 0) {
    // Dropping the now-empty source row shifts every row after it, target
    // included, so the write below has to land on the shifted index.
    const withoutSource = rows.filter((_, index) => index !== address.row);
    const shiftedTarget = targetIndex > address.row ? targetIndex - 1 : targetIndex;
    const nextRows = withoutSource.map((row, index) =>
      index === shiftedTarget ? { ...row, widgets: targetWidgets } : row,
    );
    return {
      dashboard: { ...dashboard, rows: nextRows },
      selected: { row: shiftedTarget, widget: targetWidgets.length - 1 },
    };
  }

  const nextRows = rows.map((row, index) => {
    if (index === address.row) return { ...row, widgets: remaining };
    if (index === targetIndex) return { ...row, widgets: targetWidgets };
    return row;
  });
  return {
    dashboard: { ...dashboard, rows: nextRows },
    selected: { row: targetIndex, widget: targetWidgets.length - 1 },
  };
}

/** Grows or shrinks the selected widget's `span`, floored at 1. */
export function resizeSpan(
  dashboard: DashboardSpec,
  address: WidgetAddress,
  delta: number,
): DashboardSpec {
  const rows = cloneRows(dashboard);
  const row = rows[address.row];
  const widget = row?.widgets[address.widget];
  if (!row || !widget) return dashboard;

  const widgets = [...row.widgets];
  widgets[address.widget] = { ...widget, span: Math.max(1, (widget.span ?? 1) + delta) };
  rows[address.row] = { ...row, widgets };
  return { ...dashboard, rows };
}

/** Grows or shrinks the selected widget's row's `height`, floored at 1. */
export function resizeRowHeight(
  dashboard: DashboardSpec,
  rowIndex: number,
  delta: number,
): DashboardSpec {
  const rows = cloneRows(dashboard);
  const row = rows[rowIndex];
  if (!row) return dashboard;
  rows[rowIndex] = { ...row, height: Math.max(1, (row.height ?? 1) + delta) };
  return { ...dashboard, rows };
}

/** Removes the widget at `address`, dropping its row if that empties it. */
export function removeWidget(dashboard: DashboardSpec, address: WidgetAddress): EditResult {
  const rows = cloneRows(dashboard);
  const row = rows[address.row];
  if (!row) return { dashboard, selected: clampAddress(dashboard, address) };

  const widgets = row.widgets.filter((_, index) => index !== address.widget);
  const nextRows =
    widgets.length === 0
      ? rows.filter((_, index) => index !== address.row)
      : rows.map((entry, index) => (index === address.row ? { ...entry, widgets } : entry));

  const next = { ...dashboard, rows: nextRows };
  return { dashboard: next, selected: clampAddress(next, address) };
}

/**
 * Replaces the widget at `address` with a different type, in place — the
 * layout slot (`span`) carries over since that describes the position, not
 * the old widget, but everything specific to the old widget (`title`,
 * `options`, `minWidth`/`minHeight`, `when`) does not, since none of it is
 * guaranteed to mean anything to the new type.
 */
export function swapWidget(
  dashboard: DashboardSpec,
  address: WidgetAddress,
  widget: WidgetSpec,
): DashboardSpec {
  const rows = cloneRows(dashboard);
  const row = rows[address.row];
  const existing = row?.widgets[address.widget];
  if (!row || !existing) return dashboard;

  const widgets = [...row.widgets];
  widgets[address.widget] = {
    ...widget,
    ...(existing.span === undefined ? {} : { span: existing.span }),
  };
  rows[address.row] = { ...row, widgets };
  return { ...dashboard, rows };
}

/**
 * Adds `widget` to the end of the selected row, or as a new last row when
 * there is nothing selected to add next to — an empty dashboard, most likely.
 */
export function addWidget(
  dashboard: DashboardSpec,
  address: WidgetAddress | null,
  widget: WidgetSpec,
): EditResult {
  const rows = cloneRows(dashboard);
  const row = address ? rows[address.row] : undefined;

  if (address && row) {
    const widgets = [...row.widgets, widget];
    rows[address.row] = { ...row, widgets };
    return {
      dashboard: { ...dashboard, rows },
      selected: { row: address.row, widget: widgets.length - 1 },
    };
  }

  const nextRows = [...rows, { widgets: [widget] }];
  return {
    dashboard: { ...dashboard, rows: nextRows },
    selected: { row: nextRows.length - 1, widget: 0 },
  };
}

/** Fresh unique id for a weather location slot bound to a newly placed widget. */
export function newWeatherLocationId(now = Date.now()): string {
  return `loc-${now.toString(36)}`;
}

/**
 * Builds the `WidgetSpec` inserted by edit mode's picker. Weather widgets get
 * a unique `options.location` so each tile can be configured independently;
 * a clock widget opens straight into its settings panel so 12/24-hour,
 * seconds, date format and timezone are all right there to configure.
 */
export function specForPickedWidget(type: string, now = Date.now()): WidgetSpec {
  if (type.startsWith('weather.')) {
    return { type, options: { location: newWeatherLocationId(now) } };
  }
  if (type === 'clock.now') {
    return { type, options: { startInSettings: true } };
  }
  return { type };
}
