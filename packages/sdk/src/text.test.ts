import { describe, expect, it } from 'vitest';
import { clipText } from './text.js';

describe('clipText', () => {
  it('leaves short text alone', () => {
    expect(clipText('Focus', 10)).toBe('Focus');
    expect(clipText('Water', 10)).toBe('Water');
  });

  it('ellipsises text that does not fit', () => {
    expect(clipText('Deep Work Sessions', 8)).toBe('Deep Wo…');
    expect(clipText('Drink more water please', 10)).toBe('Drink mor…');
    expect(clipText('anything', 1)).toBe('…');
    expect(clipText('anything', 0)).toBe('');
  });
});
