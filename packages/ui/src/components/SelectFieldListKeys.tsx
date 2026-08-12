import { useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { useRuntime } from '../app/context.js';
import { type ListItem } from './Table.js';

/** Keyboard navigation for an open select list — mounted only while focused. */
export function SelectFieldListKeys({
  items,
  cursor,
  value,
  onCursorChange,
  onChange,
}: {
  items: readonly ListItem[];
  cursor: number;
  value: string;
  onCursorChange: (update: number | ((current: number) => number)) => void;
  onChange?: (value: string) => void;
}): null {
  const runtime = useRuntime();

  useEffect(() => runtime?.keyboardCapture.acquire(), [runtime]);

  useKeyboard((key) => {
    if (items.length === 0) return;
    if (key.name === 'up' || key.name === 'k') {
      onCursorChange((index) => Math.max(0, index - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      onCursorChange((index) => Math.min(items.length - 1, index + 1));
    } else if (key.name === 'return') {
      const item = items[cursor];
      if (item && item.id !== value) onChange?.(item.id);
    }
  });

  return null;
}
