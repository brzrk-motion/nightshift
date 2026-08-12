import { useKeyboard } from '@opentui/react';
import { type Command } from '../../commands.js';

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
  useKeyboard((key) => {
    if (results.length === 0) return;
    if (key.name === 'up' || key.name === 'k') {
      onCursorChange((index) => Math.max(0, index - 1));
    } else if (key.name === 'down' || key.name === 'j') {
      onCursorChange((index) => Math.min(results.length - 1, index + 1));
    } else if (key.name === 'return') {
      const command = results[cursor];
      if (command) onPick(command);
    }
  });

  return null;
}
