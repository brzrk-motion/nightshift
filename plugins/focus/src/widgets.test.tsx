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
import { FOCUS_ENTITY, initialState, startSession } from './timer.js';
import { SessionWidget, TodayWidget } from './widgets.js';

/**
 * These drive the real OpenTUI renderer, which needs native FFI — see
 * packages/ui/vitest.config.ts. On a runtime without it, they skip.
 */
const renderable = detectRuntime().ffi;

describe.skipIf(!renderable)('SessionWidget', () => {
  it('draws the remaining time, the status, and the controls', async () => {
    const entities = createEntityStore();
    entities.register(FOCUS_ENTITY, startSession(initialState(), 25));
    const runtime = createAppRuntime({ entities });

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <SessionWidget options={{}} width={40} height={10} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 44, height: 12 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('25:00');
      expect(frame).toContain('running');
      expect(frame).toContain('Start');
      expect(frame).toContain('Pause');
      expect(frame).toContain('Stop');
      expect(frame).toContain('Reset');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('starting a session runs the focus.start command', async () => {
    const entities = createEntityStore();
    entities.register(FOCUS_ENTITY, initialState());
    const runtime = createAppRuntime({ entities });
    let started = 0;
    runtime.commands.register({
      id: 'focus.start',
      title: 'Start',
      run: () => {
        started += 1;
      },
    });
    runtime.commands.register({ id: 'focus.pause', title: 'Pause', run: () => {} });
    runtime.commands.register({ id: 'focus.stop', title: 'Stop', run: () => {} });
    runtime.commands.register({ id: 'focus.reset', title: 'Reset', run: () => {} });

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <SessionWidget options={{}} width={40} height={10} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 44, height: 12 },
    );

    try {
      await setup.renderOnce();
      await setup.mockMouse.click(3, 6);
      await setup.renderOnce();

      expect(started).toBe(1);
    } finally {
      setup.renderer.destroy();
    }
  });
});

describe.skipIf(!renderable)('TodayWidget', () => {
  it('shows how many sessions have completed today', async () => {
    const entities = createEntityStore();
    entities.register(FOCUS_ENTITY, { ...initialState(), completedToday: 3 });
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

      expect(frame).toContain('3');
      expect(frame).toContain('sessions completed');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('says "session" in the singular for exactly one', async () => {
    const entities = createEntityStore();
    entities.register(FOCUS_ENTITY, { ...initialState(), completedToday: 1 });
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
      expect(setup.captureCharFrame()).toContain('session completed');
    } finally {
      setup.renderer.destroy();
    }
  });
});
