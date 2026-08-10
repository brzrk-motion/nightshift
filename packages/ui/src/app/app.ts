import { createEntityStore, type EntityStore } from '@nightshift/entities';
import { createCommandRegistry, type Command, type CommandRegistry } from '../commands.js';
import { createKeyboardCapture, type KeyboardCapture } from '../keyboardCapture.js';
import { createKeymap, type KeyBinding, type Keymap } from '../keymap.js';
import { createThemeEngine, type ThemeEngine } from '../theme.js';
import { createToastStore, type ToastStore } from '../toasts.js';
import type { AppRuntime } from './context.js';

export interface CreateAppRuntimeOptions {
  themes?: ThemeEngine;
  entities?: EntityStore;
  commands?: CommandRegistry;
  keymap?: Keymap;
  toasts?: ToastStore;
  keyboardCapture?: KeyboardCapture;
  /** Name of the theme to start on. */
  theme?: string;
  /** Bindings layered over the defaults. */
  keybindings?: readonly KeyBinding[];
  /** Commands available before any plugin loads. */
  commandList?: readonly Command[];
  size?: { width: number; height: number };
  onQuit?: () => void;
}

/**
 * Assembles the runtime an app renders against. Every part can be passed in,
 * which is what lets the CLI build a runtime with plugins already loaded — and
 * lets a test build one with nothing at all.
 */
export function createAppRuntime(options: CreateAppRuntimeOptions = {}): AppRuntime {
  const themes =
    options.themes ??
    createThemeEngine(options.theme === undefined ? {} : { initial: options.theme });

  return {
    themes,
    entities: options.entities ?? createEntityStore(),
    commands: options.commands ?? createCommandRegistry(options.commandList ?? []),
    keymap: options.keymap ?? createKeymap().extend(options.keybindings ?? []),
    toasts: options.toasts ?? createToastStore(),
    keyboardCapture: options.keyboardCapture ?? createKeyboardCapture(),
    size: options.size ?? { width: 80, height: 24 },
    quit: options.onQuit ?? (() => {}),
  };
}
