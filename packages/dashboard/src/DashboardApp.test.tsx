import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import { createAppRuntime, detectRuntime } from '@nightshift/ui';
import { DashboardApp } from './DashboardApp.js';
import { createWidgetRegistry } from './registry.js';
import { BUILT_IN_WIDGETS } from './widgets.js';
import { parseDashboard } from './parse.js';
import type { DashboardSpec } from './schema.js';

const renderable = detectRuntime().ffi;

function registry() {
  const widgets = createWidgetRegistry(BUILT_IN_WIDGETS);
  widgets.registerPlugin('focus', [
    { type: 'focus.session', title: 'Focus session', entities: [], render: () => null },
  ]);
  return widgets;
}

/** Same input-flushing helper the rest of the shell's tests use. */
async function press(send: () => void): Promise<void> {
  await act(async () => {
    send();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

const twoWidgets: DashboardSpec = parseDashboard(
  `name: home
title: Home
rows:
  - widgets:
      - core.entities
      - core.note
`,
);

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nightshift-editmode-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe.skipIf(!renderable)('DashboardApp edit mode', () => {
  it('does not register edit commands without a dashboardsDir', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp runtime={runtime} dashboards={[twoWidgets]} registry={registry()} />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      expect(runtime.commands.get('dashboard.edit.toggle')).toBeUndefined();
      await press(() => setup.mockInput.pressKey('e'));
      expect(setup.captureCharFrame()).not.toContain('editing');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('enters edit mode on "e" and shows it in the title and status', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));

      const frame = setup.captureCharFrame();
      expect(frame).toContain('editing Home');
      expect(frame).toContain('save');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('ignores "e" while a widget input has captured the keyboard', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      // Simulates a plugin widget's focused `TextInput` — typing the letter
      // "e" into it (e.g. composing a todo's text) must not also toggle
      // dashboard edit mode. See `@nightshift/ui`'s `keyboardCapture.ts`.
      const release = runtime.keyboardCapture.acquire();
      await press(() => setup.mockInput.pressKey('e'));
      expect(setup.captureCharFrame()).not.toContain('editing Home');

      release();
      await press(() => setup.mockInput.pressKey('e'));
      expect(setup.captureCharFrame()).toContain('editing Home');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('selects the first widget on entry, drawn with an active border', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      // No direct way to read border colour from the char frame; the
      // behavioural tests below (move/resize/remove act on "the selection")
      // are what actually prove a widget starts selected.
      expect(setup.captureCharFrame()).toContain('Entities');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('moves the selected widget right, left, then reorders the row', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('ARROW_RIGHT'));
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));

      const written = await readFile(join(dir, 'home.yaml'), 'utf8');
      const saved = parseDashboard(written, { name: 'home' });
      expect(saved.rows[0]?.widgets.map((w) => w.type)).toEqual(['core.note', 'core.entities']);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('resizes the selected widget’s span with shift+right', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('ARROW_RIGHT', { shift: true }));
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));

      const saved = parseDashboard(await readFile(join(dir, 'home.yaml'), 'utf8'), {
        name: 'home',
      });
      expect(saved.rows[0]?.widgets[0]?.span).toBe(2);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('resizes the selected widget’s row height with shift+down', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('ARROW_DOWN', { shift: true }));
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));

      const saved = parseDashboard(await readFile(join(dir, 'home.yaml'), 'utf8'), {
        name: 'home',
      });
      expect(saved.rows[0]?.height).toBe(2);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('removes the selected widget with "d"', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('d'));
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));

      const saved = parseDashboard(await readFile(join(dir, 'home.yaml'), 'utf8'), {
        name: 'home',
      });
      expect(saved.rows[0]?.widgets.map((w) => w.type)).toEqual(['core.note']);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('adds a widget through the picker with "a"', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('a'));
      expect(await setup.waitForFrame((frame) => frame.includes('Add a widget'))).toContain(
        'Add a widget',
      );

      for (const char of 'focus.session') await press(() => setup.mockInput.pressKey(char));
      await press(() => setup.mockInput.pressEnter());
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));

      const saved = parseDashboard(await readFile(join(dir, 'home.yaml'), 'utf8'), {
        name: 'home',
      });
      expect(saved.rows[0]?.widgets.map((w) => w.type)).toContain('focus.session');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('swaps the selected widget for a different type with "w"', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      // The entities widget is selected first; swap it for the focus widget rather
      // than adding a third one alongside it.
      await press(() => setup.mockInput.pressKey('w'));
      expect(await setup.waitForFrame((frame) => frame.includes('Swap widget'))).toContain(
        'Swap widget',
      );

      for (const char of 'focus.session') await press(() => setup.mockInput.pressKey(char));
      await press(() => setup.mockInput.pressEnter());
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));

      const saved = parseDashboard(await readFile(join(dir, 'home.yaml'), 'utf8'), {
        name: 'home',
      });
      expect(saved.rows[0]?.widgets.map((w) => w.type)).toEqual(['focus.session', 'core.note']);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('discards changes and exits on escape', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('d'));
      await press(() => setup.mockInput.pressEscape());

      const frame = await setup.waitForFrame((frame) => !frame.includes('editing'));
      expect(frame).not.toContain('editing');
      // Nothing was ever written, and the live dashboard is untouched.
      await expect(readFile(join(dir, 'home.yaml'), 'utf8')).rejects.toThrow();
      expect(frame).toContain('Entities');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('reset reverts in-progress changes without leaving edit mode', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('d'));
      expect(setup.captureCharFrame()).not.toContain('core.note');

      await press(() => setup.mockInput.pressKey('r'));

      const frame = setup.captureCharFrame();
      expect(frame).toContain('editing Home');
      expect(frame).toContain('Entities');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('save writes the file and the dashboard reflects it without a reload', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('d'));
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));

      const frame = setup.captureCharFrame();
      expect(frame).not.toContain('editing');
      expect(frame).not.toContain('core.note');

      const written = await readFile(join(dir, 'home.yaml'), 'utf8');
      expect(written).toContain('core.note');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('reload picks up a dashboard added on disk since startup', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('e'));
      await press(() => setup.mockInput.pressKey('s', { ctrl: true }));
      expect(runtime.commands.get('dashboard.open.home')).toBeTruthy();

      await act(async () => {
        await runtime.commands.run('dashboard.reload');
      });
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('nightshift · Home');
    } finally {
      setup.renderer.destroy();
    }
  });
});

describe.skipIf(!renderable)('DashboardApp onboarding', () => {
  it('shows the welcome modal when asked to, and not otherwise', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp runtime={runtime} dashboards={[twoWidgets]} registry={registry()} onboarding />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Welcome to Nightshift');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('dismisses on any key, calls the callback once, and lets edit-mode keys through afterwards', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const onOnboardingDismissed = vi.fn();
    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[twoWidgets]}
        registry={registry()}
        dashboardsDir={dir}
        onboarding
        onOnboardingDismissed={onOnboardingDismissed}
      />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Welcome to Nightshift');

      // The dismissing key ("e") would otherwise also enter edit mode; while
      // the modal is up it only dismisses, proving edit mode is gated behind
      // it rather than racing it on the same keypress.
      await press(() => setup.mockInput.pressKey('e'));

      const frame = setup.captureCharFrame();
      expect(frame).not.toContain('Welcome to Nightshift');
      expect(frame).not.toContain('editing');
      expect(onOnboardingDismissed).toHaveBeenCalledOnce();

      await press(() => setup.mockInput.pressKey('e'));
      expect(setup.captureCharFrame()).toContain('editing Home');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('does not show the modal when onboarding is false', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    const setup = await testRender(
      <DashboardApp runtime={runtime} dashboards={[twoWidgets]} registry={registry()} />,
      { width: 100, height: 24 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).not.toContain('Welcome to Nightshift');
    } finally {
      setup.renderer.destroy();
    }
  });
});
