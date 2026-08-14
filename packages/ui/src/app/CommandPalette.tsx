import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { useTheme } from './context.js';
import type { Command, CommandRegistry } from '../commands.js';
import { Modal } from '../components/Modal.js';

export interface CommandPaletteProps {
  open: boolean;
  commands: CommandRegistry;
  onClose: () => void;
  /** Runs the chosen command. Defaults to the registry's own `run`. */
  onRun?: (command: Command) => void;
  /** Rows of results to show at once. */
  limit?: number;
}

/** True for a key that should be typed into the query rather than acted on. */
function isTypable(key: { name?: string | undefined; ctrl?: boolean; meta?: boolean }): boolean {
  return (
    key.ctrl !== true && key.meta !== true && typeof key.name === 'string' && key.name.length === 1
  );
}

/**
 * The command palette: type a few letters, get the command. It is the only
 * discovery surface Nightshift has, so everything a plugin contributes shows
 * up here without the plugin doing anything else.
 *
 * The query is edited here rather than in an `<input>` because a focused input
 * consumes the whole keyboard — including escape, which is the one key a modal
 * cannot afford to lose.
 */
export function CommandPalette({
  open,
  commands,
  onClose,
  onRun,
  limit = 8,
}: CommandPaletteProps): ReactNode {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const results = useMemo(
    () => (open ? commands.search(query, { limit }) : []),
    [commands, limit, open, query],
  );

  // Opening starts from a clean slate; a stale query from last time is never
  // what the user meant.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  useKeyboard((key) => {
    if (!open) return;

    if (key.name === 'escape') return onClose();

    if (key.name === 'down' || (key.name === 'n' && key.ctrl)) {
      return setCursor((current) => (results.length === 0 ? 0 : (current + 1) % results.length));
    }
    if (key.name === 'up' || (key.name === 'p' && key.ctrl)) {
      return setCursor((current) =>
        results.length === 0 ? 0 : (current - 1 + results.length) % results.length,
      );
    }

    if (key.name === 'backspace') {
      return setQuery((current) => current.slice(0, -1));
    }

    if (key.name === 'return') {
      const command = results[cursor];
      if (!command) return;
      onClose();
      if (onRun) onRun(command);
      else void commands.run(command.id);
      return;
    }

    if (isTypable(key)) setQuery((current) => current + key.name);
  });

  if (!open) return null;

  return (
    <Modal title="Commands" width={64} hint="↑↓ to move · enter to run · esc to close">
      <box style={{ flexDirection: 'row', gap: 1, height: 1 }}>
        <text fg={theme.colors.accent}>›</text>
        {query === '' ? (
          <text fg={theme.colors.muted}>Type a command…</text>
        ) : (
          <text fg={theme.colors.text}>{`${query}▏`}</text>
        )}
      </box>
      <box style={{ height: 1 }} />
      {results.length === 0 ? (
        <text fg={theme.colors.muted}>No command matches “{query}”.</text>
      ) : (
        results.map((command, index) => {
          const active = index === cursor;
          return (
            <box
              key={command.id}
              style={{
                flexDirection: 'row',
                gap: 1,
                height: 1,
                ...(active ? { backgroundColor: theme.colors.border } : {}),
              }}
            >
              <text fg={active ? theme.colors.accent : theme.colors.muted}>
                {active ? '▸' : ' '}
              </text>
              <text fg={theme.colors.text}>{command.title}</text>
              <text fg={theme.colors.muted}>{command.id}</text>
            </box>
          );
        })
      )}
    </Modal>
  );
}
