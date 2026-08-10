import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isNightshiftError } from '@nightshift/core';
import { loadDashboardFile, loadDashboards, parseDashboard } from './parse.js';
import { createWidgetRegistry, type WidgetDefinition } from './registry.js';

const HOME = `
name: home
title: Nightshift
theme: midnight
refresh: 30
rows:
  - height: 2
    widgets:
      - type: focus.session
        title: Deep work
        span: 2
        entities: [timer.focus]
        options:
          minutes: 50
      - core.clock
  - - core.entities
    - core.commands
`;

describe('parseDashboard', () => {
  it('parses a complete dashboard', () => {
    const dashboard = parseDashboard(HOME);

    expect(dashboard.name).toBe('home');
    expect(dashboard.title).toBe('Nightshift');
    expect(dashboard.theme).toBe('midnight');
    expect(dashboard.refresh).toBe(30);
    expect(dashboard.rows).toHaveLength(2);
  });

  it('parses a widget with all of its options', () => {
    const widget = parseDashboard(HOME).rows[0]?.widgets[0];

    expect(widget).toEqual({
      type: 'focus.session',
      title: 'Deep work',
      span: 2,
      entities: ['timer.focus'],
      options: { minutes: 50 },
    });
  });

  it('accepts a bare widget type as shorthand', () => {
    expect(parseDashboard(HOME).rows[0]?.widgets[1]).toEqual({ type: 'core.clock' });
  });

  it('accepts a bare list of widgets as a row', () => {
    expect(parseDashboard(HOME).rows[1]?.widgets.map((widget) => widget.type)).toEqual([
      'core.entities',
      'core.commands',
    ]);
  });

  it('takes the name from the file when the document omits it', () => {
    const dashboard = parseDashboard('rows:\n  - [core.clock]', { name: 'work' });
    expect(dashboard.name).toBe('work');
  });

  it('rejects a document that is not a mapping', () => {
    expect(() => parseDashboard('- one\n- two')).toThrowError(/must be a YAML mapping/);
  });

  it('rejects invalid YAML, pointing at the problem', () => {
    try {
      parseDashboard('rows: [\n  unclosed');
      expect.unreachable('parse should have thrown');
    } catch (error) {
      expect(isNightshiftError(error) && error.code).toBe('CONFIG_INVALID');
      expect(isNightshiftError(error) && error.hint).toBeTruthy();
    }
  });

  it.each([
    ['name: home', /rows must be a non-empty list/],
    ['name: home\nrows: []', /rows must be a non-empty list/],
    ['rows:\n  - widgets: []', /widgets must be a non-empty list/],
    ['rows:\n  - widgets:\n      - {}', /type must be a widget type/],
    ['rows:\n  - widgets:\n      - {type: a.b, span: 0}', /span must be a positive number/],
    ['rows:\n  - widgets:\n      - {type: a.b, entities: [nope]}', /entities\[0\] must be an/],
    ['rows:\n  - widgets:\n      - {type: a.b, options: 3}', /options must be an object/],
    ['rows:\n  - {height: -1, widgets: [a.b]}', /height must be a positive number/],
    ['rows:\n  - [a.b]\nrefresh: -5', /refresh must be a number of seconds/],
  ])('rejects %o', (source, message) => {
    expect(() => parseDashboard(source, { name: 'test', source: 'test' })).toThrowError(message);
  });

  it('names the exact path that is wrong', () => {
    expect(() =>
      parseDashboard('rows:\n  - [core.clock]\n  - widgets:\n      - {type: a.b, span: -1}', {
        name: 'home',
        source: 'home.yaml',
      }),
    ).toThrowError('home.yaml.rows[1].widgets[0].span must be a positive number.');
  });
});

describe('loadDashboards', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-dashboards-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads every YAML file, named after the file', async () => {
    await writeFile(join(dir, 'work.yaml'), 'rows:\n  - [core.clock]');
    await writeFile(join(dir, 'night.yml'), 'rows:\n  - [core.entities]');
    await writeFile(join(dir, 'notes.md'), 'ignore me');

    const result = await loadDashboards(dir);

    expect(result.dashboards.map((dashboard) => dashboard.name)).toEqual(['night', 'work']);
    expect(result.failed).toEqual([]);
  });

  it('reports a broken file instead of hiding the rest', async () => {
    await writeFile(join(dir, 'good.yaml'), 'rows:\n  - [core.clock]');
    await writeFile(join(dir, 'bad.yaml'), 'rows: 3');

    const result = await loadDashboards(dir);

    expect(result.dashboards.map((dashboard) => dashboard.name)).toEqual(['good']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.path).toBe(join(dir, 'bad.yaml'));
  });

  it('is quiet about a directory that does not exist', async () => {
    expect(await loadDashboards(join(dir, 'nope'))).toEqual({ dashboards: [], failed: [] });
  });

  it('reports a missing file by path', async () => {
    await expect(loadDashboardFile(join(dir, 'nope.yaml'))).rejects.toThrowError(/Could not read/);
  });
});

function definition(type: string): WidgetDefinition {
  return { type, title: type, entities: [], render: () => null };
}

describe('createWidgetRegistry', () => {
  it('registers and resolves widgets', () => {
    const registry = createWidgetRegistry([definition('core.clock')]);

    expect(registry.get('core.clock')?.title).toBe('core.clock');
    expect(registry.has('core.clock')).toBe(true);
    expect(registry.has('nope')).toBe(false);
  });

  it('returns a disposer', () => {
    const registry = createWidgetRegistry();
    registry.register(definition('core.clock'))();

    expect(registry.get('core.clock')).toBeUndefined();
  });

  it('rejects a widget with no type', () => {
    expect(() => createWidgetRegistry().register(definition(' '))).toThrowError(/needs a type/);
  });

  it('adds a plugin’s widgets and tags them with their source', () => {
    const registry = createWidgetRegistry();
    registry.registerPlugin('focus', [
      { type: 'focus.session', title: 'Session', entities: ['timer.focus'], render: () => null },
    ]);

    expect(registry.get('focus.session')?.source).toBe('focus');
  });

  it('skips a plugin widget with nothing to draw', () => {
    const registry = createWidgetRegistry();
    registry.registerPlugin('focus', [{ type: 'focus.session', title: 'S', entities: [] }]);

    expect(registry.list()).toEqual([]);
  });

  it('removes a plugin’s widgets when it unloads', () => {
    const registry = createWidgetRegistry();
    const dispose = registry.registerPlugin('focus', [
      { type: 'focus.session', title: 'S', entities: [], render: () => null },
    ]);

    dispose();

    expect(registry.list()).toEqual([]);
  });

  it('lists the types a dashboard asks for that nothing provides', () => {
    const registry = createWidgetRegistry([definition('core.clock')]);

    expect(registry.missing(['core.clock', 'focus.session', 'focus.session'])).toEqual([
      'focus.session',
    ]);
  });
});
