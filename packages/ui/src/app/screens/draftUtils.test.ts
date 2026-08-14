import { describe, expect, it } from 'vitest';
import { CATALOG_NAME, duplicateCatalogDraft, mapCatalogActive, optional } from './draftUtils.js';

describe('draftUtils', () => {
  it('validates catalog names', () => {
    expect(CATALOG_NAME.test('work-board')).toBe(true);
    expect(CATALOG_NAME.test('Bad Name')).toBe(false);
  });

  it('trims optional string fields', () => {
    expect(optional('  title  ')).toBe('title');
    expect(optional('   ')).toBeUndefined();
  });

  it('maps active flags from a resource name', () => {
    const rows = [
      { name: 'home', active: false },
      { name: 'work', active: false },
    ];
    const mapped = mapCatalogActive(rows, 'work');
    expect(mapped[0]?.active).toBe(false);
    expect(mapped[1]?.active).toBe(true);
  });

  it('clears name when duplicating a catalog draft', () => {
    const draft = duplicateCatalogDraft({ name: 'work', title: 'Work' }, (row) => ({
      name: row.name,
      title: row.title,
    }));
    expect(draft).toEqual({ name: '', title: 'Work' });
  });
});
