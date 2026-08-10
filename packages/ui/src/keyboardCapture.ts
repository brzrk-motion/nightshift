import type { Unsubscribe } from '@nightshift/core';

/**
 * Whether something on screen currently wants every keystroke to itself.
 *
 * OpenTUI delivers a keypress to every `useKeyboard` listener *and*, after
 * that, to whichever renderable is focused (a text `<input>`, say) — global
 * shortcuts do not naturally yield to a focused field the way a browser's
 * `<input>` would. `TextInput` (`components/controls.tsx`) acquires this
 * while its own `focused` prop is true; the shell's global key handlers
 * (`AppShell`, `DashboardApp`) check it and bail before acting on a key, so
 * typing a todo's text doesn't also toggle edit mode, quit the app, or jump
 * to another screen.
 */
export interface KeyboardCapture {
  isCaptured(): boolean;
  /** Ref-counted: safe to call from more than one focused input at once (or
   * across a re-render's overlapping acquire/release), since it only reports
   * "not captured" once every holder has released. */
  acquire(): Unsubscribe;
}

export function createKeyboardCapture(): KeyboardCapture {
  let count = 0;

  return {
    isCaptured: () => count > 0,
    acquire() {
      count += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count = Math.max(0, count - 1);
      };
    },
  };
}
