import { describe, expect, it } from 'vitest';
import {
  activityStrip,
  barChart,
  lineChart,
  normalise,
  resample,
  resolveScale,
  sparkline,
  truncate,
} from './charts.js';

describe('resolveScale', () => {
  it('spans the series', () => {
    expect(resolveScale([2, 8, 5])).toEqual({ min: 2, max: 8 });
  });

  it('widens a flat series instead of dividing by zero', () => {
    expect(resolveScale([5, 5, 5])).toEqual({ min: 4.5, max: 5.5 });
  });

  it('falls back to 0..1 for an empty series', () => {
    expect(resolveScale([])).toEqual({ min: 0, max: 1 });
  });

  it('honours an override, and ignores non-finite values', () => {
    expect(resolveScale([2, Number.NaN, 8], { min: 0 })).toEqual({ min: 0, max: 8 });
  });

  it('swaps a reversed override', () => {
    expect(resolveScale([1, 2], { min: 10, max: 0 })).toEqual({ min: 0, max: 10 });
  });
});

describe('normalise', () => {
  it('maps a value onto 0..1', () => {
    expect(normalise(5, { min: 0, max: 10 })).toBe(0.5);
  });

  it('clamps outside the scale', () => {
    expect(normalise(-5, { min: 0, max: 10 })).toBe(0);
    expect(normalise(50, { min: 0, max: 10 })).toBe(1);
  });

  it('treats a non-finite value as the bottom', () => {
    expect(normalise(Number.NaN, { min: 0, max: 10 })).toBe(0);
  });
});

describe('resample', () => {
  it('leaves a short series alone', () => {
    expect(resample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('averages a long series down to the requested width', () => {
    expect(resample([0, 2, 4, 6], 2)).toEqual([1, 5]);
  });

  it('always produces exactly the requested width', () => {
    expect(
      resample(
        Array.from({ length: 997 }, (_, index) => index),
        37,
      ),
    ).toHaveLength(37);
  });

  it('returns nothing for an empty series or no width', () => {
    expect(resample([], 10)).toEqual([]);
    expect(resample([1, 2], 0)).toEqual([]);
  });
});

describe('sparkline', () => {
  it('draws low values low and high values high', () => {
    expect(sparkline([0, 1, 2, 3, 4, 5, 6, 7])).toBe('▁▂▃▄▅▆▇█');
  });

  it('centres a flat series', () => {
    expect(sparkline([3, 3, 3])).toBe('▅▅▅');
  });

  it('fits a long series into the width it is given', () => {
    expect(sparkline([1, 2, 3, 4, 5, 6, 7, 8], { width: 4 })).toHaveLength(4);
  });

  it('draws nothing for an empty series', () => {
    expect(sparkline([])).toBe('');
  });

  it('respects an explicit scale', () => {
    expect(sparkline([5], { min: 0, max: 5 })).toBe('█');
    expect(sparkline([5], { min: 0, max: 100 })).toBe('▁');
  });
});

describe('barChart', () => {
  const data = [
    { label: 'mon', value: 4 },
    { label: 'tue', value: 8 },
  ];

  it('scales bars against zero, not against the smallest value', () => {
    const rows = barChart(data, { width: 30, labelWidth: 3 });
    expect(rows[0]?.bar.trimEnd().length).toBeCloseTo(rows[1]!.bar.trimEnd().length / 2, 0);
  });

  it('pads labels and bars to a fixed width so the rows line up', () => {
    const rows = barChart(
      [
        { label: 'a', value: 1 },
        { label: 'bbb', value: 2 },
      ],
      {
        width: 20,
        labelWidth: 4,
      },
    );
    expect(rows.every((row) => row.label.length === 4)).toBe(true);
    expect(new Set(rows.map((row) => row.bar.length)).size).toBe(1);
  });

  it('truncates a label that does not fit', () => {
    const [row] = barChart([{ label: 'a very long label', value: 1 }], {
      width: 24,
      labelWidth: 6,
    });
    expect(row?.label).toBe('a ver…');
  });

  it('appends formatted values when asked', () => {
    const rows = barChart(data, { width: 30, showValues: true });
    expect(rows.map((row) => row.text.trim())).toEqual(['4', '8']);
  });

  it('shortens large values', () => {
    const [row] = barChart([{ label: 'x', value: 2500 }], { width: 30, showValues: true });
    expect(row?.text.trim()).toBe('2.5k');
  });

  it('never overflows the width it is given', () => {
    for (const width of [12, 20, 44]) {
      const rows = barChart(data, { width, showValues: true });
      for (const row of rows) {
        expect(row.label.length + row.bar.length + row.text.length + 1).toBeLessThanOrEqual(width);
      }
    }
  });

  it('draws nothing for no data', () => {
    expect(barChart([], { width: 20 })).toEqual([]);
  });
});

describe('lineChart', () => {
  it('returns one string per row, each the requested width', () => {
    const rows = lineChart([1, 4, 2, 8, 3], { width: 20, height: 4 });
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => [...row].length === 20)).toBe(true);
  });

  it('draws a rising series from the bottom left to the top right', () => {
    const rows = lineChart(
      Array.from({ length: 40 }, (_, index) => index),
      {
        width: 20,
        height: 4,
      },
    );
    const firstDrawn = (row: string): number => [...row].findIndex((cell) => cell !== ' ');
    const lastDrawn = (row: string): number =>
      [...row].reduce((last, cell, index) => (cell === ' ' ? last : index), -1);

    // The bottom row holds the start of the series, the top row its end.
    expect(firstDrawn(rows[3]!)).toBe(0);
    expect(lastDrawn(rows[3]!)).toBeLessThan(10);
    expect(firstDrawn(rows[0]!)).toBeGreaterThan(10);
    expect(lastDrawn(rows[0]!)).toBe(19);
  });

  it('uses braille characters', () => {
    const rows = lineChart([1, 2, 3], { width: 6, height: 2 });
    const drawn = rows.join('').replaceAll(' ', '');
    expect(drawn.length).toBeGreaterThan(0);
    for (const character of drawn) {
      expect(character.codePointAt(0)).toBeGreaterThanOrEqual(0x2800);
      expect(character.codePointAt(0)).toBeLessThanOrEqual(0x28ff);
    }
  });

  it('returns blank rows for an empty series', () => {
    expect(lineChart([], { width: 5, height: 2 })).toEqual(['     ', '     ']);
  });

  it('draws nothing when there is no room', () => {
    expect(lineChart([1, 2], { width: 0, height: 4 })).toEqual([]);
  });
});

describe('truncate', () => {
  it.each([
    ['nightshift', 10, 'nightshift'],
    ['nightshift', 6, 'night…'],
    ['nightshift', 1, '…'],
    ['nightshift', 0, ''],
    ['Deep Work Sessions', 8, 'Deep Wo…'],
    ['Drink more water please', 10, 'Drink mor…'],
    // Code-point aware: one emoji is one unit, not two UTF-16 code units.
    ['hi😀bye', 5, 'hi😀b…'],
  ])('truncates %s to %i', (text, width, expected) => {
    expect(truncate(text, width)).toBe(expected);
  });
});

describe('activityStrip', () => {
  it('renders a quiet baseline for an all-zero series', () => {
    expect(activityStrip([0, 0, 0])).toBe('···');
  });

  it('renders a quiet baseline when every value is empty', () => {
    expect(activityStrip([])).toBe('');
  });

  it('scales against the loudest value in the series', () => {
    const strip = [...activityStrip([0, 5, 10])];
    expect(strip[0]).toBe('·');
    expect(strip[2]).toBe('█');
    // The midpoint is louder than silence and quieter than the peak.
    expect(strip[1]).not.toBe('·');
    expect(strip[1]).not.toBe('█');
  });

  it('treats a negative or non-finite value as silence', () => {
    const strip = [...activityStrip([-3, Number.NaN, 4])];
    expect(strip[0]).toBe('·');
    expect(strip[1]).toBe('·');
  });

  it('resamples down to the requested width', () => {
    expect(activityStrip([1, 2, 3, 4, 5, 6], 3)).toHaveLength(3);
  });
});
