import { useEffect, useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { useRuntime, useTheme } from '../app/context.js';
import { List, type ListItem } from './Table.js';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  value: string;
  options: readonly SelectOption[];
  placeholder?: string;
  focused?: boolean;
  /** When true, an empty value row clears the selection. */
  allowClear?: boolean;
  onChange?: (value: string) => void;
  onFocus?: () => void;
}

/**
 * Single-select picker for theme, dashboard, and similar fields. Shows a
 * compact label when blurred and an item list when focused.
 */
export function SelectField({
  value,
  options,
  placeholder = '(none)',
  focused = false,
  allowClear = true,
  onChange,
  onFocus,
}: SelectFieldProps): ReactNode {
  const theme = useTheme();
  const runtime = useRuntime();

  const items: ListItem[] = [
    ...(allowClear
      ? [{ id: '', label: placeholder, marker: value === '' ? '●' : '·' }]
      : []),
    ...options.map((option) => ({
      id: option.value,
      label: option.label,
      marker: option.value === value ? '●' : '·',
    })),
  ];

  const valueIndex = items.findIndex((item) => item.id === value);
  const [cursor, setCursor] = useState(Math.max(0, valueIndex));

  useEffect(() => {
    if (!focused) return;
    return runtime?.keyboardCapture.acquire();
  }, [focused, runtime]);

  useEffect(() => {
    if (focused) setCursor(Math.max(0, valueIndex));
  }, [focused, valueIndex]);

  useKeyboard((key) => {
    if (!focused || items.length === 0) return;
    if (key.name === 'up' || key.name === 'k') {
      setCursor((index) => Math.max(0, index - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      setCursor((index) => Math.min(items.length - 1, index + 1));
    } else if (key.name === 'return') {
      const item = items[cursor];
      if (item && item.id !== value) onChange?.(item.id);
    }
  });

  const display =
    value === ''
      ? placeholder
      : (options.find((option) => option.value === value)?.label ?? value);

  return (
    <box
      onMouseDown={() => onFocus?.()}
      style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}
    >
      <text fg={focused ? theme.colors.accent : theme.colors.text}>{display}</text>
      {focused && (
        <List
          items={items}
          selected={cursor}
          onSelect={(_index, item) => {
            if (item.id !== value) onChange?.(item.id);
          }}
        />
      )}
    </box>
  );
}
