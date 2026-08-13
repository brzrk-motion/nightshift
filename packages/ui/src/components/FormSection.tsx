import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';
import { type FormScale } from '../formLayout.js';

export interface FormSectionProps {
  title: string;
  scale: FormScale;
  children: ReactNode;
}

export function FormSection({ title, scale, children }: FormSectionProps): ReactNode {
  const theme = useTheme();
  return (
    <box style={{ flexDirection: 'column', gap: scale.tightGaps ? 0 : 1 }}>
      <text fg={theme.colors.accent}>
        <b>{title}</b>
      </text>
      {children}
    </box>
  );
}
