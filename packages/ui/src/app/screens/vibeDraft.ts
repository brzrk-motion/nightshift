import type { Json } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';
import { CATALOG_NAME, duplicateCatalogDraft, optional } from './draftUtils.js';

/** One row from the `nightshift.vibes` catalog entity. */
export interface VibeCatalogRow {
  name: string;
  title: string;
  description: string;
  theme: string;
  dashboard: string;
  source: 'built-in' | 'user';
  active: boolean;
  entities?: Record<string, Record<string, Json>>;
  onActivate?: Array<{ command: string; args?: Record<string, Json> }>;
  onDeactivate?: Array<{ command: string; args?: Record<string, Json> }>;
  [key: string]: Json;
}

export interface ActionDraft {
  command: string;
  /** Raw JSON object text, or empty when the action has no args. */
  args: string;
}

export interface VibeDraft {
  name: string;
  title: string;
  description: string;
  theme: string;
  dashboard: string;
  onActivate: ActionDraft[];
  onDeactivate: ActionDraft[];
  /** Preserved on edit so save does not strip file-only entity merges. */
  entities?: Record<EntityId, Record<string, Json>>;
}

export function emptyDraft(): VibeDraft {
  return {
    name: '',
    title: '',
    description: '',
    theme: '',
    dashboard: '',
    onActivate: [],
    onDeactivate: [],
  };
}

export const VIBE_NAME = CATALOG_NAME;

/** Prefill a create draft from an existing catalog row (duplicate flow). */
export function duplicateDraft(row: VibeCatalogRow): VibeDraft {
  return duplicateCatalogDraft(row, draftFromCatalog);
}

export function draftFromCatalog(row: VibeCatalogRow): VibeDraft {
  return {
    name: row.name,
    title: row.title === row.name ? '' : row.title,
    description: row.description,
    theme: row.theme,
    dashboard: row.dashboard,
    onActivate: (row.onActivate ?? []).map((action) => ({
      command: action.command,
      args: action.args === undefined ? '' : JSON.stringify(action.args),
    })),
    onDeactivate: (row.onDeactivate ?? []).map((action) => ({
      command: action.command,
      args: action.args === undefined ? '' : JSON.stringify(action.args),
    })),
    ...(row.entities === undefined
      ? {}
      : { entities: row.entities as Record<EntityId, Record<string, Json>> }),
  };
}

function parseActionDrafts(
  drafts: readonly ActionDraft[],
  label: string,
): Array<{ command: string; args?: Record<string, Json> }> | undefined {
  const actions: Array<{ command: string; args?: Record<string, Json> }> = [];
  for (const [index, draft] of drafts.entries()) {
    const command = draft.command.trim();
    if (command === '') continue;
    const argsText = draft.args.trim();
    if (argsText === '') {
      actions.push({ command });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(argsText);
    } catch {
      throw new Error(`${label}[${index}] args must be a JSON object`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${label}[${index}] args must be a JSON object`);
    }
    actions.push({ command, args: parsed as Record<string, Json> });
  }
  return actions.length === 0 ? undefined : actions;
}

/**
 * Turns the editor draft into the args blob `vibe.save` expects. Throws a
 * human-readable Error when args JSON is malformed — the screen turns that
 * into a toast without hitting the command.
 */
export function draftToSaveArgs(draft: VibeDraft): Record<string, Json> {
  const name = draft.name.trim();
  if (name === '' || !VIBE_NAME.test(name)) {
    throw new Error('Name must be lowercase letters, digits, and hyphens (e.g. locked-in).');
  }
  const args: Record<string, Json> = { name };
  const title = optional(draft.title);
  const description = optional(draft.description);
  const theme = optional(draft.theme);
  const dashboard = optional(draft.dashboard);
  if (title !== undefined) args['title'] = title;
  if (description !== undefined) args['description'] = description;
  if (theme !== undefined) args['theme'] = theme;
  if (dashboard !== undefined) args['dashboard'] = dashboard;
  if (draft.entities !== undefined) args['entities'] = draft.entities;
  const onActivate = parseActionDrafts(draft.onActivate, 'onActivate');
  const onDeactivate = parseActionDrafts(draft.onDeactivate, 'onDeactivate');
  if (onActivate !== undefined) args['onActivate'] = onActivate;
  if (onDeactivate !== undefined) args['onDeactivate'] = onDeactivate;
  return args;
}
