import { useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { useRuntime } from '../context.js';
import { type Command } from '../../commands.js';
import { handleListNavigationKey } from '../../components/useListKeyboard.js';

/** List navigation for a focused command picker — mounted only while open. */
export function CommandPickerListKeys({
  results,
  cursor,
  onCursorChange,
  onPick,
}: {
  results: readonly Command[];
  cursor: number;
  onCursorChange: (update: number | ((current: number) => number)) => void;
  onPick: (command: Command) => void;
}): null {
  const runtime = useRuntime();

  useEffect(() => runtime?.keyboardCapture.acquire(), [runtime]);

  useKeyboard((key) => {
    const result = handleListNavigationKey(
      key.name,
      { ctrl: key.ctrl, meta: key.meta },
      results.length,
      cursor,
      { onActivate: () => {} },
    );
    if (!result) return;
    if (result.selectedIndex !== undefined) {
      onCursorChange(result.selectedIndex);
      return;
    }
    if (result.action === 'activate') {
      const command = results[cursor];
      if (command) onPick(command);
    }
  });

  return null;
}
