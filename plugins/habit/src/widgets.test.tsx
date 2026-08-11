import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import {
  createAppRuntime,
  detectRuntime,
  MIDNIGHT_THEME,
  RuntimeProvider,
  ThemeProvider,
} from '@nightshift/ui';
import { HABIT_ENTITY, initialState, type HabitState } from './entity.js';
import { dayHeaderLabel, resolveDensity } from './layout.js';
import { addDays, todayKey } from './window.js';
import { HabitTrackerWidget } from './widgets.js';

const renderable = detectRuntime().ffi;

async function renderWidget(
  state: HabitState,
  size: { width: number; height: number },
): Promise<{
  setup: Awaited<ReturnType<typeof testRender>>;
}> {
  const entities = createEntityStore();
  entities.register(HABIT_ENTITY, state);
  const runtime = createAppRuntime({ entities });

  const setup = await testRender(
    <ThemeProvider theme={MIDNIGHT_THEME}>
      <RuntimeProvider runtime={runtime}>
        <HabitTrackerWidget options={{}} width={size.width} height={size.height} />
      </RuntimeProvider>
    </ThemeProvider>,
    { width: Math.max(size.width + 4, 40), height: Math.max(size.height + 4, 12) },
  );

  return { setup };
}

describe('layout density helpers', () => {
  it('uses short headers in compact width and richer labels when wide', () => {
    expect(resolveDensity(40)).toBe('compact');
    expect(dayHeaderLabel('2026-08-11', 'compact').length).toBeLessThanOrEqual(1);
    expect(dayHeaderLabel('2026-08-11', 'wide')).toContain('Tue');
  });
});

describe.skipIf(!renderable)('HabitTrackerWidget', () => {
  it('shows empty state and add affordance with no habits', async () => {
    const { setup } = await renderWidget(initialState(), { width: 50, height: 12 });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Add habit');
      expect(frame).toContain('No habits yet');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('renders seven day toggles for a habit at compact width', async () => {
    const state = initialState(
      [{ id: 'h1', name: 'Water', createdAt: '2026-08-11T00:00:00.000Z' }],
      { h1: [] },
    );
    const { setup } = await renderWidget(state, { width: 40, height: 10 });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Water');
      const unchecked = frame.match(/\[ \]/g) ?? [];
      expect(unchecked.length).toBeGreaterThanOrEqual(7);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows streak values at wide width', async () => {
    const today = todayKey();
    const state = initialState(
      [{ id: 'h1', name: 'Water', createdAt: `${today}T00:00:00.000Z` }],
      { h1: [addDays(today, -2), addDays(today, -1), today] },
    );
    const { setup } = await renderWidget(state, { width: 80, height: 12 });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toMatch(/3\/3/);
      expect(frame).toContain('Edit');
    } finally {
      setup.renderer.destroy();
    }
  });
});
