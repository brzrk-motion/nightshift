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
import { POMODORO_ENTITY, initialState, startSession } from './timer.js';
import { SessionWidget, TodayWidget } from './widgets.js';

const renderable = detectRuntime().ffi;

describe.skipIf(!renderable)('SessionWidget', () => {
  it('draws the remaining time, phase, and controls', async () => {
    const entities = createEntityStore();
    entities.register(POMODORO_ENTITY, startSession(initialState()));
    const runtime = createAppRuntime({ entities });

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <SessionWidget options={{}} width={48} height={12} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 48, height: 12 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('25:00');
      expect(frame).toContain('Focus');
      expect(frame).toContain('Start');
      expect(frame).toContain('Skip');
    } finally {
      setup.renderer.destroy();
    }
  });
});

describe.skipIf(!renderable)('TodayWidget', () => {
  it('shows how many pomodoros have completed today', async () => {
    const entities = createEntityStore();
    entities.register(POMODORO_ENTITY, { ...initialState(), completedPomodorosToday: 4 });
    const runtime = createAppRuntime({ entities });

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <TodayWidget options={{}} width={30} height={6} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 30, height: 6 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('4');
      expect(frame).toContain('pomodoros completed');
    } finally {
      setup.renderer.destroy();
    }
  });
});
