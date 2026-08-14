/** Lowercase kebab-case catalog resource name (e.g. `work-board`). */
export const CATALOG_NAME = /^[a-z][a-z0-9-]*$/;

/** Trims string fields that save as optional YAML keys. */
export function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Maps catalog rows with an explicit active resource name. */
export function mapCatalogActive<TRow extends { name: string; active: boolean }>(
  rows: readonly TRow[],
  active: string | null,
): TRow[] {
  return rows.map((row) => ({ ...row, active: row.name === active }));
}

/** Prefill a create draft from an existing catalog row (duplicate flow). */
export function duplicateCatalogDraft<TRow, TDraft extends { name: string }>(
  row: TRow,
  toDraft: (row: TRow) => TDraft,
): TDraft {
  const draft = toDraft(row);
  draft.name = '';
  return draft;
}
