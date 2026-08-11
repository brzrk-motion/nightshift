import { initialState, type Habit, type HabitState } from './entity.js';
import { isDateKey } from './window.js';
import type { Json } from '@nightshift/sdk';

export const STORAGE_KEY = 'state' as const;
export const STORAGE_VERSION = 1 as const;

export interface StoredHabitState {
  version: typeof STORAGE_VERSION;
  habits: Habit[];
  completions: Record<string, string[]>;
  [key: string]: Json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseHabit(value: unknown): Habit | undefined {
  if (!isRecord(value)) return undefined;
  const id = value['id'];
  const name = value['name'];
  const createdAt = value['createdAt'];
  if (typeof id !== 'string' || id === '') return undefined;
  if (typeof name !== 'string' || name.trim() === '') return undefined;
  if (typeof createdAt !== 'string' || createdAt === '') return undefined;
  return { id, name: name.trim(), createdAt };
}

function parseCompletions(
  value: unknown,
  habitIds: ReadonlySet<string>,
): Record<string, string[]> {
  if (!isRecord(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [habitId, dates] of Object.entries(value)) {
    if (!habitIds.has(habitId) || !Array.isArray(dates)) continue;
    const cleaned = [
      ...new Set(
        dates.filter((date): date is string => typeof date === 'string' && isDateKey(date)),
      ),
    ].sort();
    out[habitId] = cleaned;
  }
  return out;
}

/**
 * Defensive parse of storage v1. Unknown version, corrupt shapes, or partial
 * data become a safe empty / partial HabitState — never throw.
 */
export function parseStored(value: unknown): HabitState {
  if (!isRecord(value)) return initialState();
  if (value['version'] !== STORAGE_VERSION) return initialState();

  const habitsRaw = value['habits'];
  const habits: Habit[] = [];
  const seen = new Set<string>();
  if (Array.isArray(habitsRaw)) {
    for (const entry of habitsRaw) {
      const habit = parseHabit(entry);
      if (!habit || seen.has(habit.id)) continue;
      seen.add(habit.id);
      habits.push(habit);
    }
  }

  const completions = parseCompletions(value['completions'], seen);
  return initialState(habits, completions);
}

export function serializeState(state: HabitState): StoredHabitState {
  const habitIds = new Set(state.habits.map((habit) => habit.id));
  const completions: Record<string, string[]> = {};
  for (const [habitId, dates] of Object.entries(state.completions)) {
    if (!habitIds.has(habitId)) continue;
    completions[habitId] = [...new Set(dates.filter(isDateKey))].sort();
  }
  return {
    version: STORAGE_VERSION,
    habits: state.habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      createdAt: habit.createdAt,
    })),
    completions,
  };
}
