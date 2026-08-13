import type { ReactNode } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { useTheme } from '../app/context.js';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: readonly TabItem[];
  /** Id of the active tab. */
  value: string;
  onChange?: (id: string) => void;
  children?: ReactNode;
}

/**
 * A row of tabs above its content. Drawn by hand rather than with OpenTUI's
 * `tab-select` so the tabs follow the Nightshift palette and stay consistent
 * with the rest of the library.
 */
export function Tabs({ items, value, onChange, children }: TabsProps): ReactNode {
  const theme = useTheme();
  const terminal = useTerminalDimensions();
  const underlineWidth = Math.max(0, terminal.width - 2);

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      <box style={{ flexDirection: 'row', gap: 2, height: 1, flexShrink: 0 }}>
        {items.map((item) => {
          const active = item.id === value;
          return (
            <box key={item.id} onMouseDown={() => onChange?.(item.id)} style={{ flexShrink: 0 }}>
              <text fg={active ? theme.colors.accent : theme.colors.muted}>
                {active ? <b>{item.label}</b> : item.label}
              </text>
            </box>
          );
        })}
      </box>
      <box style={{ height: 1, flexShrink: 0 }}>
        <text fg={theme.colors.border}>{'─'.repeat(underlineWidth)}</text>
      </box>
      <box style={{ flexDirection: 'column', flexGrow: 1 }}>{children}</box>
    </box>
  );
}
