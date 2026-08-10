import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppShell, type AppRuntime } from '@nightshift/ui';
import type { DashboardSpec } from './schema.js';
import type { WidgetRegistry } from './registry.js';
import { Dashboard } from './Dashboard.js';

export interface DashboardAppProps {
  runtime: AppRuntime;
  /** Every dashboard available to switch between. */
  dashboards: readonly DashboardSpec[];
  registry: WidgetRegistry;
  /** Name of the dashboard to open first. */
  initial?: string;
  /** Called when the user switches dashboards, to persist the choice. */
  onSwitch?: (name: string) => void;
}

/**
 * The whole terminal application: the shell, the active dashboard, and the
 * commands for moving between dashboards.
 *
 * Switching is a command rather than a keybinding-only feature, so it shows up
 * in the palette and can be triggered by a vibe — the same way anything else
 * in Nightshift is reachable three ways without being wired three times.
 */
export function DashboardApp({
  runtime,
  dashboards,
  registry,
  initial,
  onSwitch,
}: DashboardAppProps): ReactNode {
  const first = initial ?? dashboards[0]?.name ?? 'home';
  const [active, setActive] = useState(first);
  const [generation, setGeneration] = useState(0);

  const current = useMemo(
    () => dashboards.find((dashboard) => dashboard.name === active) ?? dashboards[0],
    [active, dashboards],
  );

  const open = useCallback(
    (name: string) => {
      if (!dashboards.some((dashboard) => dashboard.name === name)) {
        runtime.toasts.push(`No dashboard named "${name}".`, { tone: 'warning' });
        return;
      }
      setActive(name);
      onSwitch?.(name);
    },
    [dashboards, onSwitch, runtime.toasts],
  );

  // A dashboard's theme wins over the configured one while it is open, and the
  // configured theme comes back when it is not.
  useEffect(() => {
    const name = current?.theme;
    if (name === undefined) return;
    if (runtime.themes.resolve(name)) runtime.themes.activate(name);
    else runtime.toasts.push(`"${name}" is not a theme Nightshift knows.`, { tone: 'warning' });
  }, [current?.theme, runtime.themes, runtime.toasts]);

  useEffect(() => {
    const disposers = [
      runtime.commands.register({
        id: 'dashboard.refresh',
        title: 'Refresh every widget',
        category: 'Dashboard',
        run: () => setGeneration((value) => value + 1),
      }),
      runtime.commands.register({
        id: 'dashboard.switch',
        title: 'Switch to the next dashboard',
        category: 'Dashboard',
        run: () => {
          const index = dashboards.findIndex((dashboard) => dashboard.name === active);
          const next = dashboards[(index + 1) % Math.max(1, dashboards.length)];
          if (next) open(next.name);
        },
      }),
      // One command per dashboard, so the palette is the dashboard switcher.
      ...dashboards.map((dashboard) =>
        runtime.commands.register({
          id: `dashboard.open.${dashboard.name}`,
          title: `Open ${dashboard.title ?? dashboard.name}`,
          category: 'Dashboard',
          run: () => open(dashboard.name),
        }),
      ),
    ];

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [active, dashboards, open, runtime.commands]);

  return (
    <AppShell
      runtime={runtime}
      title={`nightshift · ${current?.title ?? current?.name ?? 'no dashboard'}`}
    >
      {current ? (
        <Dashboard dashboard={current} registry={registry} generation={generation} />
      ) : (
        <box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <text>No dashboards are configured.</text>
        </box>
      )}
    </AppShell>
  );
}
