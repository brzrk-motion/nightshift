import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { act } from 'react';
import { createEntityStore } from '@nightshift/entities';
import { detectRuntime } from './runtime.js';
import { createAppRuntime } from './app.js';
import { AppShell } from './AppShell.js';
import type { Screen } from './screen.js';

const renderable = detectRuntime().ffi;

/** Same input-flushing helper used by the component test suite. */
async function press(send: () => void): Promise<void> {
  await act(async () => {
    send();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

const CUSTOM_SCREENS: readonly Screen[] = [
  { id: 'notes', label: 'Notes', icon: 'entities', render: () => <text>Notes screen</text> },
];

describe.skipIf(!renderable)('AppShell shell', () => {
  it('draws the header, the nav rail, and the dashboard by default', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime} title="Home" screens={CUSTOM_SCREENS}>
        <text>Dashboard body</text>
      </AppShell>,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('NIGHTSHIFT');
      expect(frame).toContain('Home');
      expect(frame).toContain('Notes');
      expect(frame).toContain('Dashboard body');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('switches screens with a mouse click on the nav rail', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime} title="Home" screens={CUSTOM_SCREENS}>
        <text>Dashboard body</text>
      </AppShell>,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      // Row 0 is the header; the "Home" nav item sits at row 2 (its top
      // margin separates it from the header), and "Notes" directly below it.
      await setup.mockMouse.click(2, 3);
      await setup.renderOnce();

      const frame = setup.captureCharFrame();
      expect(frame).toContain('Notes screen');
      expect(frame).not.toContain('Dashboard body');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('switches screens with a digit key, and back with 1', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime} title="Home" screens={CUSTOM_SCREENS}>
        <text>Dashboard body</text>
      </AppShell>,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('2'));
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Notes screen');

      await press(() => setup.mockInput.pressKey('1'));
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Dashboard body');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('registers a nav command for every screen, reachable from the palette', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime} title="Home" screens={CUSTOM_SCREENS}>
        <text>Dashboard body</text>
      </AppShell>,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      expect(runtime.commands.get('nav.dashboard')).toBeTruthy();
      expect(runtime.commands.get('nav.notes')).toBeTruthy();

      await act(async () => {
        await runtime.commands.run('nav.notes');
      });
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Notes screen');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('registers an activate command for every theme', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime}>
        <text>Body</text>
      </AppShell>,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      expect(runtime.commands.get('theme.activate.ember')).toBeTruthy();

      await act(async () => {
        await runtime.commands.run('theme.activate.ember');
      });

      expect(runtime.themes.current.name).toBe('ember');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('collapses the nav rail on a narrow terminal', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime} title="Home" screens={CUSTOM_SCREENS}>
        <text>Dashboard body</text>
      </AppShell>,
      { width: 60, height: 20 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      // The rail is icon-only, so the full label should not appear.
      expect(frame).not.toContain('Notes');
      expect(frame).toContain('Dashboard body');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows the active vibe in the header once one is published', async () => {
    const entities = createEntityStore();
    const runtime = createAppRuntime({ entities });
    const setup = await testRender(
      <AppShell runtime={runtime}>
        <text>Body</text>
      </AppShell>,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).not.toContain('locked in');

      await act(async () => {
        entities.register('nightshift.vibe', { active: 'locked-in', title: 'Locked In' });
        await Promise.resolve();
      });
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('locked in');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('defaults to the five built-in screens when none are given', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime}>
        <text>Body</text>
      </AppShell>,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      for (const label of ['Vibes', 'Apps', 'Entities', 'Automations', 'Settings']) {
        expect(frame, label).toContain(label);
      }
    } finally {
      setup.renderer.destroy();
    }
  });
});
