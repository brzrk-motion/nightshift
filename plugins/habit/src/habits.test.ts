import { describe, expect, it } from 'vitest';
import { initialState } from './entity.js';
import { addHabit, removeHabit, renameHabit, toggleCompletion } from './habits.js';

const TODAY = '2026-08-11';

describe('addHabit', () => {
  it('appends a habit with a stable id', () => {
    const next = addHabit(initialState(), 'Meditate', {
      id: 'h1',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
    expect(next.habits).toEqual([
      { id: 'h1', name: 'Meditate', createdAt: '2026-08-11T00:00:00.000Z' },
    ]);
    expect(next.completions['h1']).toEqual([]);
  });

  it('rejects empty names', () => {
    expect(addHabit(initialState(), '   ')).toEqual(initialState());
  });

  it('allows duplicate display names', () => {
    let state = addHabit(initialState(), 'Water', {
      id: 'a',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
    state = addHabit(state, 'Water', { id: 'b', createdAt: '2026-08-11T00:00:00.000Z' });
    expect(state.habits).toHaveLength(2);
  });
});

describe('toggleCompletion', () => {
  it('toggles on and off for a known habit', () => {
    let state = addHabit(initialState(), 'Water', {
      id: 'h1',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
    state = toggleCompletion(state, 'h1', TODAY, TODAY);
    expect(state.completions['h1']).toEqual([TODAY]);
    state = toggleCompletion(state, 'h1', TODAY, TODAY);
    expect(state.completions['h1']).toEqual([]);
  });

  it('ignores unknown habits and future dates', () => {
    const state = addHabit(initialState(), 'Water', {
      id: 'h1',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
    expect(toggleCompletion(state, 'missing', TODAY, TODAY)).toEqual(state);
    expect(toggleCompletion(state, 'h1', '2026-08-12', TODAY)).toEqual(state);
  });
});

describe('renameHabit / removeHabit', () => {
  it('renames without touching completions', () => {
    let state = addHabit(initialState(), 'Old', {
      id: 'h1',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
    state = toggleCompletion(state, 'h1', TODAY, TODAY);
    state = renameHabit(state, 'h1', 'New');
    expect(state.habits[0]?.name).toBe('New');
    expect(state.completions['h1']).toEqual([TODAY]);
  });

  it('ignores empty rename', () => {
    const state = addHabit(initialState(), 'Keep', {
      id: 'h1',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
    expect(renameHabit(state, 'h1', '  ')).toEqual(state);
  });

  it('removes the habit and its completions', () => {
    let state = addHabit(initialState(), 'Gone', {
      id: 'h1',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
    state = addHabit(state, 'Stay', { id: 'h2', createdAt: '2026-08-11T00:00:00.000Z' });
    state = toggleCompletion(state, 'h1', TODAY, TODAY);
    state = removeHabit(state, 'h1');
    expect(state.habits.map((h) => h.id)).toEqual(['h2']);
    expect(state.completions['h1']).toBeUndefined();
  });
});
