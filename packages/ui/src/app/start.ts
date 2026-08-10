import { NightshiftError } from '@nightshift/core';
import type { ReactNode } from 'react';
import { assertRenderable, detectRuntime, type RuntimeSupport } from './runtime.js';

/**
 * Booting OpenTUI. The native renderer and the React reconciler are imported
 * lazily, inside this function, for two reasons: nothing outside the terminal
 * UI should pay for loading them, and every other Nightshift command has to
 * keep working on runtimes where the native library cannot load at all.
 */
export interface StartAppOptions {
  /** The tree to render. */
  render: () => ReactNode;
  /** Frames per second for the render loop. */
  targetFps?: number;
  /** Use the alternate screen buffer, restoring the terminal on exit. */
  fullscreen?: boolean;
  /** Mouse tracking. On by default. */
  mouse?: boolean;
  /** Terminal window title. */
  title?: string;
  /** Streams to drive, for tests and remote sessions. */
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  /** Called once the renderer has shut down. */
  onExit?: () => void;
}

export interface AppHandle {
  /** Tears the renderer down and restores the terminal. */
  stop(): Promise<void>;
  /** Resolves when the app exits, however it exits. */
  waitUntilExit(): Promise<void>;
  /** The live OpenTUI renderer, for anything the shell does not wrap. */
  renderer: unknown;
}

/**
 * Starts the terminal UI and resolves once it is on screen.
 *
 * Ctrl+C is handled by the app rather than by the renderer, so quitting always
 * runs the same shutdown path as the `app.quit` command — plugins get torn
 * down, and the terminal is restored, whichever way the user leaves.
 */
export async function startApp(options: StartAppOptions): Promise<AppHandle> {
  assertRenderable();

  const [{ createCliRenderer }, { createRoot }] = await Promise.all([
    import('@opentui/core'),
    import('@opentui/react'),
  ]);

  let renderer;
  try {
    renderer = await createCliRenderer({
      targetFps: options.targetFps ?? 30,
      screenMode: options.fullscreen === false ? 'main-screen' : 'alternate-screen',
      useMouse: options.mouse ?? true,
      // The shell binds Ctrl+C itself so that quitting is one code path.
      exitOnCtrlC: false,
      ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
      ...(options.stdout === undefined ? {} : { stdout: options.stdout }),
    });
  } catch (error) {
    const support = detectRuntime();
    throw new NightshiftError('RUNTIME_UNSUPPORTED', 'Could not start the terminal renderer.', {
      cause: error,
      hint: support.hint ?? 'Check that the terminal supports raw mode.',
    });
  }

  if (options.title !== undefined) renderer.setTerminalTitle(options.title);

  let resolveExit: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExit = resolve;
  });

  renderer.on('destroy', () => {
    options.onExit?.();
    resolveExit();
  });

  const root = createRoot(renderer);
  root.render(options.render());

  return {
    renderer,
    async stop() {
      if (!renderer.isDestroyed) renderer.destroy();
      await exited;
    },
    waitUntilExit: () => exited,
  };
}

export type { RuntimeSupport };
