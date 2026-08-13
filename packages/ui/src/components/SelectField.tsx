import { useEffect, useState, type ReactNode } from 'react';
import { useRuntime, useTheme } from '../app/context.js';
import { List, type ListItem } from './Table.js';
import { SelectFieldListKeys } from './SelectFieldListKeys.js';

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

  const items: ListItem[] = [
    ...(allowClear ? [{ id: '', label: placeholder, marker: value === '' ? '●' : '·' }] : []),
    ...options.map((option) => ({
      id: option.value,
      label: option.label,
      marker: option.value === value ? '●' : '·',
    })),
  ];

  const valueIndex = items.findIndex((item) => item.id === value);
  const [cursor, setCursor] = useState(Math.max(0, valueIndex));

  useEffect(() => {
    if (focused) setCursor(Math.max(0, valueIndex));
  }, [focused, valueIndex]);

  const display =
    value === '' ? placeholder : (options.find((option) => option.value === value)?.label ?? value);

  return (
    <box onMouseDown={() => onFocus?.()} style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
      <text fg={focused ? theme.colors.accent : theme.colors.text}>{display}</text>
      {focused && (
        <>
          <SelectFieldListKeys
            items={items}
            cursor={cursor}
            value={value}
            onCursorChange={setCursor}
            {...(onChange === undefined ? {} : { onChange })}
          />
          <List
            items={items}
            selected={cursor}
            onSelect={(_index, item) => {
              if (item.id !== value) onChange?.(item.id);
            }}
          />
        </>
      )}
    </box>
  );
}
