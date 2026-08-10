import { useState, type ReactNode } from 'react';
import { useTheme } from '../app/context.js';
import { Icon, type IconName } from './Icon.js';

export interface IconButtonProps {
  icon: IconName | string;
  /** Shown next to the icon. Omit for an icon-only button — the nav rail's
   * collapsed state uses this. */
  label?: string;
  onPress?: () => void;
  active?: boolean;
  disabled?: boolean;
}

/**
 * A button built around a glyph rather than a label — the nav rail and a
 * widget's toolbar are both made of these. Unlike `Button`, it has no border
 * of its own; it takes its affordance from being highlighted when active or
 * hovered, which is what keeps a row of them from turning into a wall of boxes.
 */
export function IconButton({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
}: IconButtonProps): ReactNode {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);

  const color = disabled
    ? theme.colors.muted
    : active
      ? theme.colors.accent
      : hovered
        ? theme.colors.text
        : theme.colors.muted;

  return (
    <box
      onMouseDown={() => {
        if (!disabled) onPress?.();
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      style={{
        flexDirection: 'row',
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
        height: 1,
        flexShrink: 0,
        ...(active ? { backgroundColor: theme.colors.border } : {}),
      }}
    >
      <Icon name={icon} color={color} />
      {label !== undefined && <text fg={color}>{label}</text>}
    </box>
  );
}

export interface ToolbarProps {
  orientation?: 'horizontal' | 'vertical';
  children?: ReactNode;
}

/** A row (or column) of actions, spaced consistently — what an `IconButton`
 * is meant to sit inside of. */
export function Toolbar({ orientation = 'horizontal', children }: ToolbarProps): ReactNode {
  return (
    <box
      style={{
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        gap: orientation === 'vertical' ? 0 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </box>
  );
}
