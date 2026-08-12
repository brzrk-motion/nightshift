import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isNightshiftError } from '@nightshift/core';
import {
  deleteDashboard,
  loadDashboardFile,
  loadDashboards,
  mergeDashboards,
  parseDashboard,
  saveDashboard,
  serializeDashboard,
} from './parse.js';
import {
  BLANK_DASHBOARD,
  BUILT_IN_DASHBOARDS,
  DASHBOARD_SCHEMA_VERSION,
  type DashboardSpec,
} from './schema.js';
import { createWidgetRegistry, type WidgetDefinition } from './registry.js';
import { BUILT_IN_WIDGETS } from './widgets.js';

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
      - core.note
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
    expect(parseDashboard(HOME).rows[0]?.widgets[1]).toEqual({ type: 'core.note' });
  });

  it('accepts a bare list of widgets as a row', () => {
    expect(parseDashboard(HOME).rows[1]?.widgets.map((widget) => widget.type)).toEqual([
      'core.entities',
      'core.commands',
    ]);
  });

  it('takes the name from the file when the document omits it', () => {
    const dashboard = parseDashboard('rows:\n  - [core.note]', { name: 'work' });
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
      parseDashboard('rows:\n  - [core.note]\n  - widgets:\n      - {type: a.b, span: -1}', {
        name: 'home',
        source: 'home.yaml',
      }),
    ).toThrowError('home.yaml.rows[1].widgets[0].span must be a positive number.');
  });

  it('defaults version to the current schema when the file omits it', () => {
    expect(parseDashboard('rows:\n  - [core.note]', { name: 'home' }).version).toBe(
      DASHBOARD_SCHEMA_VERSION,
    );
  });

  it('accepts an explicit version at or below the current one', () => {
    expect(parseDashboard('version: 1\nrows:\n  - [core.note]', { name: 'home' }).version).toBe(1);
  });

  it('rejects a version newer than this Nightshift understands', () => {
    expect(() =>
      parseDashboard(`version: ${DASHBOARD_SCHEMA_VERSION + 1}\nrows:\n  - [core.note]`, {
        name: 'home',
        source: 'home.yaml',
      }),
    ).toThrowError(/version must be at most/);
  });

  it('parses a widget’s minWidth, minHeight and when', () => {
    const widget = parseDashboard(
      `rows:
  - widgets:
      - type: focus.session
        minWidth: 40
        minHeight: 8
        when:
          type: equals
          entity: timer.focus
          key: status
          value: running
`,
      { name: 'home' },
    ).rows[0]?.widgets[0];

    expect(widget).toMatchObject({
      minWidth: 40,
      minHeight: 8,
      when: { type: 'equals', entity: 'timer.focus', key: 'status', value: 'running' },
    });
  });

  it.each([
    ['above', 'value: nope', /when\.value must be a number/],
    ['below', 'value: nope', /when\.value must be a number/],
  ])('requires a numeric value for a %s condition', (type, valueLine, message) => {
    const source = `rows:\n  - widgets:\n      - {type: a.b, when: {type: ${type}, entity: timer.focus, key: status, ${valueLine}}}`;
    expect(() => parseDashboard(source, { name: 'test', source: 'test' })).toThrowError(message);
  });

  it.each([
    ['rows:\n  - widgets:\n      - {type: a.b, minWidth: 0}', /minWidth must be a positive number/],
    [
      'rows:\n  - widgets:\n      - {type: a.b, minHeight: -1}',
      /minHeight must be a positive number/,
    ],
    [
      'rows:\n  - widgets:\n      - {type: a.b, when: {type: nope, entity: timer.focus, key: status, value: 1}}',
      /when\.type must be one of/,
    ],
    [
      'rows:\n  - widgets:\n      - {type: a.b, when: {type: equals, entity: bad-id, key: status, value: 1}}',
      /when\.entity must be an entity id/,
    ],
  ])('rejects %o', (source, message) => {
    expect(() => parseDashboard(source, { name: 'test', source: 'test' })).toThrowError(message);
  });
});

describe('serializeDashboard', () => {
  const spec: DashboardSpec = {
    version: DASHBOARD_SCHEMA_VERSION,
    name: 'home',
    title: 'Home',
    theme: 'midnight',
    refresh: 30,
    rows: [
      {
        height: 2,
        widgets: [
          {
            type: 'focus.session',
            title: 'Deep work',
            span: 2,
            minWidth: 40,
            entities: ['timer.focus'],
            options: { minutes: 50 },
            when: { type: 'equals', entity: 'timer.focus', key: 'status', value: 'running' },
          },
        ],
      },
    ],
  };

  it('round-trips through parseDashboard', () => {
    expect(parseDashboard(serializeDashboard(spec))).toEqual(spec);
  });

  it('round-trips a dashboard with only the required fields', () => {
    const minimal: DashboardSpec = { name: 'bare', rows: [{ widgets: [{ type: 'core.note' }] }] };
    const reparsed = parseDashboard(serializeDashboard(minimal), { name: 'bare' });
    expect(reparsed).toEqual({ ...minimal, version: DASHBOARD_SCHEMA_VERSION });
  });
});

describe('saveDashboard', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-save-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes to <directory>/<name>.yaml', async () => {
    const spec: DashboardSpec = { name: 'focus', rows: [{ widgets: [{ type: 'core.note' }] }] };

    const path = await saveDashboard(dir, spec);

    expect(path).toBe(join(dir, 'focus.yaml'));
    const written = await readFile(path, 'utf8');
    expect(written).toContain('name: focus');
  });

  it('creates the directory if it does not exist yet', async () => {
    const nested = join(dir, 'nested');
    const spec: DashboardSpec = { name: 'focus', rows: [{ widgets: [{ type: 'core.note' }] }] };

    await saveDashboard(nested, spec);

    expect(await loadDashboardFile(join(nested, 'focus.yaml'))).toMatchObject({ name: 'focus' });
  });

  it('overwrites a previous save under the same name', async () => {
    const spec: DashboardSpec = { name: 'focus', rows: [{ widgets: [{ type: 'core.note' }] }] };
    await saveDashboard(dir, spec);

    await saveDashboard(dir, { ...spec, title: 'Renamed' });

    const reloaded = await loadDashboardFile(join(dir, 'focus.yaml'));
    expect(reloaded.title).toBe('Renamed');
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
    await writeFile(join(dir, 'work.yaml'), 'rows:\n  - [core.note]');
    await writeFile(join(dir, 'night.yml'), 'rows:\n  - [core.entities]');
    await writeFile(join(dir, 'notes.md'), 'ignore me');

    const result = await loadDashboards(dir);

    expect(result.dashboards.map((dashboard) => dashboard.name)).toEqual(['night', 'work']);
    expect(result.failed).toEqual([]);
  });

  it('reports a broken file instead of hiding the rest', async () => {
    await writeFile(join(dir, 'good.yaml'), 'rows:\n  - [core.note]');
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

describe('mergeDashboards', () => {
  const home: DashboardSpec = {
    name: 'home',
    title: 'Built-in',
    rows: [{ widgets: [{ type: 'a' }] }],
  };
  const work: DashboardSpec = { name: 'work', rows: [{ widgets: [{ type: 'b' }] }] };

  it('includes every built-in when nothing on disk shares its name', () => {
    expect(mergeDashboards([work], [home]).map((d) => d.name)).toEqual(['home', 'work']);
  });

  it('lets a loaded dashboard replace a built-in of the same name', () => {
    const mine: DashboardSpec = {
      name: 'home',
      title: 'Mine',
      rows: [{ widgets: [{ type: 'c' }] }],
    };
    const merged = mergeDashboards([mine], [home]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe('Mine');
  });

  it('sorts the result by name', () => {
    expect(mergeDashboards([work], [home]).map((d) => d.name)).toEqual(['home', 'work']);
  });
});

describe('BUILT_IN_DASHBOARDS', () => {
  it('ships more than one starting point, sorted by name', () => {
    expect(BUILT_IN_DASHBOARDS.length).toBeGreaterThan(1);
    expect(BUILT_IN_DASHBOARDS.map((dashboard) => dashboard.name)).toEqual(
      [...BUILT_IN_DASHBOARDS]
        .map((dashboard) => dashboard.name)
        .sort((a, b) => a.localeCompare(b)),
    );
  });

  it.each(BUILT_IN_DASHBOARDS)('$name only uses known shipped widget types', (dashboard) => {
    const knownTypes = new Set([
      ...BUILT_IN_WIDGETS.map((widget) => widget.type),
      // Bundled plugins that the concept `home` dashboard may reference.
      'clock.now',
      'focus.session',
      'focus.today',
      'habit.tracker',
      'home-assistant.scenes',
      'todo.list',
      'weather.now',
      'weather.forecast',
    ]);
    const types = dashboard.rows.flatMap((row) => row.widgets.map((widget) => widget.type));
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) expect(knownTypes.has(type)).toBe(true);
  });

  it('keeps minimal and nightshift on core widgets only', () => {
    const coreOnly = new Set(BUILT_IN_WIDGETS.map((widget) => widget.type));
    for (const name of ['minimal', 'nightshift'] as const) {
      const dashboard = BUILT_IN_DASHBOARDS.find((entry) => entry.name === name);
      expect(dashboard).toBeDefined();
      for (const type of dashboard!.rows.flatMap((row) => row.widgets.map((w) => w.type))) {
        expect(coreOnly.has(type)).toBe(true);
      }
    }
  });

  it.each(BUILT_IN_DASHBOARDS)('$name round-trips through serialize and parse', (dashboard) => {
    const parsed = parseDashboard(serializeDashboard(dashboard), { name: dashboard.name });
    expect(parsed).toEqual(dashboard);
  });
});

function definition(type: string): WidgetDefinition {
  return { type, title: type, entities: [], render: () => null };
}

describe('createWidgetRegistry', () => {
  it('registers and resolves widgets', () => {
    const registry = createWidgetRegistry([definition('core.note')]);

    expect(registry.get('core.note')?.title).toBe('core.note');
    expect(registry.has('core.note')).toBe(true);
    expect(registry.has('nope')).toBe(false);
  });

  it('returns a disposer', () => {
    const registry = createWidgetRegistry();
    registry.register(definition('core.note'))();

    expect(registry.get('core.note')).toBeUndefined();
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
    const registry = createWidgetRegistry([definition('core.note')]);

    expect(registry.missing(['core.note', 'focus.session', 'focus.session'])).toEqual([
      'focus.session',
    ]);
  });
});

describe('BLANK_DASHBOARD', () => {
  it('produces a minimal valid spec', () => {
    const spec = BLANK_DASHBOARD('work', 'Work');
    expect(spec.name).toBe('work');
    expect(spec.title).toBe('Work');
    expect(spec.rows).toHaveLength(1);
    expect(parseDashboard(serializeDashboard(spec)).name).toBe('work');
  });
});

describe('deleteDashboard', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-dashboard-delete-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('removes a user dashboard file', async () => {
    const spec = BLANK_DASHBOARD('work');
    await saveDashboard(dir, spec);
    await deleteDashboard(dir, 'work');
    await expect(loadDashboardFile(join(dir, 'work.yaml'))).rejects.toThrow();
  });

  it('refuses when no user file exists', async () => {
    await expect(deleteDashboard(dir, 'nope')).rejects.toThrowError(/No user dashboard file/);
  });
});
