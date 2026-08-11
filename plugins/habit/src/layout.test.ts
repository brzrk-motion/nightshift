import { describe, expect, it } from 'vitest';
import { dayHeaderLabel, resolveDensity, truncateName } from './layout.js';

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
