import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import { createAppRuntime, detectRuntime, useEntity } from '@nightshift/ui';
import { Dashboard } from './Dashboard.js';
import { DashboardApp } from './DashboardApp.js';
import { createWidgetRegistry } from './registry.js';
import { BUILT_IN_WIDGETS } from './widgets.js';
import { parseDashboard } from './parse.js';
import type { DashboardSpec } from './schema.js';

const renderable = detectRuntime().ffi;

function registry() {
  const widgets = createWidgetRegistry(BUILT_IN_WIDGETS);
  widgets.registerPlugin('focus', [
    {
      type: 'focus.session',
      title: 'Focus session',
      entities: ['timer.focus'],
      render: ({ width }) => {
        const entity = useEntity<{ status: string }>('timer.focus');
        return <text>{`session ${entity?.state.status ?? 'unknown'} @${width}`}</text>;
      },
    },
  ]);
  return widgets;
}

const home: DashboardSpec = parseDashboard(`
name: home
title: Home
rows:
  - widgets:
      - type: focus.session
        span: 2
      - type: core.note
        title: Reminder
        options: { text: Ship the thing }
`);

describe.skipIf(!renderable)('Dashboard', () => {
  it('draws each widget in its own panel', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    runtime.entities.register('timer.focus', { status: 'running' });

    const setup = await testRender(
      <DashboardApp runtime={runtime} dashboards={[home]} registry={registry()} />,
      { width: 90, height: 20 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('Focus session');
      expect(frame).toContain('session running');
      expect(frame).toContain('Reminder');
      expect(frame).toContain('Ship the thing');
      expect(frame).toContain('nightshift · Home');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('tells the widget how many cells it has', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    runtime.entities.register('timer.focus', { status: 'idle' });

    const setup = await testRender(<Dashboard dashboard={home} registry={registry()} />, {
      width: 90,
      height: 20,
    });

    try {
      await setup.renderOnce();
      // Two thirds of 90 columns, which is what `span: 2` against `span: 1` means.
      expect(setup.captureCharFrame()).toContain('@60');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows a placeholder rather than failing on an unknown widget type', async () => {
    const dashboard = parseDashboard('name: broken\nrows:\n  - [nope.widget]');
    const setup = await testRender(<Dashboard dashboard={dashboard} registry={registry()} />, {
      width: 70,
      height: 12,
    });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Unknown widget');
      expect(frame).toContain('nope.widget');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('stacks widgets on a narrow terminal instead of squashing them', async () => {
    const runtime = createAppRuntime({ entities: createEntityStore() });
    runtime.entities.register('timer.focus', { status: 'idle' });

    const setup = await testRender(<Dashboard dashboard={home} registry={registry()} />, {
      width: 50,
      height: 20,
    });

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      // Both widgets are drawn, each spanning the full width.
      expect(frame).toContain('Focus session');
      expect(frame).toContain('Reminder');
      expect(frame).toContain('@50');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('switches dashboards through a command', async () => {
    const work = parseDashboard('name: work\ntitle: Work\nrows:\n  - [core.commands]');
    const runtime = createAppRuntime({ entities: createEntityStore() });
    runtime.entities.register('timer.focus', { status: 'idle' });
    const switched: string[] = [];

    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[home, work]}
        registry={registry()}
        onSwitch={(name) => switched.push(name)}
      />,
      { width: 90, height: 20 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('nightshift · Home');

      await act(async () => {
        await runtime.commands.run('dashboard.open.work');
      });
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('nightshift · Work');
      expect(switched).toEqual(['work']);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('applies the theme a dashboard asks for, and warns about one it does not know', async () => {
    const tinted = parseDashboard('name: tinted\ntheme: ember\nrows:\n  - [core.clock]');
    const unknown = parseDashboard('name: odd\ntheme: nope\nrows:\n  - [core.clock]');
    const runtime = createAppRuntime();

    const setup = await testRender(
      <DashboardApp
        runtime={runtime}
        dashboards={[tinted, unknown]}
        registry={registry()}
        initial="tinted"
      />,
      { width: 90, height: 20 },
    );

    try {
      await setup.renderOnce();
      expect(runtime.themes.current.name).toBe('ember');

      await act(async () => {
        await runtime.commands.run('dashboard.open.odd');
      });
      await setup.renderOnce();

      expect(runtime.themes.current.name).toBe('ember');
      expect(setup.captureCharFrame()).toContain('not a theme Nightshift knows');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('says so when a dashboard has no widgets it can draw', async () => {
    const empty: DashboardSpec = { name: 'empty', rows: [] };
    const setup = await testRender(<Dashboard dashboard={empty} registry={registry()} />, {
      width: 60,
      height: 10,
    });

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('has no widgets');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('draws the built-in clock and entity widgets', async () => {
    const entities = createEntityStore();
    entities.register('timer.focus', { status: 'running' }, { owner: 'focus' });
    const runtime = createAppRuntime({ entities });
    const dashboard = parseDashboard('name: built\nrows:\n  - [core.clock, core.entities]');

    const setup = await testRender(
      <DashboardApp runtime={runtime} dashboards={[dashboard]} registry={registry()} />,
      // Wide enough that the persistent nav rail does not squeeze the
      // entities table's id column into truncation.
      { width: 120, height: 20 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toMatch(/\d\d:\d\d/);
      expect(frame).toContain('timer.focus');
      expect(frame).toContain('status=running');
    } finally {
      setup.renderer.destroy();
    }
  });
});
