import { describe, expect, it } from 'vitest';
import {
  addWidget,
  clampAddress,
  cloneDashboard,
  flattenAddresses,
  moveHorizontal,
  moveVertical,
  nextAddress,
  removeWidget,
  resizeRowHeight,
  resizeSpan,
  swapWidget,
  specForPickedWidget,
} from './edit.js';
import type { DashboardSpec } from './schema.js';

function widget(type: string): { type: string } {
  return { type };
}

const two: DashboardSpec = {
  name: 'two',
  rows: [{ widgets: [widget('a'), widget('b')] }, { height: 2, widgets: [widget('c')] }],
};

describe('flattenAddresses', () => {
  it('lists every widget in reading order', () => {
    expect(flattenAddresses(two)).toEqual([
      { row: 0, widget: 0 },
      { row: 0, widget: 1 },
      { row: 1, widget: 0 },
    ]);
  });

  it('is empty for a dashboard with no widgets', () => {
    expect(flattenAddresses({ name: 'empty', rows: [] })).toEqual([]);
  });
});

describe('clampAddress', () => {
  it('keeps a still-valid address', () => {
    expect(clampAddress(two, { row: 1, widget: 0 })).toEqual({ row: 1, widget: 0 });
  });

  it('falls back to the first widget once the address no longer exists', () => {
    expect(clampAddress(two, { row: 5, widget: 0 })).toEqual({ row: 0, widget: 0 });
  });

  it('falls back to the first widget for a null address', () => {
    expect(clampAddress(two, null)).toEqual({ row: 0, widget: 0 });
  });

  it('is null for an empty dashboard', () => {
    expect(clampAddress({ name: 'empty', rows: [] }, { row: 0, widget: 0 })).toBeNull();
  });
});

describe('nextAddress', () => {
  it('starts at the first widget from null', () => {
    expect(nextAddress(two, null, 1)).toEqual({ row: 0, widget: 0 });
  });

  it('steps forward in reading order and wraps', () => {
    expect(nextAddress(two, { row: 0, widget: 0 }, 1)).toEqual({ row: 0, widget: 1 });
    expect(nextAddress(two, { row: 0, widget: 1 }, 1)).toEqual({ row: 1, widget: 0 });
    expect(nextAddress(two, { row: 1, widget: 0 }, 1)).toEqual({ row: 0, widget: 0 });
  });

  it('steps backward and wraps the other way', () => {
    expect(nextAddress(two, { row: 0, widget: 0 }, -1)).toEqual({ row: 1, widget: 0 });
  });

  it('is null for an empty dashboard', () => {
    expect(nextAddress({ name: 'empty', rows: [] }, null, 1)).toBeNull();
  });
});

describe('cloneDashboard', () => {
  it('produces an equal but distinct copy', () => {
    const clone = cloneDashboard(two);
    expect(clone).toEqual(two);
    expect(clone).not.toBe(two);
    expect(clone.rows).not.toBe(two.rows);
    expect(clone.rows[0]).not.toBe(two.rows[0]);
  });

  it('editing the clone never touches the original', () => {
    const clone = cloneDashboard(two);
    clone.rows[0]!.widgets[0]!.type = 'changed';
    expect(two.rows[0]?.widgets[0]?.type).toBe('a');
  });
});

describe('moveHorizontal', () => {
  it('swaps with the right neighbour', () => {
    const result = moveHorizontal(two, { row: 0, widget: 0 }, 1);
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['b', 'a']);
    expect(result.selected).toEqual({ row: 0, widget: 1 });
  });

  it('swaps with the left neighbour', () => {
    const result = moveHorizontal(two, { row: 0, widget: 1 }, -1);
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['b', 'a']);
    expect(result.selected).toEqual({ row: 0, widget: 0 });
  });

  it('does nothing at the right edge', () => {
    const result = moveHorizontal(two, { row: 0, widget: 1 }, 1);
    expect(result.dashboard).toEqual(two);
    expect(result.selected).toEqual({ row: 0, widget: 1 });
  });

  it('does nothing at the left edge', () => {
    const result = moveHorizontal(two, { row: 0, widget: 0 }, -1);
    expect(result.dashboard).toEqual(two);
  });

  it('does not mutate the original', () => {
    moveHorizontal(two, { row: 0, widget: 0 }, 1);
    expect(two.rows[0]?.widgets.map((w) => w.type)).toEqual(['a', 'b']);
  });
});

describe('moveVertical', () => {
  it('moves to the end of the row below', () => {
    const result = moveVertical(two, { row: 0, widget: 0 }, 1);
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['b']);
    expect(result.dashboard.rows[1]?.widgets.map((w) => w.type)).toEqual(['c', 'a']);
    expect(result.selected).toEqual({ row: 1, widget: 1 });
  });

  it('drops the source row once it empties, shifting the target index', () => {
    const single: DashboardSpec = {
      name: 'x',
      rows: [{ widgets: [widget('a')] }, { widgets: [widget('b')] }],
    };
    const result = moveVertical(single, { row: 0, widget: 0 }, 1);
    expect(result.dashboard.rows).toHaveLength(1);
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['b', 'a']);
    expect(result.selected).toEqual({ row: 0, widget: 1 });
  });

  it('creates a new row above when moving up past the first row', () => {
    const result = moveVertical(two, { row: 0, widget: 0 }, -1);
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['a']);
    expect(result.dashboard.rows[1]?.widgets.map((w) => w.type)).toEqual(['b']);
    expect(result.selected).toEqual({ row: 0, widget: 0 });
  });

  it('creates a new row below when moving down past the last row', () => {
    // Row 1 holds only "c", so moving it down empties row 1 — which is
    // dropped, the same as any other source row that empties — leaving the
    // widget in a fresh row appended after what is left.
    const result = moveVertical(two, { row: 1, widget: 0 }, 1);
    expect(result.dashboard.rows).toHaveLength(2);
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['a', 'b']);
    expect(result.dashboard.rows[1]?.widgets.map((w) => w.type)).toEqual(['c']);
    expect(result.selected).toEqual({ row: 1, widget: 0 });
  });

  it('leaves the rest of the source row in place when moving past the end', () => {
    const spec: DashboardSpec = {
      name: 'x',
      rows: [{ widgets: [widget('a')] }, { widgets: [widget('b'), widget('c')] }],
    };

    const result = moveVertical(spec, { row: 1, widget: 0 }, 1);

    expect(result.dashboard.rows).toHaveLength(3);
    expect(result.dashboard.rows[1]?.widgets.map((w) => w.type)).toEqual(['c']);
    expect(result.dashboard.rows[2]?.widgets.map((w) => w.type)).toEqual(['b']);
    expect(result.selected).toEqual({ row: 2, widget: 0 });
  });

  it('does not mutate the original', () => {
    moveVertical(two, { row: 0, widget: 0 }, 1);
    expect(two.rows[0]?.widgets.map((w) => w.type)).toEqual(['a', 'b']);
    expect(two.rows[1]?.widgets.map((w) => w.type)).toEqual(['c']);
  });
});

describe('resizeSpan', () => {
  it('grows the span', () => {
    const result = resizeSpan(two, { row: 0, widget: 0 }, 1);
    expect(result.rows[0]?.widgets[0]?.span).toBe(2);
  });

  it('floors at 1', () => {
    const result = resizeSpan(two, { row: 0, widget: 0 }, -5);
    expect(result.rows[0]?.widgets[0]?.span).toBe(1);
  });

  it('does not mutate the original', () => {
    resizeSpan(two, { row: 0, widget: 0 }, 1);
    expect(two.rows[0]?.widgets[0]?.span).toBeUndefined();
  });
});

describe('resizeRowHeight', () => {
  it('grows the height', () => {
    expect(resizeRowHeight(two, 1, 1).rows[1]?.height).toBe(3);
  });

  it('floors at 1', () => {
    expect(resizeRowHeight(two, 0, -5).rows[0]?.height).toBe(1);
  });
});

describe('removeWidget', () => {
  it('removes the widget, keeping the row', () => {
    const result = removeWidget(two, { row: 0, widget: 0 });
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['b']);
    expect(result.selected).toEqual({ row: 0, widget: 0 });
  });

  it('drops the row once the last widget in it is removed', () => {
    const result = removeWidget(two, { row: 1, widget: 0 });
    expect(result.dashboard.rows).toHaveLength(1);
    expect(result.selected).toEqual({ row: 0, widget: 0 });
  });

  it('is null when the whole dashboard empties', () => {
    const one: DashboardSpec = { name: 'x', rows: [{ widgets: [widget('a')] }] };
    const result = removeWidget(one, { row: 0, widget: 0 });
    expect(result.dashboard.rows).toEqual([]);
    expect(result.selected).toBeNull();
  });
});

describe('addWidget', () => {
  it('appends to the selected row', () => {
    const result = addWidget(two, { row: 0, widget: 0 }, widget('new'));
    expect(result.dashboard.rows[0]?.widgets.map((w) => w.type)).toEqual(['a', 'b', 'new']);
    expect(result.selected).toEqual({ row: 0, widget: 2 });
  });

  it('creates a new row with no selection', () => {
    const result = addWidget(two, null, widget('new'));
    expect(result.dashboard.rows).toHaveLength(3);
    expect(result.dashboard.rows[2]?.widgets.map((w) => w.type)).toEqual(['new']);
    expect(result.selected).toEqual({ row: 2, widget: 0 });
  });

  it('creates a new row for an empty dashboard', () => {
    const result = addWidget({ name: 'empty', rows: [] }, null, widget('new'));
    expect(result.dashboard.rows).toEqual([{ widgets: [{ type: 'new' }] }]);
    expect(result.selected).toEqual({ row: 0, widget: 0 });
  });
});

describe('swapWidget', () => {
  it('replaces the widget type in place, keeping its span', () => {
    const spanned: DashboardSpec = {
      name: 'spanned',
      rows: [{ widgets: [{ type: 'a', span: 2, title: 'Old', options: { x: 1 } }] }],
    };
    const result = swapWidget(spanned, { row: 0, widget: 0 }, widget('new'));
    expect(result.rows[0]?.widgets[0]).toEqual({ type: 'new', span: 2 });
  });

  it('drops the old widget’s title, options and other per-widget fields', () => {
    const result = swapWidget(two, { row: 0, widget: 1 }, { type: 'new', title: 'Fresh' });
    expect(result.rows[0]?.widgets[1]).toEqual({ type: 'new', title: 'Fresh' });
  });

  it('does nothing for an address with no widget', () => {
    expect(swapWidget(two, { row: 5, widget: 0 }, widget('new'))).toBe(two);
  });

  it('does not mutate the original', () => {
    swapWidget(two, { row: 0, widget: 0 }, widget('new'));
    expect(two.rows[0]?.widgets[0]?.type).toBe('a');
  });
});

describe('specForPickedWidget', () => {
  it('assigns a unique location slot to weather widgets', () => {
    expect(specForPickedWidget('weather.now', 1_700_000_000_000)).toEqual({
      type: 'weather.now',
      options: { location: 'loc-loyw3v28' },
    });
    expect(specForPickedWidget('weather.forecast', 1_700_000_000_001)).toEqual({
      type: 'weather.forecast',
      options: { location: 'loc-loyw3v29' },
    });
  });

  it('opens a newly added clock widget straight into its settings panel', () => {
    expect(specForPickedWidget('clock.now')).toEqual({
      type: 'clock.now',
      options: { startInSettings: true },
    });
  });

  it('leaves other widgets as a bare type', () => {
    expect(specForPickedWidget('pomodoro.session')).toEqual({ type: 'pomodoro.session' });
  });
});
