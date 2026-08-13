import type { ReactNode } from 'react';
import { TextInput } from './controls.js';
import { useTheme } from '../app/context.js';
import { HEX_COLOR } from '../theme.js';

export interface ColorFieldProps {
  label: string;
  value: string;
  focused?: boolean;
  onFocus?: () => void;
  onChange?: (hex: string) => void;
  disabled?: boolean;
}

/** Hex color input with an inline swatch preview. */
export function ColorField({
  label,
  value,
  focused = false,
  onFocus,
  onChange,
  disabled = false,
}: ColorFieldProps): ReactNode {
  const theme = useTheme();
  const swatchColor = HEX_COLOR.test(value.trim()) ? value.trim() : theme.colors.border;

  return (
    <box
      onMouseDown={() => {
        if (!disabled) onFocus?.();
      }}
      style={{ flexDirection: 'row', gap: 2, alignItems: 'center', minHeight: 1 }}
    >
      <text fg={theme.colors.muted}>{label.padEnd(16)}</text>
      <box
        style={{
          width: 2,
          height: 1,
          backgroundColor: swatchColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <text fg={swatchColor}>██</text>
      </box>
      <TextInput
        value={value}
        focused={focused && !disabled}
        onInput={(next) => onChange?.(next)}
        placeholder="#rrggbb"
      />
    </box>
  );
}
