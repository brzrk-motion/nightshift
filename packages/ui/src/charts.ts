/**
 * Chart rendering, as pure functions from numbers to strings.
 *
 * Keeping the drawing separate from the components means the tricky part —
 * scaling, rounding, what an empty series looks like — is testable without a
 * terminal, and the components stay thin wrappers that add colour.
 */

/** Eighth-block characters, from lowest to highest. */
export const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

export interface Scale {
  min: number;
  max: number;
}

/** The range a series should be drawn against, widened when it is flat. */
export function resolveScale(values: readonly number[], override: Partial<Scale> = {}): Scale {
  const finite = values.filter((value) => Number.isFinite(value));
  const min = override.min ?? (finite.length > 0 ? Math.min(...finite) : 0);
  const max = override.max ?? (finite.length > 0 ? Math.max(...finite) : 1);
  // A flat series would divide by zero, and drawing it along the bottom reads
  // as "no data"; centring it says "steady", which is what it means.
  if (max === min) return { min: min - 0.5, max: max + 0.5 };
  return min < max ? { min, max } : { min: max, max: min };
}

/** Where `value` sits in `scale`, clamped to 0..1. */
export function normalise(value: number, scale: Scale): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - scale.min) / (scale.max - scale.min)));
}

/**
 * Reduces a series to exactly `width` points by averaging each bucket, so a
 * long history still fits a narrow widget instead of being truncated.
 */
export function resample(values: readonly number[], width: number): number[] {
  if (width <= 0) return [];
  if (values.length === 0) return [];
  if (values.length <= width) return [...values];

  const out: number[] = [];
  for (let index = 0; index < width; index += 1) {
    const start = Math.floor((index * values.length) / width);
    const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / width));
    const bucket = values.slice(start, end);
    out.push(bucket.reduce((sum, value) => sum + value, 0) / bucket.length);
  }
  return out;
}

export interface SparklineOptions extends Partial<Scale> {
  /** Columns to draw into. Longer series are averaged down to fit. */
  width?: number;
}

/** A one-line sparkline, e.g. `▁▃▅█▅▃▁`. */
export function sparkline(values: readonly number[], options: SparklineOptions = {}): string {
  const points = options.width === undefined ? [...values] : resample(values, options.width);
  if (points.length === 0) return '';

  const scale = resolveScale(points, options);
  return points
    .map((value) => {
      const index = Math.round(normalise(value, scale) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[index] ?? SPARK_CHARS[0];
    })
    .join('');
}

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartOptions extends Partial<Scale> {
  /** Total columns available, labels and value included. */
  width: number;
  /** Columns reserved for labels. Defaults to the longest label, capped. */
  labelWidth?: number;
  /** Appends the value after each bar. */
  showValues?: boolean;
  /** Formats the value. Defaults to a short number. */
  format?: (value: number) => string;
}

export interface BarChartRow {
  label: string;
  value: number;
  /** The bar itself, already padded to the track width. */
  bar: string;
  /** The formatted value, when `showValues` is on. */
  text: string;
}

const BAR_PARTIALS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const;

function shortNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  return `${Math.round(value * 10) / 10}`;
}

/**
 * Horizontal bars, one row per datum. Bars use eighth-blocks so a small
 * difference between two values is still visible at terminal resolution.
 */
export function barChart(data: readonly BarDatum[], options: BarChartOptions): BarChartRow[] {
  if (data.length === 0) return [];

  const format = options.format ?? shortNumber;
  const labelWidth =
    options.labelWidth ??
    Math.min(
      Math.max(...data.map((datum) => datum.label.length)),
      Math.max(4, Math.floor(options.width / 3)),
    );
  const valueWidth = options.showValues
    ? Math.max(...data.map((datum) => format(datum.value).length)) + 1
    : 0;
  const track = Math.max(1, options.width - labelWidth - valueWidth - 1);

  // Bars are drawn from zero unless the caller says otherwise; a bar chart
  // that starts at the smallest value exaggerates small differences.
  const scale = resolveScale(
    data.map((datum) => datum.value),
    { min: options.min ?? 0, ...(options.max === undefined ? {} : { max: options.max }) },
  );

  return data.map((datum) => {
    const filled = normalise(datum.value, scale) * track;
    const whole = Math.floor(filled);
    const partial = BAR_PARTIALS[Math.floor((filled - whole) * BAR_PARTIALS.length)] ?? '';
    const bar = ('█'.repeat(whole) + partial).slice(0, track);

    return {
      label: truncate(datum.label, labelWidth).padEnd(labelWidth),
      value: datum.value,
      bar: bar.padEnd(track),
      text: options.showValues ? format(datum.value).padStart(Math.max(0, valueWidth - 1)) : '',
    };
  });
}

/** Shortens a label to `width`, marking the cut with an ellipsis. */
export function truncate(text: string, width: number): string {
  if (width <= 0) return '';
  if (text.length <= width) return text;
  return width === 1 ? '…' : `${text.slice(0, width - 1)}…`;
}

export interface LineChartOptions extends Partial<Scale> {
  width: number;
  height: number;
}

// Braille cells are two dots wide and four tall; these are the bit values for
// each dot position, column-major.
const BRAILLE_DOTS = [
  [0x01, 0x02, 0x04, 0x40],
  [0x08, 0x10, 0x20, 0x80],
] as const;

/**
 * Plots a series as braille dots, giving eight times the resolution of block
 * characters. Returns one string per row, top row first.
 */
export function lineChart(values: readonly number[], options: LineChartOptions): string[] {
  const { width, height } = options;
  if (width <= 0 || height <= 0) return [];

  const rows = new Array<string>(height).fill(' '.repeat(width));
  const points = resample(values, width * 2);
  if (points.length === 0) return rows;

  const scale = resolveScale(points, options);
  const pixelHeight = height * 4;
  const cells = Array.from({ length: height }, () => new Array<number>(width).fill(0));

  let previous: number | undefined;
  for (const [column, value] of points.entries()) {
    const y = Math.min(
      pixelHeight - 1,
      Math.max(0, Math.round((1 - normalise(value, scale)) * (pixelHeight - 1))),
    );

    // Joining consecutive samples turns scattered dots into a line, which is
    // what makes a steep change readable.
    const from = previous === undefined ? y : Math.min(previous, y);
    const to = previous === undefined ? y : Math.max(previous, y);
    for (let pixel = from; pixel <= to; pixel += 1) {
      const row = cells[Math.floor(pixel / 4)];
      const index = Math.floor(column / 2);
      if (!row || index >= width) continue;
      row[index] = (row[index] ?? 0) | (BRAILLE_DOTS[column % 2]?.[pixel % 4] ?? 0);
    }
    previous = y;
  }

  return cells.map((row) =>
    row.map((bits) => (bits === 0 ? ' ' : String.fromCodePoint(0x2800 + bits))).join(''),
  );
}
