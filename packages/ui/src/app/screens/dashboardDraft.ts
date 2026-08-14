import type { Json } from '@nightshift/core';
import { CATALOG_NAME, duplicateCatalogDraft, mapCatalogActive, optional } from './draftUtils.js';

/** One row from the `nightshift.dashboards` catalog entity. */
export interface DashboardCatalogRow {
  name: string;
  title: string;
  source: 'built-in' | 'user';
  active: boolean;
  theme?: string;
  refresh?: number;
  rows?: Array<Record<string, Json>>;
  [key: string]: Json;
}

export interface DashboardDraft {
  name: string;
  title: string;
  theme: string;
  /** Raw text field — parsed on save. */
  refresh: string;
  /** Copied from catalog on edit/duplicate; preserved on metadata save. */
  rows?: Array<Record<string, Json>>;
}

export const DASHBOARD_NAME = CATALOG_NAME;

/** Matches `DEFAULT_DASHBOARD_REFRESH` in `@nightshift/dashboard` schema. */
export const DEFAULT_DASHBOARD_REFRESH_SECONDS = 60;

export function emptyDraft(): DashboardDraft {
  return { name: '', title: '', theme: '', refresh: String(DEFAULT_DASHBOARD_REFRESH_SECONDS) };
}

export function draftFromCatalog(row: DashboardCatalogRow): DashboardDraft {
  return {
    name: row.name,
    title: row.title === row.name ? '' : row.title,
    theme: row.theme ?? '',
    refresh:
      row.refresh === undefined ? String(DEFAULT_DASHBOARD_REFRESH_SECONDS) : String(row.refresh),
    ...(row.rows === undefined ? {} : { rows: row.rows }),
  };
}

/** Prefill a create draft from an existing catalog row (duplicate flow). */
export function duplicateDraft(row: DashboardCatalogRow): DashboardDraft {
  return duplicateCatalogDraft(row, draftFromCatalog);
}

export { mapCatalogActive };

/**
 * Turns the editor draft into the args blob `dashboard.save` expects. Throws
 * a human-readable Error when validation fails — the screen turns that into a
 * toast without hitting the command.
 */
export function draftToSaveArgs(draft: DashboardDraft): Record<string, Json> {
  const name = draft.name.trim();
  if (name === '' || !DASHBOARD_NAME.test(name)) {
    throw new Error('Name must be lowercase letters, digits, and hyphens (e.g. work-board).');
  }
  const args: Record<string, Json> = { name };
  const title = optional(draft.title);
  const theme = optional(draft.theme);
  if (title !== undefined) args['title'] = title;
  if (theme !== undefined) args['theme'] = theme;
  const refreshText = draft.refresh.trim();
  const refresh = refreshText === '' ? DEFAULT_DASHBOARD_REFRESH_SECONDS : Number(refreshText);
  if (!Number.isInteger(refresh) || refresh < 0) {
    throw new Error('Refresh must be a non-negative whole number of seconds.');
  }
  args['refresh'] = refresh;
  if (draft.rows !== undefined) args['rows'] = draft.rows;
  return args;
}
