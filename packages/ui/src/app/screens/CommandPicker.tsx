import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TextInput } from '../../components/controls.js';
import { List } from '../../components/Table.js';
import { useRuntime, useTheme } from '../context.js';
import { CommandPickerListKeys } from './CommandPickerListKeys.js';

export interface CommandPickerProps {
  value: string;
  focused: boolean;
  onFocus: () => void;
  onChange: (command: string) => void;
}

/**
 * Searchable command picker with free-type fallback for hidden or future ids.
 */
export function CommandPicker({
  value,
  focused,
  onFocus,
  onChange,
}: CommandPickerProps): ReactNode {
  const theme = useTheme();
  const runtime = useRuntime();
  const [query, setQuery] = useState(value);
  const [cursor, setCursor] = useState(0);
  const wasFocused = useRef(false);

  const results = useMemo(() => {
    if (!runtime || !focused) return [];
    return runtime.commands.search(query, { limit: 12 });
  }, [focused, query, runtime]);

  useEffect(() => {
    if (focused && !wasFocused.current) setQuery(value);
    wasFocused.current = focused;
  }, [focused, value]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  return (
    <box style={{ flexDirection: 'column', gap: 1, flexGrow: 1 }}>
      <box onMouseDown={onFocus} style={{ flexGrow: 1 }}>
        <TextInput
          value={query}
          placeholder="command.id"
          focused={focused}
          onInput={(next) => {
            if (next === query) return;
            setQuery(next);
            if (next !== value) onChange(next);
          }}
        />
      </box>
      {focused && results.length > 0 && (
        <>
          <CommandPickerListKeys
            results={results}
            cursor={cursor}
            onCursorChange={setCursor}
            onPick={(command) => {
              onChange(command.id);
              setQuery(command.id);
            }}
          />
          <List
            items={results.map((command) => ({
              id: command.id,
              label: command.title,
              detail: command.id,
              marker: command.id === value ? '●' : '·',
            }))}
            selected={cursor}
            onSelect={(_index, item) => {
              onChange(item.id);
              setQuery(item.id);
            }}
          />
        </>
      )}
      {focused && results.length === 0 && query.trim() !== '' && (
        <text fg={theme.colors.muted}>No matching commands — free-typed id will be saved.</text>
      )}
    </box>
  );
}
