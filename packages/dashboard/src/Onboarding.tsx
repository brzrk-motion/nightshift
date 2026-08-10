import type { ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { Modal, useTheme } from '@nightshift/ui';

export interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

const LINES: readonly string[] = [
  'ctrl+p or : opens the command palette — everything Nightshift can do is in there.',
  '? shows the full keyboard shortcut list.',
  'Dashboards live in ~/.config/nightshift/dashboards — press "e" on one to edit it in place.',
  'A vibe (nightshift vibe <name>) switches the theme, dashboard and widgets together.',
];

/**
 * The first-run welcome, shown once instead of living permanently on the
 * default dashboard as a widget. There is nothing to choose here, only
 * something to read once, so any key dismisses it.
 */
export function OnboardingModal({ open, onClose }: OnboardingModalProps): ReactNode {
  const theme = useTheme();

  useKeyboard((_key) => {
    if (open) onClose();
  });

  if (!open) return null;

  return (
    <Modal title="Welcome to Nightshift" width={64} hint="press any key to continue">
      {LINES.map((line) => (
        <text key={line} fg={theme.colors.text}>
          {line}
        </text>
      ))}
    </Modal>
  );
}
