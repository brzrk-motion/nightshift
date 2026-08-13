import type { ReactNode } from 'react';
import { useTheme } from '../app/context.js';
import { type FormScale } from '../formLayout.js';

export interface FormFieldProps {
  label: string;
  scale: FormScale;
  focused: boolean;
  onFocus: () => void;
  children: (focused: boolean) => ReactNode;
}

/** Format a field label for inline or stacked layout. */
export function formFieldLabel(label: string, stackFields: boolean): string {
  return stackFields ? label : label.padEnd(12);
}

export function FormField({
  label,
  scale,
  focused,
  onFocus,
  children,
}: FormFieldProps): ReactNode {
  const theme = useTheme();
  return (
    <box
      onMouseDown={onFocus}
      style={{
        flexDirection: scale.stackFields ? 'column' : 'row',
        gap: scale.stackFields ? 0 : 2,
        minHeight: 1,
        alignItems: scale.stackFields ? 'stretch' : 'flex-start',
      }}
    >
      <text fg={focused ? theme.colors.text : theme.colors.muted}>
        {formFieldLabel(label, scale.stackFields)}
      </text>
      <box style={{ flexGrow: 1 }}>{children(focused)}</box>
    </box>
  );
}
