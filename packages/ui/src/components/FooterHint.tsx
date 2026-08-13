import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';

export interface FooterHintProps {
  text: string;
}

export function FooterHint({ text }: FooterHintProps): ReactNode {
  const theme = useTheme();
  return (
    <box style={{ flexShrink: 0 }}>
      <text fg={theme.colors.muted}>{text}</text>
    </box>
  );
}
