import { useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { useRuntime } from '../context.js';
import { type Command } from '../../commands.js';
import { handleListNavigationKey, moveListSelection } from '../../components/useListKeyboard.js';

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
    const onActivate = () => {
      const command = results[cursor];
      if (command) onPick(command);
    };
    const result = handleListNavigationKey(
      key.name,
      { ctrl: key.ctrl, meta: key.meta },
      results.length,
      cursor,
      { onActivate },
    );
    if (!result) return;
    if (result.delta !== undefined) {
      const { delta } = result;
      // Functional update so key-repeat still moves when `cursor` is stale.
      onCursorChange((index) => moveListSelection(index, results.length, delta));
      return;
    }
    if (result.action === 'activate') onActivate();
  });

  return null;
}
