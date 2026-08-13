/** Local-calendar date key, matching focus/pomodoro. */
export function todayKey(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return todayKey(date) === value;
}

/** Shift a YYYY-MM-DD key by `days` in local calendar time. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

/** Rolling window `[today-6 … today]` inclusive (7 local dates). */
export function rollingWindow(today: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
}
