import { describe, expect, it } from 'vitest';
import { initialState } from './entity.js';
import { parseStored, serializeState, STORAGE_VERSION } from './storage.js';

describe('parseStored', () => {
  it('returns empty state for undefined / null / non-objects', () => {
    expect(parseStored(undefined)).toEqual(initialState());
    expect(parseStored(null)).toEqual(initialState());
    expect(parseStored('oops')).toEqual(initialState());
  });

  it('returns empty state for unknown version', () => {
    expect(parseStored({ version: 99, habits: [], completions: {} })).toEqual(initialState());
  });

  it('keeps valid habits and drops malformed ones', () => {
    const state = parseStored({
      version: STORAGE_VERSION,
      habits: [
        { id: 'a', name: 'Meditate', createdAt: '2026-08-11T00:00:00.000Z' },
        { id: 'b', name: '   ', createdAt: '2026-08-11T00:00:00.000Z' },
        { name: 'no-id', createdAt: '2026-08-11T00:00:00.000Z' },
        { id: 'a', name: 'duplicate', createdAt: '2026-08-12T00:00:00.000Z' },
      ],
      completions: {
        a: ['2026-08-10', 'not-a-date', '2026-08-10', '2026-02-30'],
        missing: ['2026-08-11'],
      },
    });

    expect(state.habits).toEqual([
      { id: 'a', name: 'Meditate', createdAt: '2026-08-11T00:00:00.000Z' },
    ]);
    expect(state.completions).toEqual({ a: ['2026-08-10'] });
  });

  it('coerces missing arrays to empty', () => {
    expect(parseStored({ version: STORAGE_VERSION })).toEqual(initialState());
  });
});

describe('serializeState', () => {
  it('round-trips a clean state', () => {
    const state = initialState(
      [{ id: 'a', name: 'Water', createdAt: '2026-08-11T12:00:00.000Z' }],
      { a: ['2026-08-09', '2026-08-11'] },
    );
    expect(parseStored(serializeState(state))).toEqual(state);
  });
});
