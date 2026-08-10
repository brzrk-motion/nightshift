import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';

/** Eighth-blocks let a bar move smoothly rather than a cell at a time. */
const PARTIALS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const;

export interface ProgressTrack {
  filled: string;
  empty: string;
}

/**
 * Renders the two halves of a progress track. Split out from the component so
 * the rounding — the part that is easy to get wrong at the ends — is testable
 * without a terminal.
 */
export function progressTrack(value: number, width: number): ProgressTrack {
  if (width <= 0) return { filled: '', empty: '' };

  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const exact = ratio * width;
  const whole = Math.floor(exact);

  // Only a bar that is genuinely complete gets to look complete, and a bar
  // that has started at all shows a sliver rather than nothing.
  const eighth = Math.floor((exact - whole) * 8);
  const partial =
    whole >= width ? '' : (PARTIALS[eighth] ?? '') || (ratio > 0 && whole === 0 ? PARTIALS[1] : '');
  const filled = ('█'.repeat(whole) + partial).slice(0, width);

  return { filled, empty: '░'.repeat(width - [...filled].length) };
}

export interface ProgressBarProps {
  /** Progress from 0 to 1. Values outside the range are clamped. */
  value: number;
  /** Columns to draw into. Defaults to filling the row. */
  width?: number;
  label?: string;
  /** Shows the percentage after the bar. */
  showPercent?: boolean;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

export function ProgressBar({
  value,
  width,
  label,
  showPercent = false,
  tone = 'accent',
}: ProgressBarProps): ReactNode {
  const theme = useTheme();
  const track = progressTrack(value, width ?? 20);
  const percent = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`.padStart(4);

  return (
    <box style={{ flexDirection: 'column', flexShrink: 0 }}>
      {label !== undefined && <text fg={theme.colors.muted}>{label}</text>}
      <box style={{ flexDirection: 'row', gap: 1, height: 1 }}>
        <text>
          <span fg={theme.colors[tone]}>{track.filled}</span>
          <span fg={theme.colors.border}>{track.empty}</span>
        </text>
        {showPercent && <text fg={theme.colors.muted}>{percent}</text>}
      </box>
    </box>
  );
}
