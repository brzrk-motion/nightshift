import { describe, expect, it } from 'vitest';
import { BORDERS, SPACING } from './tokens.js';

describe('SPACING', () => {
  it('is a non-decreasing scale from none to wide', () => {
    const values = Object.values(SPACING);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeGreaterThanOrEqual(values[index - 1] ?? 0);
    }
  });
});

describe('BORDERS', () => {
  it('names a style OpenTUI recognises for every token', () => {
    for (const style of Object.values(BORDERS)) {
      expect(['single', 'double', 'rounded', 'heavy']).toContain(style);
    }
  });
});
