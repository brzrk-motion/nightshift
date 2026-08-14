import { describe, expect, it } from 'vitest';
import { todayKey } from './dates.js';

describe('todayKey', () => {
  it('formats as YYYY-MM-DD in local time', () => {
    expect(todayKey(new Date(2026, 2, 5))).toBe('2026-03-05');
    expect(todayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});
