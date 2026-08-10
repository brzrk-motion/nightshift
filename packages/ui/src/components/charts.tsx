import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';
import { barChart, lineChart, sparkline, type BarDatum } from '../charts.js';

export interface SparklineProps {
  values: readonly number[];
  width?: number;
  min?: number;
  max?: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'muted';
  /** Shown after the line — usually the latest value. */
  caption?: string;
}

/** A one-line trend, small enough to sit inside a card. */
export function Sparkline({
  values,
  width,
  min,
  max,
  tone = 'accent',
  caption,
}: SparklineProps): ReactNode {
  const theme = useTheme();
  const line = sparkline(values, {
    ...(width === undefined ? {} : { width }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  });

  return (
    <box style={{ flexDirection: 'row', gap: 1, height: 1, flexShrink: 0 }}>
      <text fg={theme.colors[tone]}>{line}</text>
      {caption !== undefined && <text fg={theme.colors.muted}>{caption}</text>}
    </box>
  );
}

export interface LineChartProps {
  values: readonly number[];
  width: number;
  height: number;
  min?: number;
  max?: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  /** Draws the scale down the left edge. */
  showAxis?: boolean;
}

/** A braille line plot — eight times the vertical resolution of blocks. */
export function LineChart({
  values,
  width,
  height,
  min,
  max,
  tone = 'accent',
  showAxis = false,
}: LineChartProps): ReactNode {
  const theme = useTheme();
  const axisWidth = showAxis ? 6 : 0;
  const rows = lineChart(values, {
    width: Math.max(1, width - axisWidth),
    height,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  });

  const top = max ?? (values.length > 0 ? Math.max(...values) : 1);
  const bottom = min ?? (values.length > 0 ? Math.min(...values) : 0);

  return (
    <box style={{ flexDirection: 'column', flexShrink: 0 }}>
      {rows.map((row, index) => (
        <box key={index} style={{ flexDirection: 'row', height: 1 }}>
          {showAxis && (
            <text fg={theme.colors.muted}>
              {(index === 0
                ? `${Math.round(top)}`
                : index === rows.length - 1
                  ? `${Math.round(bottom)}`
                  : ''
              )
                .padStart(5)
                .concat(' ')}
            </text>
          )}
          <text fg={theme.colors[tone]}>{row}</text>
        </box>
      ))}
    </box>
  );
}

export interface BarChartProps {
  data: readonly BarDatum[];
  width: number;
  labelWidth?: number;
  max?: number;
  showValues?: boolean;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

/** Horizontal bars, one per datum, with aligned labels. */
export function BarChart({
  data,
  width,
  labelWidth,
  max,
  showValues = true,
  tone = 'accent',
}: BarChartProps): ReactNode {
  const theme = useTheme();
  const rows = barChart(data, {
    width,
    showValues,
    ...(labelWidth === undefined ? {} : { labelWidth }),
    ...(max === undefined ? {} : { max }),
  });

  if (rows.length === 0) {
    return <text fg={theme.colors.muted}>No data</text>;
  }

  return (
    <box style={{ flexDirection: 'column', flexShrink: 0 }}>
      {rows.map((row) => (
        <box key={row.label} style={{ flexDirection: 'row', gap: 1, height: 1 }}>
          <text fg={theme.colors.muted}>{row.label}</text>
          <text fg={theme.colors[tone]}>{row.bar}</text>
          {showValues && <text fg={theme.colors.text}>{row.text}</text>}
        </box>
      ))}
    </box>
  );
}
