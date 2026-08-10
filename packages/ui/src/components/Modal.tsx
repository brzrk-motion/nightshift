import type { ReactNode } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { useTheme } from '../app/context.js';

export interface ModalProps {
  title?: string;
  /** Nothing is drawn when this is false. */
  open?: boolean;
  /** Columns wide. Clamped to the terminal by the renderer. */
  width?: number;
  height?: number;
  /** Shown along the bottom edge, e.g. `esc to close`. */
  hint?: string;
  children?: ReactNode;
}

/**
 * A centred overlay. It is positioned absolutely over the whole screen so the
 * dashboard underneath keeps its layout — reopening a modal never reflows what
 * is behind it.
 */
export function Modal({
  title,
  open = true,
  width = 60,
  height,
  hint,
  children,
}: ModalProps): ReactNode {
  const theme = useTheme();
  const terminal = useTerminalDimensions();
  if (!open) return null;

  // A modal wider than the terminal would be clipped at the edge, taking its
  // border and half its content with it.
  const boxWidth = Math.max(20, Math.min(width, terminal.width - 2));
  const boxHeight = height === undefined ? undefined : Math.min(height, terminal.height - 2);

  return (
    <box
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <box
        {...(title === undefined ? {} : { title: ` ${title} ` })}
        {...(hint === undefined ? {} : { bottomTitle: ` ${hint} ` })}
        style={{
          border: true,
          borderStyle: 'rounded',
          borderColor: theme.colors.accent,
          backgroundColor: theme.colors.surface,
          titleColor: theme.colors.accent,
          flexDirection: 'column',
          padding: 1,
          width: boxWidth,
          ...(boxHeight === undefined ? {} : { height: boxHeight }),
        }}
      >
        {children}
      </box>
    </box>
  );
}
