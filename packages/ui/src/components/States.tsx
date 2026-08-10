import { useEffect, useState, type ReactNode } from 'react';
import { useTheme } from '../app/context.js';

interface CenteredProps {
  glyph: string;
  color: string;
  message: string;
  hint?: string;
}

function Centered({ glyph, color, message, hint }: CenteredProps): ReactNode {
  const theme = useTheme();
  return (
    <box
      style={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <text fg={color}>{glyph}</text>
      <text fg={theme.colors.muted}>{message}</text>
      {hint !== undefined && <text fg={theme.colors.muted}>{hint}</text>}
    </box>
  );
}

export interface EmptyStateProps {
  message: string;
  hint?: string;
}

/** "Nothing here yet" — the generalised version of the `empty` prop already
 * on `Table` and `List`, for a screen that is not built around a list. */
export function EmptyState({ message, hint }: EmptyStateProps): ReactNode {
  const theme = useTheme();
  return (
    <Centered
      glyph="○"
      color={theme.colors.muted}
      message={message}
      {...(hint === undefined ? {} : { hint })}
    />
  );
}

export interface ErrorStateProps {
  message: string;
  hint?: string;
}

/** Something failed and there is nothing more useful to show in its place. */
export function ErrorState({ message, hint }: ErrorStateProps): ReactNode {
  const theme = useTheme();
  return (
    <Centered
      glyph="✖"
      color={theme.colors.danger}
      message={message}
      {...(hint === undefined ? {} : { hint })}
    />
  );
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

export interface LoadingStateProps {
  message?: string;
}

/**
 * A braille spinner plus a message. The frame advances on a real interval
 * rather than being CSS-driven, because there is no CSS here — this is the
 * one animated primitive Phase 7 needs; anything busier is Phase 8's "motion
 * and live updates" to build.
 */
export function LoadingState({ message = 'Loading…' }: LoadingStateProps): ReactNode {
  const theme = useTheme();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setFrame((current) => (current + 1) % SPINNER_FRAMES.length),
      80,
    );
    timer.unref?.();
    return () => clearInterval(timer);
  }, []);

  return (
    <Centered
      glyph={SPINNER_FRAMES[frame] ?? SPINNER_FRAMES[0]}
      color={theme.colors.accent}
      message={message}
    />
  );
}
