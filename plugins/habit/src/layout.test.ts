import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayHeaderLabel,
  isDateKey,
  resolveDensity,
  rollingWindow,
  truncateName,
} from './layout.js';

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

describe('resolveDensity', () => {
  it('picks compact / normal / wide from width', () => {
    expect(resolveDensity(40)).toBe('compact');
    expect(resolveDensity(55)).toBe('normal');
    expect(resolveDensity(80)).toBe('wide');
  });
});

describe('dayHeaderLabel', () => {
  it('uses short weekday letters when compact', () => {
    // 2026-08-11 is a Tuesday
    expect(dayHeaderLabel('2026-08-11', 'compact')).toBe('T');
  });

  it('uses day-of-month when normal', () => {
    expect(dayHeaderLabel('2026-08-11', 'normal')).toBe('11');
  });

  it('uses weekday + date when wide', () => {
    expect(dayHeaderLabel('2026-08-11', 'wide')).toBe('Tue 11');
  });
});

describe('truncateName', () => {
  it('leaves short names alone and ellipsizes long ones', () => {
    expect(truncateName('Water', 10)).toBe('Water');
    expect(truncateName('Drink more water please', 10)).toBe('Drink mor…');
  });
});
