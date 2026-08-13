import { describe, expect, it } from 'vitest';
import { chunkIntoRows, metricRows, resolveGridColumns } from './layout.js';

describe('resolveGridColumns', () => {
  it('uses one column for a single metric', () => {
    expect(resolveGridColumns(80, 1)).toBe(1);
  });

  it('uses two columns when the widget is wide enough', () => {
    expect(resolveGridColumns(60, 4)).toBe(2);
  });

  it('stacks metrics in one column on narrow widgets', () => {
    expect(resolveGridColumns(40, 4)).toBe(1);
  });
});

describe('chunkIntoRows', () => {
  it('splits four items into two rows of two', () => {
    expect(chunkIntoRows(['cpu', 'ram', 'network', 'gpu'], 2)).toEqual([
      ['cpu', 'ram'],
      ['network', 'gpu'],
    ]);
  });

  it('leaves a trailing row with one item', () => {
    expect(chunkIntoRows(['cpu', 'ram', 'network'], 2)).toEqual([['cpu', 'ram'], ['network']]);
  });
});

describe('metricRows', () => {
  it('builds a 2x2 grid for four metrics on a wide widget', () => {
    expect(metricRows(['cpu', 'ram', 'network', 'gpu'], 64)).toEqual([
      ['cpu', 'ram'],
      ['network', 'gpu'],
    ]);
  });
});
