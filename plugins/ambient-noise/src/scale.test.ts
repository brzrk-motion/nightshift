import { describe, expect, it } from 'vitest';
import { resolveLayout, useCompactSkipGlyphs } from './scale.js';

describe('resolveLayout', () => {
  it('uses compact when width or height is tight', () => {
    expect(resolveLayout(20, 20)).toBe('compact');
    expect(resolveLayout(80, 6)).toBe('compact');
  });

  it('uses regular in the middle band', () => {
    expect(resolveLayout(40, 9)).toBe('regular');
  });

  it('uses wide when both dimensions allow it', () => {
    expect(resolveLayout(60, 12)).toBe('wide');
  });
});

describe('useCompactSkipGlyphs', () => {
  it('is true only for a tight regular layout', () => {
    expect(useCompactSkipGlyphs(40, 'regular')).toBe(true);
    expect(useCompactSkipGlyphs(50, 'regular')).toBe(false);
    expect(useCompactSkipGlyphs(40, 'wide')).toBe(false);
  });
});
