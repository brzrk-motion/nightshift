import { useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { useRuntime } from '../app/context.js';
import { type ListItem } from './Table.js';
import { handleListNavigationKey, moveListSelection } from './useListKeyboard.js';

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
    const onActivate = () => {
      const item = items[cursor];
      if (item && item.id !== value) onChange?.(item.id);
    };
    const result = handleListNavigationKey(
      key.name,
      { ctrl: key.ctrl, meta: key.meta },
      items.length,
      cursor,
      { onActivate },
    );
    if (!result) return;
    if (result.delta !== undefined) {
      const { delta } = result;
      // Functional update so key-repeat still moves when `cursor` is stale.
      onCursorChange((index) => moveListSelection(index, items.length, delta));
      return;
    }
    if (result.action === 'activate') onActivate();
  });

  return null;
}
