import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useKeyboard } from '@opentui/react';
import { AppShell, type AppRuntime } from '@nightshift/ui';
import { loadDashboards, mergeDashboards, saveDashboard } from './parse.js';
import type { DashboardSpec } from './schema.js';
import type { WidgetDefinition, WidgetRegistry } from './registry.js';
import { Dashboard } from './Dashboard.js';
import { WidgetPicker } from './WidgetPicker.js';
import { OnboardingModal } from './Onboarding.js';
import {
  addWidget,
  clampAddress,
  cloneDashboard,
  moveHorizontal,
  moveVertical,
  nextAddress,
  removeWidget,
  resizeRowHeight,
  resizeSpan,
  specForPickedWidget,
  swapWidget,
  type WidgetAddress,
} from './edit.js';

export interface DashboardAppProps {
  runtime: AppRuntime;
  /** Every dashboard available to switch between. */
  dashboards: readonly DashboardSpec[];
  registry: WidgetRegistry;
  /** Name of the dashboard to open first. */
  initial?: string;
  /** Called when the user switches dashboards, to persist the choice. */
  onSwitch?: (name: string) => void;
  /** Notified when the host updates the merged dashboard list after save/delete. */
  subscribeDashboards?: (listener: (dashboards: readonly DashboardSpec[]) => void) => () => void;
  /**
   * Where dashboard files live. Edit mode and `dashboard.reload` only
   * register when this is given — without it there is nowhere to save a
   * change to, so offering to make one would be dishonest.
   */
  dashboardsDir?: string;
  /** Dashboards Nightshift ships with, kept alongside whatever reload finds
   * on disk — the same built-ins `apps/cli`'s startup already merges in. */
  builtInDashboards?: readonly DashboardSpec[];
  /** Shows the one-time welcome modal on mount. The caller decides this from
   * its own persisted "have we shown it before" flag — `DashboardApp` does
   * not know how or where that is stored. */
  onboarding?: boolean;
  /** Called once the welcome modal is dismissed, so the caller can persist
   * that it has now been seen. */
  onOnboardingDismissed?: () => void;
}

/**
 * The whole terminal application: the shell, the active dashboard, the
 * commands for moving between dashboards, and — given somewhere to save to —
 * an in-place editor for the one currently open.
 *
 * Switching, and every edit action, are commands rather than keybinding-only
 * features, so they show up in the palette and can be triggered by a vibe —
 * the same way anything else in Nightshift is reachable three ways without
 * being wired three times.
 */
export function DashboardApp({
  runtime,
  dashboards: initialDashboards,
  registry,
  initial,
  onSwitch,
  subscribeDashboards,
  dashboardsDir,
  builtInDashboards = [],
  onboarding = false,
  onOnboardingDismissed,
}: DashboardAppProps): ReactNode {
  const [dashboards, setDashboards] = useState<readonly DashboardSpec[]>(() => initialDashboards);
  const [onboardingOpen, setOnboardingOpen] = useState(onboarding);
  const dismissOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    onOnboardingDismissed?.();
  }, [onOnboardingDismissed]);
  const first = initial ?? dashboards[0]?.name ?? 'home';
  const [active, setActive] = useState(first);
  const [generation, setGeneration] = useState(0);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DashboardSpec | null>(null);
  const [selected, setSelected] = useState<WidgetAddress | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'add' | 'swap'>('add');

  const saved = useMemo(
    () => dashboards.find((dashboard) => dashboard.name === active) ?? dashboards[0],
    [active, dashboards],
  );
  // The draft is what's on screen while editing; the saved copy otherwise.
  const current = editing && draft ? draft : saved;

  const open = useCallback(
    (name: string) => {
      if (!dashboards.some((dashboard) => dashboard.name === name)) {
        runtime.toasts.push(`No dashboard named "${name}".`, { tone: 'warning' });
        return;
      }
      // Switching away from an in-progress edit discards it — there is
      // nothing sensible to do with a draft for a dashboard that is no
      // longer open.
      setEditing(false);
      setDraft(null);
      setSelected(null);
      setActive(name);
      onSwitch?.(name);
    },
    [dashboards, onSwitch, runtime.toasts],
  );

  useEffect(() => {
    if (!subscribeDashboards) return undefined;
    return subscribeDashboards((next) => setDashboards(next));
  }, [subscribeDashboards]);

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
        run: () => {
          if (runtime.keyboardCapture.isCaptured()) return;
          setGeneration((value) => value + 1);
        },
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

  // Edit mode and reload need somewhere to read from and write to; without
  // one, none of what follows in this section registers at all.
  const canEdit = dashboardsDir !== undefined;

  const reload = useCallback(async () => {
    if (!dashboardsDir) return;
    const found = await loadDashboards(dashboardsDir);
    for (const failure of found.failed) {
      const reason = failure.error instanceof Error ? failure.error.message : String(failure.error);
      runtime.toasts.push(`${failure.path} could not be read: ${reason}`, { tone: 'warning' });
    }
    setDashboards(mergeDashboards(found.dashboards, builtInDashboards));
    runtime.toasts.push('Dashboards reloaded.', { tone: 'success' });
  }, [dashboardsDir, builtInDashboards, runtime.toasts]);

  const startEditing = useCallback(() => {
    if (!saved) return;
    const clone = cloneDashboard(saved);
    setDraft(clone);
    setSelected(nextAddress(clone, null, 1));
    setEditing(true);
  }, [saved]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setDraft(null);
    setSelected(null);
    runtime.toasts.push('Changes discarded.', { tone: 'info' });
  }, [runtime.toasts]);

  const resetEditing = useCallback(() => {
    if (!saved) return;
    const clone = cloneDashboard(saved);
    setDraft(clone);
    setSelected((current) => clampAddress(clone, current));
    runtime.toasts.push('Reset to the last saved version.', { tone: 'info' });
  }, [saved, runtime.toasts]);

  const saveEditing = useCallback(async () => {
    if (!dashboardsDir || !draft) return;
    try {
      await saveDashboard(dashboardsDir, draft);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      runtime.toasts.push(`Could not save "${draft.name}": ${reason}`, { tone: 'danger' });
      return;
    }
    setDashboards((existing) => {
      const exists = existing.some((dashboard) => dashboard.name === draft.name);
      const next = exists
        ? existing.map((dashboard) => (dashboard.name === draft.name ? draft : dashboard))
        : [...existing, draft];
      return [...next].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditing(false);
    setDraft(null);
    setSelected(null);
    runtime.toasts.push(`Saved "${draft.name}".`, { tone: 'success' });
  }, [dashboardsDir, draft, runtime.toasts]);

  const removeSelectedWidget = useCallback(() => {
    setDraft((current) => {
      if (!current || !selected) return current;
      const result = removeWidget(current, selected);
      setSelected(result.selected);
      return result.dashboard;
    });
  }, [selected]);

  const pickWidget = useCallback(
    (widget: WidgetDefinition) => {
      const spec = specForPickedWidget(widget.type);
      if (pickerMode === 'swap' && selected) {
        setDraft((current) => (current ? swapWidget(current, selected, spec) : current));
        return;
      }
      setDraft((current) => {
        if (!current) return current;
        const result = addWidget(current, selected, spec);
        setSelected(result.selected);
        return result.dashboard;
      });
    },
    [selected, pickerMode],
  );

  useEffect(() => {
    if (!canEdit) return undefined;
    const disposers = [
      runtime.commands.register({
        id: 'dashboard.edit.toggle',
        title: editing ? 'Stop editing this dashboard' : 'Edit this dashboard',
        category: 'Dashboard',
        run: () => (editing ? cancelEditing() : startEditing()),
      }),
      runtime.commands.register({
        id: 'dashboard.edit.save',
        title: 'Save dashboard changes',
        category: 'Dashboard',
        hidden: !editing,
        run: () => void saveEditing(),
      }),
      runtime.commands.register({
        id: 'dashboard.edit.cancel',
        title: 'Discard dashboard changes',
        category: 'Dashboard',
        hidden: !editing,
        run: cancelEditing,
      }),
      runtime.commands.register({
        id: 'dashboard.edit.reset',
        title: 'Reset to the last saved version',
        category: 'Dashboard',
        hidden: !editing,
        run: resetEditing,
      }),
      runtime.commands.register({
        id: 'dashboard.edit.add',
        title: 'Add a widget',
        category: 'Dashboard',
        hidden: !editing,
        run: () => {
          setPickerMode('add');
          setPickerOpen(true);
        },
      }),
      runtime.commands.register({
        id: 'dashboard.edit.swap',
        title: 'Swap the selected widget',
        category: 'Dashboard',
        hidden: !editing || !selected,
        run: () => {
          if (!selected) return;
          setPickerMode('swap');
          setPickerOpen(true);
        },
      }),
      runtime.commands.register({
        id: 'dashboard.edit.remove',
        title: 'Remove the selected widget',
        category: 'Dashboard',
        hidden: !editing,
        run: removeSelectedWidget,
      }),
      runtime.commands.register({
        id: 'dashboard.reload',
        title: 'Reload dashboards from disk',
        category: 'Dashboard',
        run: () => void reload(),
      }),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [
    canEdit,
    editing,
    selected,
    startEditing,
    cancelEditing,
    resetEditing,
    saveEditing,
    removeSelectedWidget,
    reload,
    runtime.commands,
  ]);

  useKeyboard((key) => {
    // A focused widget input (a plugin's `TextInput`, say) wants every
    // keystroke to itself — see `@nightshift/ui`'s `keyboardCapture.ts`. Without
    // this, typing "e" into a todo's text would also toggle edit mode.
    if (runtime.keyboardCapture.isCaptured()) return;
    if (!canEdit || pickerOpen || onboardingOpen) return;

    if (!editing) {
      if (key.name === 'e' && !key.ctrl && !key.meta) startEditing();
      return;
    }

    if (key.name === 'escape') return cancelEditing();
    if (key.name === 's' && key.ctrl) return void saveEditing();
    if (key.name === 'r' && !key.ctrl) return resetEditing();
    if (key.name === 'a' && !key.ctrl) {
      setPickerMode('add');
      return setPickerOpen(true);
    }
    if (key.name === 'w' && !key.ctrl && selected) {
      setPickerMode('swap');
      return setPickerOpen(true);
    }
    if ((key.name === 'd' || key.name === 'delete' || key.name === 'backspace') && !key.ctrl) {
      return removeSelectedWidget();
    }
    if (key.name === 'tab') {
      if (!draft) return;
      return setSelected(nextAddress(draft, selected, key.shift ? -1 : 1));
    }

    if (!selected || !draft) return;

    if (key.name === 'left' || key.name === 'right') {
      const direction: 1 | -1 = key.name === 'right' ? 1 : -1;
      if (key.shift) {
        return setDraft(resizeSpan(draft, selected, direction));
      }
      const result = moveHorizontal(draft, selected, direction);
      setDraft(result.dashboard);
      setSelected(result.selected);
      return;
    }

    if (key.name === 'up' || key.name === 'down') {
      const direction: 1 | -1 = key.name === 'down' ? 1 : -1;
      if (key.shift) {
        return setDraft(resizeRowHeight(draft, selected.row, direction));
      }
      const result = moveVertical(draft, selected, direction);
      setDraft(result.dashboard);
      setSelected(result.selected);
    }
  });

  const status = editing
    ? '←→ move · shift+←→ resize · a add · w swap · d remove · ctrl+s save · esc cancel'
    : undefined;

  return (
    <AppShell
      runtime={runtime}
      title={`nightshift · ${editing ? 'editing ' : ''}${
        current ? current.title?.trim() || current.name : 'no dashboard'
      }`}
      {...(status === undefined ? {} : { status })}
    >
      {current ? (
        <Dashboard
          dashboard={current}
          registry={registry}
          generation={generation}
          editing={editing}
          selected={selected}
          onSelectWidget={setSelected}
        />
      ) : (
        <box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <text>No dashboards are configured.</text>
        </box>
      )}
      <WidgetPicker
        open={pickerOpen}
        registry={registry}
        onClose={() => setPickerOpen(false)}
        onPick={pickWidget}
        title={pickerMode === 'swap' ? 'Swap widget' : 'Add a widget'}
      />
      <OnboardingModal open={onboardingOpen} onClose={dismissOnboarding} />
    </AppShell>
  );
}
