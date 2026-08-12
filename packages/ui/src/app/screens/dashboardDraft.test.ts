import { describe, expect, it } from 'vitest';
import {
  draftFromCatalog,
  draftToSaveArgs,
  duplicateDraft,
  emptyDraft,
  mapCatalogActive,
  type DashboardCatalogRow,
} from './dashboardDraft.js';

const SAMPLE_ROW: DashboardCatalogRow = {
  name: 'work',
  title: 'Work',
  source: 'user',
  active: false,
  theme: 'midnight',
  refresh: 30,
  rows: [{ widgets: [{ type: 'core.note', options: { text: 'hi' } }] }],
};

describe('dashboardDraft', () => {
  it('starts empty', () => {
    expect(emptyDraft()).toEqual({ name: '', title: '', theme: '', refresh: '' });
  });

  it('loads a catalog row into a draft', () => {
    expect(draftFromCatalog(SAMPLE_ROW)).toEqual({
      name: 'work',
      title: 'Work',
      theme: 'midnight',
      refresh: '30',
      rows: SAMPLE_ROW.rows,
    });
  });

  it('clears name on duplicate', () => {
    expect(duplicateDraft(SAMPLE_ROW).name).toBe('');
    expect(duplicateDraft(SAMPLE_ROW).rows).toEqual(SAMPLE_ROW.rows);
  });

  it('maps active marker from session dashboard name', () => {
    const rows: DashboardCatalogRow[] = [
      { name: 'home', title: 'Home', source: 'built-in', active: false },
      { name: 'work', title: 'Work', source: 'user', active: false },
    ];
    const mapped = mapCatalogActive(rows, 'work');
    expect(mapped.find((row) => row.name === 'work')?.active).toBe(true);
    expect(mapped.find((row) => row.name === 'home')?.active).toBe(false);
  });

  it('builds save args and preserves rows on metadata edit', () => {
    const draft = draftFromCatalog(SAMPLE_ROW);
    draft.title = 'Deep Work';
    draft.refresh = '60';
    expect(draftToSaveArgs(draft)).toEqual({
      name: 'work',
      title: 'Deep Work',
      theme: 'midnight',
      refresh: 60,
      rows: SAMPLE_ROW.rows,
    });
  });

  it('rejects invalid names', () => {
    expect(() => draftToSaveArgs({ ...emptyDraft(), name: 'Bad Name' })).toThrow(/Name must be/);
  });

  it('rejects invalid refresh', () => {
    expect(() =>
      draftToSaveArgs({ ...emptyDraft(), name: 'work', refresh: 'fast' }),
    ).toThrow(/Refresh must be/);
  });
});
