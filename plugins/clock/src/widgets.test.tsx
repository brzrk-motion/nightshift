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
import { CLOCK_ENTITY, initialClockSettings, type ClockSettings } from './entity.js';
import { ClockWidget } from './widgets.js';

/**
 * These drive the real OpenTUI renderer, which needs native FFI — see
 * packages/ui/vitest.config.ts. On a runtime without it, they skip.
 */
const renderable = detectRuntime().ffi;

const COMMAND_IDS = [
  'clock.set-hour-format',
  'clock.set-show-seconds',
  'clock.set-date-format',
  'clock.configure-location',
  'clock.use-system-timezone',
];

/** Row/column of the first line containing `needle`, for clicking on it. */
function locate(frame: string, needle: string): { row: number; col: number } {
  const lines = frame.split('\n');
  for (let row = 0; row < lines.length; row += 1) {
    const col = lines[row]?.indexOf(needle) ?? -1;
    if (col >= 0) return { row, col };
  }
  throw new Error(`"${needle}" not found in frame:\n${frame}`);
}

function draw(
  options: {
    settings?: ClockSettings;
    onCommand?: (id: string, args?: unknown) => void;
    height?: number;
    widgetOptions?: Record<string, unknown>;
  } = {},
) {
  const { settings = initialClockSettings(), onCommand, height = 10, widgetOptions = {} } = options;
  const entities = createEntityStore();
  entities.register(CLOCK_ENTITY, settings);
  const runtime = createAppRuntime({ entities });

  for (const id of COMMAND_IDS) {
    runtime.commands.register({ id, title: id, run: (args) => onCommand?.(id, args) });
  }

  return testRender(
    <ThemeProvider theme={MIDNIGHT_THEME}>
      <RuntimeProvider runtime={runtime}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ClockWidget options={widgetOptions as any} width={40} height={height} />
      </RuntimeProvider>
    </ThemeProvider>,
    { width: 44, height: Math.max(height, 4) + 2 },
  );
}

describe.skipIf(!renderable)('ClockWidget', () => {
  it('shows the time and, by default, a long-form date', async () => {
    const setup = await draw();

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toMatch(/\d\d:\d\d:\d\d/);
      expect(frame).toContain('Settings');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('hides the date line when the format is "none"', async () => {
    const setup = await draw({ settings: { ...initialClockSettings(), dateFormat: 'none' } });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toMatch(/\d\d:\d\d:\d\d/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('opens the settings panel and back again from the toolbar', async () => {
    const setup = await draw();

    try {
      await setup.renderOnce();
      let frame = setup.captureCharFrame();
      const settingsButton = locate(frame, 'Settings');
      await setup.mockMouse.click(settingsButton.col, settingsButton.row);
      await setup.renderOnce();

      frame = setup.captureCharFrame();
      expect(frame).toContain('24-hour');
      expect(frame).toContain('Show seconds');
      expect(frame).toContain('Date format');
      expect(frame).toContain('Timezone');
      expect(frame).toContain('Done');

      const doneButton = locate(frame, 'Done');
      await setup.mockMouse.click(doneButton.col, doneButton.row);
      await setup.renderOnce();

      frame = setup.captureCharFrame();
      expect(frame).toContain('Settings');
      expect(frame).not.toContain('24-hour');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('toggling 12/24-hour runs the clock.set-hour-format command', async () => {
    const calls: { id: string; args?: unknown }[] = [];
    const setup = await draw({ onCommand: (id, args) => calls.push({ id, args }) });

    try {
      await setup.renderOnce();
      const settingsButton = locate(setup.captureCharFrame(), 'Settings');
      await setup.mockMouse.click(settingsButton.col, settingsButton.row);
      await setup.renderOnce();

      const hourToggle = locate(setup.captureCharFrame(), '24-hour');
      await setup.mockMouse.click(hourToggle.col, hourToggle.row);
      await setup.renderOnce();

      expect(calls).toContainEqual({ id: 'clock.set-hour-format', args: { hour12: true } });
    } finally {
      setup.renderer.destroy();
    }
  });
});

describe.skipIf(!renderable)('ClockWidget timezone and location', () => {
  it('starts in settings, showing the location editor, when the timezone could not be detected', async () => {
    const setup = await draw({ settings: { ...initialClockSettings(), timezone: null } });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain("Set a location for the clock's timezone");
      // Settings is already open — the toolbar reads "Done", not "Settings".
      expect(frame).toContain('Done');
      expect(frame).not.toContain('Settings');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('starts in settings when added from the widget picker (options.startInSettings)', async () => {
    const setup = await draw({ widgetOptions: { startInSettings: true } });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('24-hour');
      expect(frame).toContain('Done');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('does not start in settings on a normal, already-configured mount', async () => {
    const setup = await draw();

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).not.toContain('24-hour');
      expect(frame).toContain('Settings');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows the detected system timezone by default', async () => {
    const setup = await draw();

    try {
      await setup.renderOnce();
      const settingsButton = locate(setup.captureCharFrame(), 'Settings');
      await setup.mockMouse.click(settingsButton.col, settingsButton.row);
      await setup.renderOnce();

      const frame = setup.captureCharFrame();
      expect(frame).toContain('Timezone');
      expect(frame).toContain('Change');
      expect(frame).not.toContain('Use system'); // only offered once a location override is active
    } finally {
      setup.renderer.destroy();
    }
  });

  it('opening the location editor and saving runs clock.configure-location', async () => {
    const calls: { id: string; args?: unknown }[] = [];
    const setup = await draw({ onCommand: (id, args) => calls.push({ id, args }) });

    try {
      await setup.renderOnce();
      const settingsButton = locate(setup.captureCharFrame(), 'Settings');
      await setup.mockMouse.click(settingsButton.col, settingsButton.row);
      await setup.renderOnce();

      const change = locate(setup.captureCharFrame(), 'Change');
      await setup.mockMouse.click(change.col, change.row);
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain("Set a location for the clock's timezone");

      await setup.mockInput.typeText('Austin');
      await setup.flush();
      await setup.renderOnce();

      const save = locate(setup.captureCharFrame(), 'Save');
      await setup.mockMouse.click(save.col, save.row);
      await setup.renderOnce();

      expect(calls).toContainEqual({ id: 'clock.configure-location', args: { query: 'Austin' } });
    } finally {
      setup.renderer.destroy();
    }
  });

  it('cancelling the location editor returns to the settings panel without saving', async () => {
    const calls: { id: string; args?: unknown }[] = [];
    const setup = await draw({ onCommand: (id, args) => calls.push({ id, args }) });

    try {
      await setup.renderOnce();
      const settingsButton = locate(setup.captureCharFrame(), 'Settings');
      await setup.mockMouse.click(settingsButton.col, settingsButton.row);
      await setup.renderOnce();

      const change = locate(setup.captureCharFrame(), 'Change');
      await setup.mockMouse.click(change.col, change.row);
      await setup.renderOnce();

      const cancel = locate(setup.captureCharFrame(), 'Cancel');
      await setup.mockMouse.click(cancel.col, cancel.row);
      await setup.renderOnce();

      const frame = setup.captureCharFrame();
      expect(frame).toContain('24-hour');
      expect(calls).toEqual([]);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows a location error and offers "Use system" once a custom location is active', async () => {
    const settings: ClockSettings = {
      ...initialClockSettings(),
      timezone: 'Asia/Tokyo',
      timezoneSource: 'location',
      locationQuery: 'Tokyo',
      locationLabel: 'Tokyo, Japan',
    };
    const calls: { id: string; args?: unknown }[] = [];
    const setup = await draw({ settings, onCommand: (id, args) => calls.push({ id, args }) });

    try {
      await setup.renderOnce();
      const settingsButton = locate(setup.captureCharFrame(), 'Settings');
      await setup.mockMouse.click(settingsButton.col, settingsButton.row);
      await setup.renderOnce();

      const frame = setup.captureCharFrame();
      expect(frame).toContain('Tokyo, Japan');
      const useSystem = locate(frame, 'Use system');
      await setup.mockMouse.click(useSystem.col, useSystem.row);
      await setup.renderOnce();

      expect(calls).toContainEqual({ id: 'clock.use-system-timezone', args: undefined });
    } finally {
      setup.renderer.destroy();
    }
  });
});

describe.skipIf(!renderable)('ClockWidget at a squeezed height', () => {
  it('still shows the toolbar, and settings collapse onto one row', async () => {
    const setup = await draw({ height: 4 });

    try {
      await setup.renderOnce();
      let frame = setup.captureCharFrame();
      expect(frame).toContain('Settings');

      const settingsButton = locate(frame, 'Settings');
      await setup.mockMouse.click(settingsButton.col, settingsButton.row);
      await setup.renderOnce();

      frame = setup.captureCharFrame();
      // The toolbar's "Done" button — the whole point of this test — must
      // still be on screen and on its own row, not overrun by the settings
      // content above it (the bug this layout fixes).
      expect(frame).toContain('Done');
      const hourToggleRow = locate(frame, '24-hour').row;
      const doneRow = locate(frame, 'Done').row;
      expect(doneRow).toBeGreaterThan(hourToggleRow);

      const doneButton = locate(frame, 'Done');
      await setup.mockMouse.click(doneButton.col, doneButton.row);
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('Settings');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('hides the date line on the clock face to leave room for the time', async () => {
    const setup = await draw({ height: 4 });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toMatch(/\d\d:\d\d:\d\d/);
      expect(frame).not.toMatch(
        /January|February|March|April|May|June|July|August|September|October|November|December/,
      );
    } finally {
      setup.renderer.destroy();
    }
  });
});
