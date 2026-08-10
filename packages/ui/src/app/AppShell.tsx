import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { isNightshiftError } from '@nightshift/core';
import { isRenderable, MIN_HEIGHT, MIN_WIDTH } from '../layout.js';
import type { Theme } from '../theme.js';
import { Toasts } from '../components/Toasts.js';
import type { ToastTone } from '../toasts.js';
import { CommandPalette } from './CommandPalette.js';
import { HelpOverlay } from './HelpOverlay.js';
import { RuntimeProvider, ThemeProvider, type AppRuntime } from './context.js';

const TOAST_TONES: readonly ToastTone[] = ['info', 'success', 'warning', 'danger'];

function isToastTone(value: unknown): value is ToastTone {
  return TOAST_TONES.includes(value as ToastTone);
}

export type Overlay = 'palette' | 'help' | null;

export interface AppShellProps {
  runtime: AppRuntime;
  /** Shown on the left of the status bar. */
  title?: string;
  /** Shown on the right of the status bar. */
  status?: string;
  children?: ReactNode;
}

/**
 * The application shell: providers, the status bar, the overlays, and the one
 * place keyboard input is turned into commands.
 *
 * Everything the user can trigger goes through the command registry, so a
 * keybinding, a palette entry and a vibe action all take the same path — and
 * anything a plugin registers is reachable by all three without extra wiring.
 */
export function AppShell({ runtime, title, status, children }: AppShellProps): ReactNode {
  const dimensions = useTerminalDimensions();
  const [theme, setTheme] = useState<Theme>(runtime.themes.current);
  const [overlay, setOverlay] = useState<Overlay>(null);

  useEffect(() => runtime.themes.subscribe(setTheme), [runtime.themes]);

  // The runtime is what widgets read their size from, so it has to track the
  // terminal rather than the size the app happened to start at.
  runtime.size = dimensions;

  const closeOverlay = useCallback(() => setOverlay(null), []);

  // Commands the shell itself owns. Registering them here — rather than in the
  // CLI — keeps them available to anything that mounts a shell.
  useEffect(() => {
    const disposers = [
      runtime.commands.register({
        id: 'palette.open',
        title: 'Open the command palette',
        category: 'Nightshift',
        run: () => setOverlay('palette'),
      }),
      runtime.commands.register({
        id: 'help.toggle',
        title: 'Show the keyboard shortcuts',
        category: 'Nightshift',
        run: () => setOverlay((current) => (current === 'help' ? null : 'help')),
      }),
      runtime.commands.register({
        id: 'overlay.close',
        title: 'Close the overlay',
        category: 'Nightshift',
        hidden: true,
        run: closeOverlay,
      }),
      runtime.commands.register({
        id: 'app.quit',
        title: 'Quit Nightshift',
        category: 'Nightshift',
        run: () => runtime.quit(),
      }),
      runtime.commands.register({
        id: 'theme.next',
        title: 'Switch to the next theme',
        category: 'Nightshift',
        run: () => {
          const themes = runtime.themes.list();
          const index = themes.findIndex((entry) => entry.name === runtime.themes.current.name);
          const next = themes[(index + 1) % themes.length];
          if (next) runtime.themes.activate(next.name);
        },
      }),
      // The one way anything outside a React tree — a vibe action, an
      // automation, a plugin command — can show a toast: reference it by id,
      // like every other side effect in Nightshift.
      runtime.commands.register({
        id: 'app.notify',
        title: 'Show a notification',
        category: 'Nightshift',
        hidden: true,
        run: (args) => {
          const message = typeof args?.['message'] === 'string' ? args['message'] : undefined;
          if (!message) return;
          const tone = isToastTone(args?.['tone']) ? args['tone'] : 'info';
          runtime.toasts.push(message, { tone });
        },
      }),
    ];

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [closeOverlay, runtime]);

  // A command that throws should say so and leave the app standing.
  useEffect(
    () =>
      runtime.commands.events.on('failed', (id, error) => {
        const message = isNightshiftError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
        runtime.toasts.push(`${id}: ${message}`, { tone: 'danger', timeout: 6000 });
      }),
    [runtime],
  );

  useKeyboard((key) => {
    // While an overlay is up it owns the keyboard; only the universal escape
    // hatch still applies.
    if (overlay !== null) {
      if (key.name === 'c' && key.ctrl) runtime.quit();
      return;
    }
    const binding = runtime.keymap.resolve(key);
    if (!binding) return;
    void runtime.commands.run(binding.command).catch(() => {
      // Already reported through the `failed` event above.
    });
  });

  const tooSmall = !isRenderable(dimensions);
  const hint = useMemo(
    () => runtime.keymap.forCommand('palette.open')[0]?.binding ?? 'ctrl+p',
    [runtime.keymap],
  );

  return (
    <ThemeProvider theme={theme}>
      <RuntimeProvider runtime={runtime}>
        <box
          style={{
            width: '100%',
            height: '100%',
            flexDirection: 'column',
            backgroundColor: theme.colors.background,
          }}
        >
          {tooSmall ? (
            <box
              style={{
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
              }}
            >
              <text fg={theme.colors.warning}>This terminal is too small for Nightshift.</text>
              <text fg={theme.colors.muted}>
                {`${dimensions.width}×${dimensions.height} — it needs at least ${MIN_WIDTH}×${MIN_HEIGHT}.`}
              </text>
            </box>
          ) : (
            <box style={{ flexGrow: 1, flexDirection: 'column' }}>{children}</box>
          )}

          <box
            style={{
              height: 1,
              flexShrink: 0,
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: theme.colors.surface,
              paddingLeft: 1,
              paddingRight: 1,
            }}
          >
            <text fg={theme.colors.accent}>{title ?? 'nightshift'}</text>
            <text fg={theme.colors.muted}>{status ?? `${hint} for commands · ? for keys`}</text>
          </box>

          <CommandPalette
            open={overlay === 'palette'}
            commands={runtime.commands}
            onClose={closeOverlay}
          />
          <HelpOverlay
            open={overlay === 'help'}
            keymap={runtime.keymap}
            commands={runtime.commands}
          />
          <Toasts store={runtime.toasts} />
        </box>
      </RuntimeProvider>
    </ThemeProvider>
  );
}
