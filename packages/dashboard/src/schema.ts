import type { Json } from '@nightshift/core';
import type { Condition } from '@nightshift/automations';
import type { EntityId } from '@nightshift/entities';

/**
 * Dashboards are declarative: a YAML file describes rows of widgets, and the
 * renderer resolves each widget type against the registry that plugins
 * contribute to. Nothing in a dashboard file names a plugin — it names widget
 * types, which is what lets one dashboard survive swapping the plugin behind
 * a widget.
 */
export interface WidgetSpec {
  /** Widget type, e.g. `clock.now`, or a built-in like `core.note`. */
  type: string;
  /** Overrides the widget's own title. */
  title?: string;
  /** Entities this widget reads, beyond the ones its type declares. */
  entities?: EntityId[];
  /** Relative width within its row. Defaults to an equal share. */
  span?: number;
  /** Columns below which this widget is better off on a row of its own. */
  minWidth?: number;
  /** Rows below which this widget's row grows to fit it. */
  minHeight?: number;
  /** Widget-specific options, passed through untouched. */
  options?: Record<string, Json>;
  /**
   * Only rendered while this holds, checked against the entity store — the
   * same condition shape an automation's `and` uses, so a widget that only
   * matters while a session is running does not have to be built to hide
   * itself.
   */
  when?: Condition;
}

export interface RowSpec {
  /** Relative height within the dashboard. Defaults to an equal share. */
  height?: number;
  widgets: WidgetSpec[];
}

export interface DashboardSpec {
  /** Schema version, so a future Nightshift can migrate an older file.
   * Defaults to the current version when a file, or a caller, omits it. */
  version?: number;
  /** Unique dashboard name, matching its file name. */
  name: string;
  title?: string;
  /** Theme override; falls back to the configured theme. */
  theme?: string;
  /** Seconds between automatic refreshes. `0` disables them. */
  refresh?: number;
  rows: RowSpec[];
}

export const DASHBOARD_SCHEMA_VERSION = 1;

/**
 * The dashboard shipped with a fresh install. Beyond the built-ins, it draws
 * on every plugin Nightshift bundles by default — clock, focus, todo,
 * weather — so a first run already has something worth looking at.
 *
 * It carries no "getting started" widget of its own — that copy lives in the
 * one-time onboarding modal instead (`Onboarding.tsx`), so it does not sit
 * here permanently taking up a widget's worth of space after the first run.
 */
export const DEFAULT_DASHBOARD: DashboardSpec = {
  version: DASHBOARD_SCHEMA_VERSION,
  name: 'home',
  title: 'Nightshift',
  rows: [
    {
      widgets: [
        { type: 'clock.now' },
        { type: 'weather.now', span: 2, options: { location: 'home' } },
      ],
    },
    {
      height: 2,
      widgets: [
        { type: 'focus.session' },
        { type: 'todo.list' },
        { type: 'weather.forecast', options: { location: 'home' } },
      ],
    },
    { height: 2, widgets: [{ type: 'habit.tracker' }] },
    { height: 2, widgets: [{ type: 'core.commands' }] },
  ],
};

/**
 * As bare as a dashboard gets: just the palette laid open. Nothing here
 * depends on a plugin being installed, so it always renders — a good place
 * to land while sorting out what else is worth putting on screen.
 */
export const MINIMAL_DASHBOARD: DashboardSpec = {
  version: DASHBOARD_SCHEMA_VERSION,
  name: 'minimal',
  title: 'Minimal',
  rows: [{ widgets: [{ type: 'core.commands' }] }],
};

/**
 * The dark, entity-forward layout the project is named for: a wide table of
 * whatever is running, under the `midnight` theme. Built entirely from
 * built-in widgets, same guarantee as `minimal`.
 */
export const NIGHTSHIFT_DASHBOARD: DashboardSpec = {
  version: DASHBOARD_SCHEMA_VERSION,
  name: 'nightshift',
  // Distinct from `home`'s "Nightshift" title — both being the same word
  // would make "Open Nightshift" ambiguous in the palette and the commands
  // widget, with no way to tell which dashboard either one opens.
  title: 'Night Ops',
  theme: 'midnight',
  rows: [{ height: 3, widgets: [{ type: 'core.entities', span: 2 }, { type: 'core.commands' }] }],
};

/** Every dashboard Nightshift ships with, sorted the same way a merge with
 * user files would sort them. `apps/cli`'s runtime folds these in behind
 * whatever it finds on disk; `DashboardApp`'s reload does the same. */
export const BUILT_IN_DASHBOARDS: readonly DashboardSpec[] = [
  DEFAULT_DASHBOARD,
  MINIMAL_DASHBOARD,
  NIGHTSHIFT_DASHBOARD,
].sort((a, b) => a.name.localeCompare(b.name));
