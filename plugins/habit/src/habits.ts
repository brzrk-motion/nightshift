import { randomUUID } from 'node:crypto';
import type { HabitState } from './entity.js';
import { compareDateKeys, isDateKey } from './window.js';

function sortDates(dates: readonly string[]): string[] {
  return [...dates].sort(compareDateKeys);
}

/** Append a habit; empty/whitespace names are rejected (state unchanged). */
export function addHabit(
  state: HabitState,
  name: string,
  options: { id?: string; createdAt?: string } = {},
): HabitState {
  const trimmed = name.trim();
  if (trimmed === '') return state;

  const id = options.id ?? randomUUID();
  if (state.habits.some((habit) => habit.id === id)) return state;

  return {
    ...state,
    habits: [
      ...state.habits,
      {
        id,
        name: trimmed,
        createdAt: options.createdAt ?? new Date().toISOString(),
      },
    ],
    completions: { ...state.completions, [id]: state.completions[id] ?? [] },
  };
}

/**
 * Toggle completion for `(habitId, date)`. Unknown habit, bad date, or a
 * future date relative to `today` is a no-op.
 */
export function toggleCompletion(
  state: HabitState,
  habitId: string,
  date: string,
  today: string,
): HabitState {
  if (!state.habits.some((habit) => habit.id === habitId)) return state;
  if (!isDateKey(date) || !isDateKey(today) || date > today) return state;

  const existing = state.completions[habitId] ?? [];
  const has = existing.includes(date);
  const nextDates = has
    ? existing.filter((entry) => entry !== date)
    : sortDates([...existing, date]);

  return {
    ...state,
    completions: { ...state.completions, [habitId]: nextDates },
  };
}

/** Rename; empty name is a no-op. Completions are unchanged. */
export function renameHabit(state: HabitState, habitId: string, name: string): HabitState {
  const trimmed = name.trim();
  if (trimmed === '') return state;
  if (!state.habits.some((habit) => habit.id === habitId)) return state;

  return {
    ...state,
    habits: state.habits.map((habit) =>
      habit.id === habitId ? { ...habit, name: trimmed } : habit,
    ),
  };
}

/** Hard-delete habit and its completions. */
export function removeHabit(state: HabitState, habitId: string): HabitState {
  if (!state.habits.some((habit) => habit.id === habitId)) return state;
  const { [habitId]: _removed, ...completions } = state.completions;
  return {
    ...state,
    habits: state.habits.filter((habit) => habit.id !== habitId),
    completions,
  };
}

export function isCompleted(state: HabitState, habitId: string, date: string): boolean {
  return (state.completions[habitId] ?? []).includes(date);
}
