import { useSyncExternalStore, type ReactNode } from 'react';
import { useTheme, useRuntime } from '../app/context.js';
import type { Toast, ToastStore, ToastTone } from '../toasts.js';

const EMPTY: readonly Toast[] = [];

/** Subscribes to a toast store and re-renders as toasts arrive and expire. */
export function useToastList(store?: ToastStore): readonly Toast[] {
  const runtime = useRuntime();
  const target = store ?? runtime?.toasts;

  return useSyncExternalStore(
    (onChange) => target?.subscribe(onChange) ?? (() => {}),
    () => target?.list() ?? EMPTY,
    () => EMPTY,
  );
}

export interface ToastsProps {
  /** Defaults to the running app's store. */
  store?: ToastStore;
  /** Corner to stack them in. */
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  width?: number;
}

const TONE_MARKS: Record<ToastTone, string> = {
  info: '·',
  success: '✔',
  warning: '!',
  danger: '✖',
};

/**
 * The notification stack. Absolutely positioned so a toast never shifts the
 * dashboard underneath it — the one thing more annoying than missing a
 * notification is having the layout jump while you are reading something else.
 */
export function Toasts({ store, placement = 'bottom-right', width = 44 }: ToastsProps): ReactNode {
  const theme = useTheme();
  const toasts = useToastList(store);
  if (toasts.length === 0) return null;

  const [vertical, horizontal] = placement.split('-') as ['bottom' | 'top', 'right' | 'left'];

  return (
    <box
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        justifyContent: vertical === 'top' ? 'flex-start' : 'flex-end',
        alignItems: horizontal === 'left' ? 'flex-start' : 'flex-end',
        padding: 1,
        gap: 1,
      }}
    >
      {toasts.map((toast) => {
        const color = toast.tone === 'info' ? theme.colors.accent : theme.colors[toast.tone];
        return (
          <box
            key={toast.id}
            style={{
              border: true,
              borderStyle: 'rounded',
              borderColor: color,
              backgroundColor: theme.colors.surface,
              flexDirection: 'row',
              gap: 1,
              paddingLeft: 1,
              paddingRight: 1,
              width,
              flexShrink: 0,
            }}
          >
            <text fg={color}>{TONE_MARKS[toast.tone]}</text>
            <text fg={theme.colors.text}>{toast.message}</text>
          </box>
        );
      })}
    </box>
  );
}
