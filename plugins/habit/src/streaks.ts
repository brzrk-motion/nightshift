import { addDays } from './window.js';

/**
 * Current streak (FR-006): walk backward from today if complete, else from
 * yesterday if that is complete, else 0.
 */
export function currentStreak(dates: readonly string[], today: string): number {
  const set = new Set(dates);
  let cursor = today;
  if (!set.has(today)) {
    const yesterday = addDays(today, -1);
    if (!set.has(yesterday)) return 0;
    cursor = yesterday;
  }

  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Longest consecutive run in retained history (FR-007). */
export function longestStreak(dates: readonly string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let longest = 1;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1]!;
    const curr = sorted[index]!;
    if (addDays(prev, 1) === curr) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

/** Display helper: longest is never less than current. */
export function streakSummary(
  dates: readonly string[],
  today: string,
): { current: number; longest: number } {
  const current = currentStreak(dates, today);
  const longest = Math.max(longestStreak(dates), current);
  return { current, longest };
}
