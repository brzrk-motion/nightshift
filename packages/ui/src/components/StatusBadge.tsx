import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Draws a filled dot before the label. */
  dot?: boolean;
}

/**
 * A small coloured label — `running`, `paused`, `offline`. Colour carries the
 * meaning at a glance and the word carries it for anyone whose terminal, or
 * eyes, do not separate those colours.
 */
export function StatusBadge({ label, tone = 'neutral', dot = true }: StatusBadgeProps): ReactNode {
  const theme = useTheme();
  const color = tone === 'neutral' ? theme.colors.muted : theme.colors[tone];

  return (
    <text fg={color}>
      {dot ? '● ' : ''}
      {label}
    </text>
  );
}
