import type { ReactNode } from 'react';
import { Button } from './controls.js';
import { Modal } from './Modal.js';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  width?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive or override confirmation dialog with standard button row. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  width = 48,
  onConfirm,
  onCancel,
}: ConfirmModalProps): ReactNode {
  return (
    <Modal open={open} title={title} hint="y confirm · esc cancel" width={width}>
      <box style={{ flexDirection: 'column', gap: 1 }}>
        <text>{message}</text>
        <box style={{ flexDirection: 'row', gap: 1 }}>
          <Button label={confirmLabel} primary onPress={onConfirm} />
          <Button label={cancelLabel} onPress={onCancel} />
        </box>
      </box>
    </Modal>
  );
}
