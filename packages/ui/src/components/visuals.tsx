import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';
import { activityStrip } from '../charts.js';
import { progressTrack } from './ProgressBar.js';

export interface MeterProps {
  /** 0 to 1. */
  value: number;
  width?: number;
  label?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

/**
 * A one-line, label-and-bar meter — `ProgressBar` without the percentage or
 * the vertical room, for a system-stats row where several of these stack.
 */
export function Meter({ value, width = 12, label, tone = 'accent' }: MeterProps): ReactNode {
  const theme = useTheme();
  const track = progressTrack(value, width);

  return (
    <box style={{ flexDirection: 'row', gap: 1, height: 1, flexShrink: 0 }}>
      {label !== undefined && <text fg={theme.colors.muted}>{label}</text>}
      <text>
        <span fg={theme.colors[tone]}>{track.filled}</span>
        <span fg={theme.colors.borderMuted}>{track.empty}</span>
      </text>
    </box>
  );
}

export interface ActivityWaveformProps {
  values: readonly number[];
  width?: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

/** A pulse strip for "something is happening" — ambient activity, recent
 * ticks — as opposed to `Sparkline`, which reads as a trend. */
export function ActivityWaveform({
  values,
  width,
  tone = 'accent',
}: ActivityWaveformProps): ReactNode {
  const theme = useTheme();
  return <text fg={theme.colors[tone]}>{activityStrip(values, width)}</text>;
}

export interface TimelineItem {
  id: string;
  time: string;
  label: string;
  /** Highlights this entry as the one that matters right now. */
  current?: boolean;
}

export interface TimelineProps {
  items: readonly TimelineItem[];
  empty?: string;
}

/** A vertical sequence of time-labelled events, with the current one picked
 * out — "what's next", read top to bottom. */
export function Timeline({ items, empty = 'Nothing scheduled' }: TimelineProps): ReactNode {
  const theme = useTheme();

  if (items.length === 0) {
    return <text fg={theme.colors.muted}>{empty}</text>;
  }

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      {items.map((item, index) => (
        <box key={item.id} style={{ flexDirection: 'row', gap: 1, height: 1, flexShrink: 0 }}>
          <text fg={item.current ? theme.colors.accent : theme.colors.borderMuted}>
            {item.current ? '●' : index === 0 ? '┌' : index === items.length - 1 ? '└' : '├'}
          </text>
          <text fg={theme.colors.muted}>{item.time}</text>
          <text fg={item.current ? theme.colors.text : theme.colors.muted}>{item.label}</text>
        </box>
      ))}
    </box>
  );
}
