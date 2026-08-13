import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';

export type ActionBarVariant = 'toolbar' | 'footer';

export interface ActionBarProps {
  variant?: ActionBarVariant;
  children: ReactNode;
}

/** Full-width surface bar for toolbar or sticky footer actions. */
export function ActionBar({ variant: _variant = 'footer', children }: ActionBarProps): ReactNode {
  const theme = useTheme();
  return (
    <box
      style={{
        flexDirection: 'row',
        gap: 1,
        flexShrink: 0,
        width: '100%',
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {children}
    </box>
  );
}
