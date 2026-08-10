import type { Json } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';

/**
 * Dashboards are declarative: a YAML file describes rows of widgets, and the
 * renderer resolves each widget type against the registry that plugins
 * contribute to. Nothing in a dashboard file names a plugin — it names widget
 * types, which is what lets one dashboard survive swapping the plugin behind
 * a widget.
 */
export interface WidgetSpec {
  /** Widget type, e.g. `focus.session`, or a built-in like `core.clock`. */
  type: string;
  /** Overrides the widget's own title. */
  title?: string;
  /** Entities this widget reads, beyond the ones its type declares. */
  entities?: EntityId[];
  /** Relative width within its row. Defaults to an equal share. */
  span?: number;
  /** Widget-specific options, passed through untouched. */
  options?: Record<string, Json>;
}

export interface RowSpec {
  /** Relative height within the dashboard. Defaults to an equal share. */
  height?: number;
  widgets: WidgetSpec[];
}

export interface DashboardSpec {
  /** Unique dashboard name, matching its file name. */
  name: string;
  title?: string;
  /** Theme override; falls back to the configured theme. */
  theme?: string;
  /** Seconds between automatic refreshes. `0` disables them. */
  refresh?: number;
  rows: RowSpec[];
}

/**
 * The dashboard shipped with a fresh install. It is built entirely from
 * built-in widgets, so a first run has something to show before any plugin
 * contributes anything.
 */
export const DEFAULT_DASHBOARD: DashboardSpec = {
  name: 'home',
  title: 'Nightshift',
  rows: [
    {
      widgets: [
        { type: 'core.clock' },
        {
          type: 'core.note',
          title: 'Getting started',
          span: 2,
          options: {
            text: 'Press ctrl+p for commands, ? for keys. Dashboards live in ~/.config/nightshift/dashboards.',
          },
        },
      ],
    },
    {
      height: 2,
      widgets: [{ type: 'core.entities', span: 2 }, { type: 'core.commands' }],
    },
  ],
};
