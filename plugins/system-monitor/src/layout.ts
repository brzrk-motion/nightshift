import type { MetricKey } from './entity.js';

/** Minimum widget width for two metric columns. */
export const GRID_TWO_COL_MIN_WIDTH = 52;

export function resolveGridColumns(width: number, count: number): 1 | 2 {
  if (count <= 1) return 1;
  if (width >= GRID_TWO_COL_MIN_WIDTH) return 2;
  return 1;
}

export function chunkIntoRows<T>(items: readonly T[], columns: number): T[][] {
  if (columns <= 0 || items.length === 0) return [];
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

/** Chart width inside a grid cell after title chrome and padding. */
export function chartWidthForCell(widgetWidth: number, columns: number): number {
  const inner = Math.max(1, widgetWidth - 2);
  const cell = Math.floor(inner / columns) - 2;
  return Math.max(10, cell);
}

export function metricRows(metrics: readonly MetricKey[], width: number): MetricKey[][] {
  const columns = resolveGridColumns(width, metrics.length);
  return chunkIntoRows(metrics, columns);
}
