import { notImplemented, type Json } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';
import type { ComponentType } from '@nightshift/ui';

/**
 * Dashboards are declarative: a YAML file describes rows of widgets, and the
 * renderer resolves each widget type against the registry that plugins
 * contribute to. Phase 3 implements the parser and renderer.
 */

export interface WidgetSpec {
  /** Widget type, e.g. `focus.session`, or a built-in component name. */
  type: ComponentType | (string & {});
  title?: string;
  /** Entities this widget reads. Changes to them trigger a re-render. */
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
  rows: RowSpec[];
}

/** Parses a dashboard YAML document. Implemented in Phase 3. */
export function parseDashboard(_source: string): DashboardSpec {
  return notImplemented('Dashboard parsing', 'Phase 3');
}

/** The dashboard shipped with a fresh install. */
export const DEFAULT_DASHBOARD: DashboardSpec = {
  name: 'home',
  title: 'Nightshift',
  rows: [
    {
      widgets: [
        { type: 'focus.session', title: 'Focus', entities: ['timer.focus'], span: 2 },
        { type: 'focus.today', title: 'Today' },
      ],
    },
  ],
};
