import type { ReactNode } from 'react';
import { useTheme } from './context.js';
import type { CommandRegistry } from '../commands.js';
import { formatChord, type Keymap } from '../keymap.js';
import { Modal } from '../components/Modal.js';

export interface HelpOverlayProps {
  open: boolean;
  keymap: Keymap;
  /** Used to label a binding with its command's title. */
  commands?: CommandRegistry;
}

/**
 * The shortcut list, built from the live keymap rather than a hand-written
 * table — so a rebound key or a plugin's binding is documented the moment it
 * exists.
 */
export function HelpOverlay({ open, keymap, commands }: HelpOverlayProps): ReactNode {
  const theme = useTheme();
  if (!open) return null;

  const rows = keymap.bindings.filter((binding) => binding.when === undefined);
  const width = rows.reduce((max, binding) => Math.max(max, formatChord(binding.chord).length), 0);

  return (
    <Modal title="Keyboard" width={56} hint="esc to close">
      {rows.map((binding) => (
        <box
          key={`${binding.binding}:${binding.command}`}
          style={{ flexDirection: 'row', gap: 2, height: 1 }}
        >
          <text fg={theme.colors.accent}>{formatChord(binding.chord).padEnd(width)}</text>
          <text fg={theme.colors.text}>
            {binding.description ?? commands?.get(binding.command)?.title ?? binding.command}
          </text>
        </box>
      ))}
    </Modal>
  );
}
