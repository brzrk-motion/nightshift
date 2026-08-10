import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import { isNightshiftError } from '@nightshift/core';
import { COMPACT_WIDTH, isRenderable, MIN_HEIGHT, MIN_WIDTH } from '../layout.js';
import type { Theme } from '../theme.js';
import { KeyHint } from '../components/Primitives.js';
import { Toasts } from '../components/Toasts.js';
import type { ToastTone } from '../toasts.js';
import { CommandPalette } from './CommandPalette.js';
import { HelpOverlay } from './HelpOverlay.js';
import { Header } from './Header.js';
import { NavRail } from './NavRail.js';
import { DEFAULT_SCREENS } from './screens.js';
import type { Screen } from './screen.js';
import { RuntimeProvider, ThemeProvider, type AppRuntime } from './context.js';

const TOAST_TONES: readonly ToastTone[] = ['info', 'success', 'warning', 'danger'];

function isToastTone(value: unknown): value is ToastTone {
  return TOAST_TONES.includes(value as ToastTone);
}

const DASHBOARD_SCREEN_ID = 'dashboard';

export type Overlay = 'palette' | 'help' | null;

export interface AppShellProps {
  runtime: AppRuntime;
  /** Shown as the "Dashboard" screen's label — a dashboard's own title. */
  title?: string;
  /** Overrides the footer's right-hand hints entirely. */
  status?: string;
  /** The dashboard content — the nav rail's first, un-closeable destination. */
  children?: ReactNode;
  /** The rest of the nav rail. Defaults to the built-in Vibes/Apps/Entities/
   * Automations/Settings screens; pass `[]` for a dashboard-only shell. */
  screens?: readonly Screen[];
}

/**
 * The application shell: the persistent header, nav rail and status bar
 * around a canvas that switches between the dashboard and the built-in
 * screens, plus the overlays and the one place keyboard input is turned into
 * commands.
 *
 * Everything the user can trigger goes through the command registry, so a
 * keybinding, a palette entry, a nav-rail click and a vibe action all take the
 * same path — and anything a plugin registers is reachable by all of them
 * without extra wiring.
 */
export function AppShell({
  runtime,
  title,
  status,
  children,
  screens = DEFAULT_SCREENS,
}: AppShellProps): ReactNode {
  const dimensions = useTerminalDimensions();
  const [theme, setTheme] = useState<Theme>(runtime.themes.current);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [activeScreen, setActiveScreen] = useState<string>(DASHBOARD_SCREEN_ID);

  useEffect(() => runtime.themes.subscribe(setTheme), [runtime.themes]);

  // The runtime is what widgets read their size from, so it has to track the
  // terminal rather than the size the app happened to start at.
  runtime.size = dimensions;

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const dashboardScreen: Screen = useMemo(
    () => ({
      id: DASHBOARD_SCREEN_ID,
      label: title ?? 'Dashboard',
      icon: 'dashboard',
      render: () => children,
    }),
    [children, title],
  );
  const allScreens = useMemo(() => [dashboardScreen, ...screens], [dashboardScreen, screens]);
  const current = allScreens.find((screen) => screen.id === activeScreen) ?? dashboardScreen;

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
      // One command per theme, for the Settings screen and the palette —
      // mirrors how a dashboard or a vibe gets an `open.<name>`/`activate.<name>`.
      ...runtime.themes.list().map((entry) =>
        runtime.commands.register({
          id: `theme.activate.${entry.name}`,
          title: `Use the ${entry.name} theme`,
          category: 'Theme',
          run: () => {
            runtime.themes.activate(entry.name);
          },
        }),
      ),
    ];

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [closeOverlay, runtime]);

  // One command per nav destination, so switching screens is reachable from
  // the palette exactly like switching dashboards or vibes is.
  useEffect(() => {
    const disposers = allScreens.map((screen) =>
      runtime.commands.register({
        id: `nav.${screen.id}`,
        title: `Go to ${screen.label}`,
        category: 'Navigate',
        run: () => setActiveScreen(screen.id),
      }),
    );
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [allScreens, runtime.commands]);

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

    // Digit keys jump to a nav destination by position — `1` is always the
    // dashboard, `2` the first screen after it, and so on.
    if (
      !key.ctrl &&
      !key.option &&
      !key.meta &&
      typeof key.name === 'string' &&
      /^[1-9]$/.test(key.name)
    ) {
      const target = allScreens[Number(key.name) - 1];
      if (target) return setActiveScreen(target.id);
    }

    const binding = runtime.keymap.resolve(key);
    if (!binding) return;
    void runtime.commands.run(binding.command).catch(() => {
      // Already reported through the `failed` event above.
    });
  });

  const tooSmall = !isRenderable(dimensions);
  const collapsedRail = dimensions.width < COMPACT_WIDTH;
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
            <>
              <Header runtime={runtime} title={current.label} />
              <box style={{ flexGrow: 1, flexDirection: 'row' }}>
                <NavRail
                  screens={allScreens}
                  active={activeScreen}
                  onSelect={setActiveScreen}
                  collapsed={collapsedRail}
                />
                <box style={{ flexGrow: 1, flexDirection: 'column' }}>
                  {activeScreen === DASHBOARD_SCREEN_ID ? (
                    // Rendered directly, not through `current.render` — that
                    // closure is rebuilt whenever `children` changes identity,
                    // and keying a component by a function that is not stable
                    // would remount the whole dashboard on every such render.
                    children
                  ) : (
                    // The built-in screens' `render` functions are stable
                    // module-level references, so keying by id here is safe:
                    // switching screens gets a fresh Fiber, and switching
                    // between two visits to the *same* screen does not.
                    <current.render key={current.id} />
                  )}
                </box>
              </box>
            </>
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
            <text fg={theme.colors.accent}>{current.label}</text>
            {status === undefined ? (
              <box style={{ flexDirection: 'row', gap: 3 }}>
                <KeyHint keys={hint} label="commands" />
                <KeyHint keys="?" label="help" />
                <KeyHint keys="q" label="quit" />
              </box>
            ) : (
              <text fg={theme.colors.muted}>{status}</text>
            )}
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
