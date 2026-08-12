import { useState, type ReactNode } from 'react';
import { useTheme } from './context.js';
import type { Screen } from './screen.js';

export interface NavRailProps {
  screens: readonly Screen[];
  active: string;
  onSelect: (id: string) => void;
  /** Label abbreviations for a terminal too narrow for full names. */
  collapsed: boolean;
}

interface NavRailItemProps {
  screen: Screen;
  active: boolean;
  collapsed: boolean;
  onSelect: (id: string) => void;
}

function navLabel(screen: Screen, collapsed: boolean): string {
  if (!collapsed) return screen.label;
  return screen.label.charAt(0).toUpperCase();
}

function NavRailItem({ screen, active, collapsed, onSelect }: NavRailItemProps): ReactNode {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const color = active ? theme.colors.accent : hovered ? theme.colors.text : theme.colors.muted;

  return (
    <box
      onMouseDown={() => onSelect(screen.id)}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      style={{
        flexDirection: 'row',
        height: 1,
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        ...(active
          ? { backgroundColor: theme.colors.border }
          : hovered
            ? { backgroundColor: theme.colors.borderMuted }
            : {}),
      }}
    >
      <text fg={color}>{navLabel(screen, collapsed)}</text>
    </box>
  );
}

/**
 * The persistent left-hand navigation. Each entry is reachable three ways —
 * a mouse click here, a number key (`AppShell` binds `1`..`9` to position),
 * and a `nav.<id>` command in the palette — the same three-ways-in principle
 * every other Nightshift affordance follows.
 */
export function NavRail({ screens, active, onSelect, collapsed }: NavRailProps): ReactNode {
  const theme = useTheme();

  return (
    <box
      style={{
        width: collapsed ? 4 : 16,
        flexShrink: 0,
        flexDirection: 'column',
        gap: 1,
        paddingTop: 1,
        paddingBottom: 1,
        backgroundColor: theme.colors.surface,
        border: ['right'],
        borderStyle: 'single',
        borderColor: theme.colors.borderMuted,
      }}
    >
      {screens.map((screen) => (
        <NavRailItem
          key={screen.id}
          screen={screen}
          active={screen.id === active}
          collapsed={collapsed}
          onSelect={onSelect}
        />
      ))}
    </box>
  );
}
