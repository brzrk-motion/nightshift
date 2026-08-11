import { useState, type ReactNode } from 'react';
import { useTheme } from './context.js';
import { Icon } from '../components/Icon.js';
import type { Screen } from './screen.js';
import { EDGE_BOTTOM } from '@opentui/core/yoga';

export interface NavRailProps {
  screens: readonly Screen[];
  active: string;
  onSelect: (id: string) => void;
  /** Icon-only, for a terminal too narrow for labels. */
  collapsed: boolean;
}

interface NavRailItemProps {
  screen: Screen;
  active: boolean;
  first: boolean;
  collapsed: boolean;
  onSelect: (id: string) => void;
}

function NavRailItem({ screen, active, first, collapsed, onSelect }: NavRailItemProps): ReactNode {
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
        gap: 1,
        height: 1,
        flexShrink: 0,
        paddingLeft: 1,
        paddingRight: 1,
        marginTop: first ? 1 : 0,
        marginBottom: 1,
        ...(active
          ? { backgroundColor: theme.colors.border }
          : hovered
            ? { backgroundColor: theme.colors.borderMuted }
            : {}),
      }}
    >
      <Icon name={screen.icon} color={color} />
      {!collapsed && <text fg={color}>{screen.label}</text>}
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
        marginTop: 1,
        marginBottom: 1,
        backgroundColor: theme.colors.surface,
        border: ['right'],
        borderStyle: 'single',
        borderColor: theme.colors.borderMuted,
      }}
    >
      {screens.map((screen, index) => (
        <NavRailItem
          key={screen.id}
          screen={screen}
          active={screen.id === active}
          first={index === 0}
          collapsed={collapsed}
          onSelect={onSelect}
        />
      ))}
    </box>
  );
}
