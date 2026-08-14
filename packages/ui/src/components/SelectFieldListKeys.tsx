import { useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { useRuntime } from '../app/context.js';
import { type ListItem } from './Table.js';
import { handleListNavigationKey } from './useListKeyboard.js';

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
    const result = handleListNavigationKey(
      key.name,
      { ctrl: key.ctrl, meta: key.meta },
      items.length,
      cursor,
      { onActivate: () => {} },
    );
    if (!result) return;
    if (result.selectedIndex !== undefined) {
      onCursorChange(result.selectedIndex);
      return;
    }
    if (result.action === 'activate') {
      const item = items[cursor];
      if (item && item.id !== value) onChange?.(item.id);
    }
  });

  return null;
}
