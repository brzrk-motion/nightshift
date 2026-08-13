import { useKeyboard } from '@opentui/react';
import { useRuntime } from '../app/context.js';

export interface ListKeyboardHandlers {
  onActivate?: () => void;
  onEdit?: () => void;
  onAdd?: () => void;
}

export interface UseListKeyboardOptions extends ListKeyboardHandlers {
  count: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  enabled?: boolean;
}

/** Clamp a list selection index to valid range. */
export function clampListSelection(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(0, index), count - 1);
}

/** Move selection by delta with clamping. */
export function moveListSelection(index: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return clampListSelection(index + delta, count);
}

/** Pure key handler for list navigation — tested without a renderer. */
export function handleListNavigationKey(
  keyName: string,
  modifiers: { ctrl?: boolean; meta?: boolean },
  count: number,
  selectedIndex: number,
  handlers: ListKeyboardHandlers,
): { selectedIndex?: number; action?: 'activate' | 'edit' | 'add' } | null {
  if (count <= 0 && keyName !== 'a') return null;

  if (keyName === 'up' || keyName === 'k') {
    return { selectedIndex: moveListSelection(selectedIndex, count, -1) };
  }
  if (keyName === 'down' || keyName === 'j') {
    return { selectedIndex: moveListSelection(selectedIndex, count, 1) };
  }
  if (keyName === 'return' && handlers.onActivate) {
    return { action: 'activate' };
  }
  if (keyName === 'e' && handlers.onEdit) {
    return { action: 'edit' };
  }
  if (keyName === 'a' && !modifiers.ctrl && !modifiers.meta && handlers.onAdd) {
    return { action: 'add' };
  }
  return null;
}

/** Shared keyboard navigation for catalog list screens. */
export function useListKeyboard({
  count,
  selectedIndex,
  onSelect,
  onActivate,
  onEdit,
  onAdd,
  enabled = true,
}: UseListKeyboardOptions): void {
  const runtime = useRuntime();

  useKeyboard((key) => {
    if (!enabled) return;
    if (runtime?.keyboardCapture.isCaptured()) return;

    const handlers: ListKeyboardHandlers = {};
    if (onActivate) handlers.onActivate = onActivate;
    if (onEdit) handlers.onEdit = onEdit;
    if (onAdd) handlers.onAdd = onAdd;

    const result = handleListNavigationKey(
      key.name,
      { ctrl: key.ctrl, meta: key.meta },
      count,
      selectedIndex,
      handlers,
    );
    if (!result) return;

    if (result.selectedIndex !== undefined) {
      onSelect(result.selectedIndex);
      return;
    }
    if (result.action === 'activate') onActivate?.();
    else if (result.action === 'edit') onEdit?.();
    else if (result.action === 'add') onAdd?.();
  });
}
