import type { Json } from '@nightshift/sdk';

/**
 * Split out from `index.ts` so widgets can reference the entity id and state
 * shape without importing the plugin's own `setup()`.
 */
export const HABIT_ENTITY = 'habit.tracker' as const;

export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  [key: string]: Json;
}

export interface HabitState {
  habits: Habit[];
  /** habitId → sorted unique YYYY-MM-DD completion dates */
  completions: Record<string, string[]>;
  [key: string]: Habit[] | Record<string, string[]>;
}

export function initialState(
  habits: Habit[] = [],
  completions: Record<string, string[]> = {},
): HabitState {
  return { habits, completions };
}
