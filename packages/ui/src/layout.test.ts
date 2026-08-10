import { describe, expect, it } from 'vitest';
import { distribute, isRenderable, planLayout, resolveBreakpoint } from './layout.js';

describe('resolveBreakpoint', () => {
  it.each([
    [40, 'compact'],
    [71, 'compact'],
    [72, 'normal'],
    [131, 'normal'],
    [132, 'wide'],
    [200, 'wide'],
  ])('maps %i columns to %s', (width, expected) => {
    expect(resolveBreakpoint(width)).toBe(expected);
  });
});

describe('isRenderable', () => {
  it('rejects terminals below the usable minimum', () => {
    expect(isRenderable({ width: 80, height: 24 })).toBe(true);
    expect(isRenderable({ width: 39, height: 24 })).toBe(false);
    expect(isRenderable({ width: 80, height: 11 })).toBe(false);
  });
});

describe('distribute', () => {
  it('splits evenly when the weights match', () => {
    expect(distribute(90, [1, 1, 1])).toEqual([30, 30, 30]);
  });

  it('always adds up to the total, whatever the rounding', () => {
    for (const total of [7, 13, 41, 80, 137]) {
      for (const weights of [[1, 1, 1], [2, 1], [3, 5, 7, 11], [1]]) {
        const parts = distribute(total, weights);
        expect(
          parts.reduce((sum, part) => sum + part, 0),
          `${total}/${weights}`,
        ).toBe(total);
      }
    }
  });

  it('follows the weights', () => {
    expect(distribute(100, [3, 1])).toEqual([75, 25]);
  });

  it('honours the minimum for every part', () => {
    const parts = distribute(60, [10, 1], 20);
    expect(Math.min(...parts)).toBeGreaterThanOrEqual(20);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(60);
  });

  it('falls back to an even split when the minimums do not fit', () => {
    const parts = distribute(10, [1, 1, 1], 20);
    expect(parts).toEqual([4, 3, 3]);
  });

  it('treats zero and negative weights as one', () => {
    expect(distribute(60, [0, 0])).toEqual([30, 30]);
  });

  it('returns nothing for no children', () => {
    expect(distribute(80, [])).toEqual([]);
  });
});

const rows = [{ items: [{ span: 2 }, { span: 1 }] }, { height: 2, items: [{}, {}, {}] }];

describe('planLayout', () => {
  it('keeps a row side by side when there is room', () => {
    const plan = planLayout([{ items: [{ span: 2 }, { span: 1 }] }], { width: 90, height: 30 });

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.items.map((item) => item.width)).toEqual([60, 30]);
    expect(plan.rows[0]?.items.map((item) => item.grow)).toEqual([2, 1]);
  });

  it('stacks every widget on its own row on a compact terminal', () => {
    const plan = planLayout(rows, { width: 60, height: 40 });

    expect(plan.breakpoint).toBe('compact');
    expect(plan.rows).toHaveLength(5);
    expect(plan.rows.every((row) => row.items.length === 1)).toBe(true);
  });

  it('splits a row that would squeeze its widgets below a readable width', () => {
    const plan = planLayout([{ items: [{}, {}, {}, {}] }], { width: 80, height: 30 });

    // 80 columns fits three 24-column widgets, so the fourth wraps.
    expect(plan.rows.map((row) => row.items.length)).toEqual([3, 1]);
  });

  it('keeps authored indices when a row is split', () => {
    const plan = planLayout([{ items: [{}, {}, {}, {}] }], { width: 80, height: 30 });

    expect(plan.rows.flatMap((row) => row.items.map((item) => item.index))).toEqual([0, 1, 2, 3]);
    expect(plan.rows.every((row) => row.source === 0)).toBe(true);
  });

  it('fills the terminal height exactly', () => {
    const plan = planLayout(rows, { width: 120, height: 37 });
    const total = plan.rows.reduce((sum, row) => sum + row.height, 0);

    expect(total).toBe(37);
  });

  it('gives a taller row more of the height', () => {
    const plan = planLayout(
      [
        { height: 1, items: [{}] },
        { height: 3, items: [{}] },
      ],
      { width: 120, height: 40 },
    );

    expect(plan.rows[1]?.height).toBeGreaterThan(plan.rows[0]?.height ?? 0);
  });

  it('drops empty rows', () => {
    const plan = planLayout([{ items: [] }, { items: [{}] }], { width: 120, height: 30 });
    expect(plan.rows).toHaveLength(1);
  });

  it('reports a terminal that is too small rather than drawing into it', () => {
    const plan = planLayout(rows, { width: 30, height: 8 });
    expect(plan.renderable).toBe(false);
  });
});
