import { describe, expect, it } from 'vitest';
import { EMBER_THEME } from '../../theme.js';
import {
  draftFromCatalog,
  draftToSaveArgs,
  duplicateDraft,
  emptyDraft,
  isValidHex,
  mapCatalogActive,
  SAMPLE_CATALOG_ROW,
  type ThemeCatalogRow,
} from './themeDraft.js';

describe('themeDraft', () => {
  it('seeds create drafts from midnight', () => {
    const draft = emptyDraft();
    expect(draft.name).toBe('');
    expect(draft.appearance).toBe('dark');
    expect(draft.colors.background).toBe('#0b1020');
  });

  it('loads edit drafts from catalog rows', () => {
    const row: ThemeCatalogRow = {
      name: 'ember',
      source: 'built-in',
      active: false,
      appearance: 'dark',
      colors: { ...EMBER_THEME.colors },
    };
    const draft = draftFromCatalog(row);
    expect(draft.name).toBe('ember');
    expect(draft.colors.accent).toBe('#ff9e64');
  });

  it('clears name on duplicate', () => {
    const draft = duplicateDraft(SAMPLE_CATALOG_ROW);
    expect(draft.name).toBe('');
    expect(draft.colors.accent).toBe(SAMPLE_CATALOG_ROW.colors.accent);
  });

  it('maps active flags for catalog rows', () => {
    const rows = mapCatalogActive(
      [
        { ...SAMPLE_CATALOG_ROW, active: false },
        { ...SAMPLE_CATALOG_ROW, name: 'ember', active: false },
      ],
      'ember',
    );
    expect(rows[0]?.active).toBe(false);
    expect(rows[1]?.active).toBe(true);
  });

  it('turns valid drafts into save args with all color keys', () => {
    const draft = emptyDraft();
    draft.name = 'forest';
    draft.colors.accent = '#5ad19b';
    const args = draftToSaveArgs(draft);
    expect(args['name']).toBe('forest');
    expect(args['appearance']).toBe('dark');
    expect(args['colors']).toEqual(expect.objectContaining({ accent: '#5ad19b', background: '#0b1020' }));
  });

  it('rejects invalid names', () => {
    const draft = emptyDraft();
    draft.name = 'Bad Name';
    expect(() => draftToSaveArgs(draft)).toThrow(/lowercase/);
  });

  it('rejects invalid hex colors', () => {
    const draft = emptyDraft();
    draft.name = 'forest';
    draft.colors.accent = '#GGGGGG';
    expect(() => draftToSaveArgs(draft)).toThrow(/accent/);
  });

  it('validates hex strings', () => {
    expect(isValidHex('#7aa2ff')).toBe(true);
    expect(isValidHex('#GGGGGG')).toBe(false);
    expect(isValidHex('7aa2ff')).toBe(false);
  });
});
