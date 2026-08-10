import { describe, expect, it } from 'vitest';
import { BUILT_IN_VIBES, findVibe } from './schema.js';

describe('BUILT_IN_VIBES', () => {
  it('ships the three vibes named in the roadmap', () => {
    expect(BUILT_IN_VIBES.map((vibe) => vibe.name)).toEqual([
      'locked-in',
      'morning',
      'night-shift',
    ]);
  });

  it('every built-in vibe names a dashboard', () => {
    for (const vibe of BUILT_IN_VIBES) {
      expect(vibe.dashboard, vibe.name).toBeDefined();
    }
  });
});

describe('findVibe', () => {
  it('finds a built-in vibe by name', () => {
    expect(findVibe('morning')?.title).toBe('Morning');
  });

  it('returns undefined for an unknown name', () => {
    expect(findVibe('nope')).toBeUndefined();
  });
});
