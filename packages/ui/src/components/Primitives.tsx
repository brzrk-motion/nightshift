import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';
import type { BadgeTone } from './StatusBadge.js';

export interface StatusDotProps {
  tone?: BadgeTone;
}

/** Just the dot from `StatusBadge` — for a compact health indicator that has
 * no room for a label, or that sits right next to its own label already. */
export function StatusDot({ tone = 'neutral' }: StatusDotProps): ReactNode {
  const theme = useTheme();
  const color = tone === 'neutral' ? theme.colors.muted : theme.colors[tone];
  return <text fg={color}>●</text>;
}

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Length in cells. A horizontal divider defaults to filling its row. */
  length?: number;
}

/** A quiet rule between sections of chrome — never a panel border in
 * disguise, so it does not compete with the borders that actually frame things. */
export function Divider({ orientation = 'horizontal', length }: DividerProps): ReactNode {
  const theme = useTheme();
  if (orientation === 'vertical') {
    return (
      <box
        style={{
          width: 1,
          ...(length === undefined ? { flexGrow: 1 } : { height: length }),
          backgroundColor: theme.colors.borderMuted,
        }}
      />
    );
  }
  return (
    <box
      style={{
        height: 1,
        ...(length === undefined ? { flexGrow: 1 } : { width: length }),
        backgroundColor: theme.colors.borderMuted,
      }}
    />
  );
}

export interface KeyHintProps {
  /** The binding as authored, e.g. `ctrl+p`. */
  keys: string;
  label: string;
}

/** One `key → what it does` pair, styled as a chip — the unit the status bar
 * and the help overlay are both built from. */
export function KeyHint({ keys, label }: KeyHintProps): ReactNode {
  const theme = useTheme();
  return (
    <box style={{ flexDirection: 'row', gap: 1, flexShrink: 0 }}>
      <text fg={theme.colors.accentSecondary}>{keys}</text>
      <text fg={theme.colors.muted}>{label}</text>
    </box>
  );
}

export interface StatRowProps {
  label: string;
  value: string;
  tone?: BadgeTone;
}

/** A label-value row for compact fact sheets — the unit a settings or system
 * panel is made of, where `Table` would be too heavy for one column of facts. */
export function StatRow({ label, value, tone = 'neutral' }: StatRowProps): ReactNode {
  const theme = useTheme();
  const color = tone === 'neutral' ? theme.colors.text : theme.colors[tone];
  return (
    <box style={{ flexDirection: 'row', justifyContent: 'space-between', height: 1, gap: 1 }}>
      <text fg={theme.colors.muted}>{label}</text>
      <text fg={color}>{value}</text>
    </box>
  );
}

export interface MetricProps {
  label: string;
  value: string;
  tone?: BadgeTone;
}

/** One big number and what it means — the smallest possible widget, for a
 * toolbar or a header rather than a whole panel. */
export function Metric({ label, value, tone = 'neutral' }: MetricProps): ReactNode {
  const theme = useTheme();
  const color = tone === 'neutral' ? theme.colors.text : theme.colors[tone];
  return (
    <box style={{ flexDirection: 'column' }}>
      <text fg={color}>
        <b>{value}</b>
      </text>
      <text fg={theme.colors.muted}>{label}</text>
    </box>
  );
}
