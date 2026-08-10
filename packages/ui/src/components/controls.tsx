import { useState, type ReactNode } from 'react';
import type { InputProps } from '@opentui/react';
import { useTheme } from '../app/context.js';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** Draws it as the primary action. */
  primary?: boolean;
  disabled?: boolean;
  /** Keeps the button the width of its label instead of filling the row. */
  compact?: boolean;
}

/**
 * A pressable button. The terminal has no hover state worth relying on, so the
 * affordance is the border: it brightens under the pointer and while pressed.
 */
export function Button({
  label,
  onPress,
  primary = false,
  disabled = false,
  compact = true,
}: ButtonProps): ReactNode {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const edge = disabled
    ? theme.colors.border
    : pressed || primary
      ? theme.colors.accent
      : hovered
        ? theme.colors.text
        : theme.colors.border;

  return (
    <box
      onMouseDown={() => {
        if (disabled) return;
        setPressed(true);
        onPress?.();
      }}
      onMouseUp={() => setPressed(false)}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => {
        setHovered(false);
        setPressed(false);
      }}
      style={{
        border: true,
        borderStyle: 'rounded',
        borderColor: edge,
        backgroundColor: pressed ? theme.colors.border : theme.colors.surface,
        paddingLeft: 1,
        paddingRight: 1,
        height: 3,
        flexGrow: compact ? 0 : 1,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <text fg={disabled ? theme.colors.muted : theme.colors.text}>{label}</text>
    </box>
  );
}

export interface ToggleProps {
  label?: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}

/** An on/off switch, drawn as a track the eye can read without the label. */
export function Toggle({ label, value, onChange, disabled = false }: ToggleProps): ReactNode {
  const theme = useTheme();
  const track = value ? '[▮ ]' : '[ ▮]';

  return (
    <box
      onMouseDown={() => {
        if (!disabled) onChange?.(!value);
      }}
      style={{ flexDirection: 'row', gap: 1, flexShrink: 0 }}
    >
      <text fg={disabled ? theme.colors.muted : value ? theme.colors.success : theme.colors.muted}>
        {track}
      </text>
      {label !== undefined && (
        <text fg={disabled ? theme.colors.muted : theme.colors.text}>{label}</text>
      )}
    </box>
  );
}

export interface TextInputProps {
  value?: string;
  placeholder?: string;
  focused?: boolean;
  onInput?: (value: string) => void;
  onSubmit?: (value: string) => void;
  /** Rendered dim to the left of the field, e.g. `>`. */
  prefix?: string;
}

/** A single-line text field, themed and with an optional prompt prefix. */
export function TextInput({
  value,
  placeholder,
  focused = false,
  onInput,
  onSubmit,
  prefix,
}: TextInputProps): ReactNode {
  const theme = useTheme();

  // OpenTUI declares `onSubmit` twice — once as the React prop that receives
  // the value and once as the renderable option that receives an event — and
  // the intersection of the two is unsatisfiable. The value-taking form is the
  // one that actually runs, so the props are assembled and asserted once here.
  const inputProps = {
    focused,
    ...(value === undefined ? {} : { value }),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(onInput === undefined ? {} : { onInput }),
    ...(onSubmit === undefined ? {} : { onSubmit }),
    style: {
      flexGrow: 1,
      backgroundColor: theme.colors.surface,
      focusedBackgroundColor: theme.colors.surface,
      textColor: theme.colors.text,
      placeholderColor: theme.colors.muted,
      cursorColor: theme.colors.accent,
    },
  } as unknown as InputProps;

  return (
    <box style={{ flexDirection: 'row', gap: 1, height: 1, flexShrink: 0 }}>
      {prefix !== undefined && <text fg={theme.colors.accent}>{prefix}</text>}
      <input {...inputProps} />
    </box>
  );
}
