import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';

export interface PanelProps {
  title?: string;
  /** Shown on the bottom border — a good place for a hint or a count. */
  footer?: string;
  /** Draws the border in the accent colour, for the focused widget. */
  active?: boolean;
  /** Fills the space its parent gives it. On by default. */
  grow?: boolean;
  padding?: number;
  children?: ReactNode;
}

/**
 * A bordered region with an optional title. Panels are the frame every widget
 * sits in, which is what makes a dashboard read as a grid rather than a wall
 * of text.
 */
export function Panel({
  title,
  footer,
  active = false,
  grow = true,
  padding = 1,
  children,
}: PanelProps): ReactNode {
  const theme = useTheme();

  return (
    <box
      {...(title === undefined ? {} : { title: ` ${title} ` })}
      {...(footer === undefined ? {} : { bottomTitle: ` ${footer} ` })}
      style={{
        border: true,
        borderStyle: 'rounded',
        borderColor: active ? theme.colors.accent : theme.colors.border,
        backgroundColor: theme.colors.surface,
        titleColor: active ? theme.colors.accent : theme.colors.muted,
        flexDirection: 'column',
        flexGrow: grow ? 1 : 0,
        flexShrink: 1,
        minHeight: 3,
        padding,
      }}
    >
      {children}
    </box>
  );
}

export interface CardProps {
  title?: string;
  /** The headline value — a duration, a count, a track name. */
  value?: string;
  /** A quieter line under the value. */
  subtitle?: string;
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger';
  active?: boolean;
  children?: ReactNode;
}

/**
 * A panel built around one number or phrase. Cards are what a dashboard is
 * mostly made of: glanceable, and readable from across the room.
 */
export function Card({
  title,
  value,
  subtitle,
  tone = 'default',
  active = false,
  children,
}: CardProps): ReactNode {
  const theme = useTheme();
  const valueColor =
    tone === 'default'
      ? theme.colors.text
      : tone === 'accent'
        ? theme.colors.accent
        : theme.colors[tone];

  return (
    <Panel {...(title === undefined ? {} : { title })} active={active}>
      {value !== undefined && (
        <text fg={valueColor}>
          <b>{value}</b>
        </text>
      )}
      {subtitle !== undefined && <text fg={theme.colors.muted}>{subtitle}</text>}
      {children}
    </Panel>
  );
}
