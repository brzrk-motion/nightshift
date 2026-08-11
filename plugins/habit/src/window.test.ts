import { describe, expect, it } from 'vitest';
import { addDays, isDateKey, rollingWindow, todayKey } from './window.js';

describe('todayKey', () => {
  it('formats local calendar dates as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 2, 5))).toBe('2026-03-05');
    expect(todayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('addDays', () => {
  it('shifts across month boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('rollingWindow', () => {
  it('returns seven dates ending on the injected today', () => {
    const window = rollingWindow('2026-08-11');
    expect(window).toHaveLength(7);
    expect(window[0]).toBe('2026-08-05');
    expect(window[6]).toBe('2026-08-11');
  });

  it('never includes a day after today', () => {
    const today = '2026-08-11';
    for (const date of rollingWindow(today)) {
      expect(date <= today).toBe(true);
    }
  });
});

describe('isDateKey', () => {
  it('accepts valid calendar keys and rejects garbage', () => {
    expect(isDateKey('2026-08-11')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('not-a-date')).toBe(false);
  });
});
