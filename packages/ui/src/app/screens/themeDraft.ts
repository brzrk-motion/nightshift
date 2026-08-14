import { HEX_COLOR, MIDNIGHT_THEME, THEME_COLOR_KEYS, type ThemeColorKey } from '../../theme.js';
import type { Json } from '@nightshift/core';
import { themeFromMidnight } from '../../theme/schema.js';
import { CATALOG_NAME, duplicateCatalogDraft, mapCatalogActive } from './draftUtils.js';

/** One row from the `nightshift.themes` catalog entity. */
export interface ThemeCatalogRow {
  name: string;
  source: 'built-in' | 'user';
  active: boolean;
  appearance: 'dark' | 'light';
  colors: Record<ThemeColorKey, string>;
  [key: string]: Json;
}

export interface ThemeDraft {
  name: string;
  appearance: 'dark' | 'light';
  colors: Record<ThemeColorKey, string>;
}

export const THEME_NAME = CATALOG_NAME;

export function emptyDraft(): ThemeDraft {
  const template = themeFromMidnight();
  return {
    name: '',
    appearance: template.appearance,
    colors: { ...template.colors },
  };
}

export function draftFromCatalog(row: ThemeCatalogRow): ThemeDraft {
  return {
    name: row.name,
    appearance: row.appearance,
    colors: { ...row.colors },
  };
}

/** Prefill a create draft from an existing catalog row (duplicate flow). */
export function duplicateDraft(row: ThemeCatalogRow): ThemeDraft {
  return duplicateCatalogDraft(row, draftFromCatalog);
}

export { mapCatalogActive };

/**
 * Turns the editor draft into the args blob `theme.save` expects. Throws
 * a human-readable Error when validation fails — the screen turns that into a
 * toast without hitting the command.
 */
export function draftToSaveArgs(draft: ThemeDraft): Record<string, Json> {
  const name = draft.name.trim();
  if (name === '' || !THEME_NAME.test(name)) {
    throw new Error('Name must be lowercase letters, digits, and hyphens (e.g. forest).');
  }

  const colors: Record<string, string> = {};
  for (const key of THEME_COLOR_KEYS) {
    const value = draft.colors[key].trim();
    if (!HEX_COLOR.test(value)) {
      throw new Error(`${key} must be a lowercase hex color like #7aa2ff.`);
    }
    colors[key] = value;
  }

  return { name, appearance: draft.appearance, colors };
}

/** Midnight accent for tests that need a known catalog row. */
export const SAMPLE_CATALOG_ROW: ThemeCatalogRow = {
  name: MIDNIGHT_THEME.name,
  source: 'built-in',
  active: true,
  appearance: MIDNIGHT_THEME.appearance,
  colors: { ...MIDNIGHT_THEME.colors },
};
