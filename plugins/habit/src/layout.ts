import { addDays, todayKey } from './window.js';

export type HabitDensity = 'compact' | 'normal' | 'wide';

/** Content width heuristics for day labels / streak columns. */
export function resolveDensity(width: number): HabitDensity {
  if (width < 48) return 'compact';
  if (width >= 72) return 'wide';
  return 'normal';
}

const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function localDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function dayHeaderLabel(dateKey: string, density: HabitDensity): string {
  const date = localDate(dateKey);
  const day = date.getDate();
  if (density === 'compact') {
    return WEEKDAYS_SHORT[date.getDay()] ?? String(day);
  }
  if (density === 'wide') {
    return `${WEEKDAYS[date.getDay()]} ${day}`;
  }
  return String(day);
}

export function truncateName(name: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (name.length <= maxChars) return name;
  if (maxChars === 1) return '…';
  return `${name.slice(0, maxChars - 1)}…`;
}

export function nameColumnWidth(width: number, density: HabitDensity): number {
  // 7 day cells (~4 cols each with gap) + optional streak cols + chrome.
  const dayBudget = density === 'compact' ? 7 * 4 : density === 'wide' ? 7 * 7 : 7 * 5;
  const streakBudget = density === 'compact' ? 0 : density === 'wide' ? 14 : 10;
  const remaining = Math.max(6, width - dayBudget - streakBudget - 4);
  return remaining;
}

export { addDays, todayKey };
