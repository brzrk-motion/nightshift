import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { NightshiftError, type Json } from '@nightshift/core';
import type { Condition } from '@nightshift/automations';
import { isEntityId, type EntityId } from '@nightshift/entities';
import {
  DASHBOARD_SCHEMA_VERSION,
  type DashboardSpec,
  type RowSpec,
  type WidgetSpec,
} from './schema.js';

/**
 * Parsing and validating dashboard files.
 *
 * Validation is strict and the errors name the exact path that is wrong —
 * `rows[1].widgets[0].span` rather than "invalid dashboard" — because a
 * dashboard is a file people edit by hand, and a vague error there costs more
 * than the strictness does.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, expected: string): never {
  throw new NightshiftError('CONFIG_INVALID', `${path} must be ${expected}.`, {
    hint: 'See the dashboard guide for the file format.',
  });
}

function positiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail(path, 'a positive number');
  }
  return value;
}

const CONDITION_TYPES = new Set(['equals', 'above', 'below']);

function parseCondition(input: unknown, path: string): Condition {
  if (!isRecord(input)) fail(path, 'a condition object');

  const type = input['type'];
  if (typeof type !== 'string' || !CONDITION_TYPES.has(type)) {
    fail(`${path}.type`, 'one of equals, above, below');
  }
  const entity = input['entity'];
  if (!isEntityId(entity)) fail(`${path}.entity`, 'an entity id like `timer.focus`');
  const key = input['key'];
  if (typeof key !== 'string' || key.trim() === '') fail(`${path}.key`, 'a state field name');

  if (type === 'equals') {
    if (!('value' in input)) fail(`${path}.value`, 'present');
    return { type: 'equals', entity, key, value: input['value'] as Json };
  }

  const value = input['value'];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path}.value`, 'a number');
  }
  return { type: type as 'above' | 'below', entity, key, value };
}

function parseWidget(input: unknown, path: string): WidgetSpec {
  // `- focus.session` is shorthand for `- type: focus.session`, which keeps
  // the common dashboard readable.
  if (typeof input === 'string') {
    if (input.trim() === '') fail(path, 'a widget type');
    return { type: input.trim() };
  }
  if (!isRecord(input)) fail(path, 'a widget type or a widget object');

  const type = input['type'];
  if (typeof type !== 'string' || type.trim() === '') fail(`${path}.type`, 'a widget type');

  const widget: WidgetSpec = { type: type.trim() };

  if (input['title'] !== undefined) {
    if (typeof input['title'] !== 'string') fail(`${path}.title`, 'a string');
    widget.title = input['title'];
  }

  if (input['span'] !== undefined) widget.span = positiveNumber(input['span'], `${path}.span`);
  if (input['minWidth'] !== undefined) {
    widget.minWidth = positiveNumber(input['minWidth'], `${path}.minWidth`);
  }
  if (input['minHeight'] !== undefined) {
    widget.minHeight = positiveNumber(input['minHeight'], `${path}.minHeight`);
  }

  if (input['entities'] !== undefined) {
    const entities = input['entities'];
    if (!Array.isArray(entities)) fail(`${path}.entities`, 'a list of entity ids');
    widget.entities = entities.map((entity, index) => {
      if (!isEntityId(entity))
        fail(`${path}.entities[${index}]`, 'an entity id like `timer.focus`');
      return entity as EntityId;
    });
  }

  if (input['options'] !== undefined) {
    if (!isRecord(input['options'])) fail(`${path}.options`, 'an object');
    widget.options = input['options'] as Record<string, Json>;
  }

  if (input['when'] !== undefined) {
    widget.when = parseCondition(input['when'], `${path}.when`);
  }

  return widget;
}

function parseRow(input: unknown, path: string): RowSpec {
  // A row may be written as a bare list of widgets when it needs no height.
  if (Array.isArray(input)) {
    return { widgets: input.map((widget, index) => parseWidget(widget, `${path}[${index}]`)) };
  }
  if (!isRecord(input)) fail(path, 'a row object or a list of widgets');

  const widgets = input['widgets'];
  if (!Array.isArray(widgets) || widgets.length === 0) {
    fail(`${path}.widgets`, 'a non-empty list of widgets');
  }

  const row: RowSpec = {
    widgets: widgets.map((widget, index) => parseWidget(widget, `${path}.widgets[${index}]`)),
  };
  if (input['height'] !== undefined) row.height = positiveNumber(input['height'], `${path}.height`);
  return row;
}

export interface ParseDashboardOptions {
  /** Used when the document does not name itself — normally the file name. */
  name?: string;
  /** Shown in error messages. */
  source?: string;
}

/** Parses a dashboard YAML document. */
export function parseDashboard(source: string, options: ParseDashboardOptions = {}): DashboardSpec {
  const label = options.source ?? 'dashboard';

  let document: unknown;
  try {
    document = parseYaml(source);
  } catch (error) {
    // The YAML parser's first line names the line and column, which is the
    // part worth surfacing.
    const detail = error instanceof Error ? error.message.split('\n')[0] : undefined;
    throw new NightshiftError('CONFIG_INVALID', `${label} is not valid YAML.`, {
      cause: error,
      ...(detail === undefined ? {} : { hint: detail }),
    });
  }

  if (!isRecord(document)) fail(label, 'a YAML mapping with a `rows` list');

  const name = document['name'] ?? options.name;
  if (typeof name !== 'string' || name.trim() === '') fail(`${label}.name`, 'a name');

  const rows = document['rows'];
  if (!Array.isArray(rows) || rows.length === 0) {
    fail(`${label}.rows`, 'a non-empty list of rows');
  }

  const dashboard: DashboardSpec = {
    version: DASHBOARD_SCHEMA_VERSION,
    name: name.trim(),
    rows: rows.map((row, index) => parseRow(row, `${label}.rows[${index}]`)),
  };

  if (document['version'] !== undefined) {
    const version = document['version'];
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      fail(`${label}.version`, 'a positive integer');
    }
    if (version > DASHBOARD_SCHEMA_VERSION) {
      fail(
        `${label}.version`,
        `at most ${DASHBOARD_SCHEMA_VERSION} (this Nightshift does not understand a newer schema)`,
      );
    }
    dashboard.version = version;
  }

  if (document['title'] !== undefined) {
    if (typeof document['title'] !== 'string') fail(`${label}.title`, 'a string');
    dashboard.title = document['title'];
  }
  if (document['theme'] !== undefined) {
    if (typeof document['theme'] !== 'string') fail(`${label}.theme`, 'a theme name');
    dashboard.theme = document['theme'];
  }
  if (document['refresh'] !== undefined) {
    const refresh = document['refresh'];
    if (typeof refresh !== 'number' || !Number.isFinite(refresh) || refresh < 0) {
      fail(`${label}.refresh`, 'a number of seconds, or 0 to disable');
    }
    dashboard.refresh = refresh;
  }

  return dashboard;
}

function serializeWidget(widget: WidgetSpec): Record<string, unknown> {
  const output: Record<string, unknown> = { type: widget.type };
  if (widget.title !== undefined) output['title'] = widget.title;
  if (widget.span !== undefined) output['span'] = widget.span;
  if (widget.minWidth !== undefined) output['minWidth'] = widget.minWidth;
  if (widget.minHeight !== undefined) output['minHeight'] = widget.minHeight;
  if (widget.entities !== undefined) output['entities'] = widget.entities;
  if (widget.options !== undefined) output['options'] = widget.options;
  if (widget.when !== undefined) output['when'] = widget.when;
  return output;
}

/**
 * The inverse of `parseDashboard` — always in the fully-explicit form (no
 * bare-string widgets, no bare-list rows), since a machine writing the file
 * has no reason to use the shorthand meant for a person typing it by hand.
 * Round-trips: `parseDashboard(serializeDashboard(spec))` describes the same
 * dashboard `spec` does, give or take key order.
 */
export function serializeDashboard(dashboard: DashboardSpec): string {
  const output: Record<string, unknown> = {
    version: dashboard.version ?? DASHBOARD_SCHEMA_VERSION,
    name: dashboard.name,
  };
  if (dashboard.title !== undefined) output['title'] = dashboard.title;
  if (dashboard.theme !== undefined) output['theme'] = dashboard.theme;
  if (dashboard.refresh !== undefined) output['refresh'] = dashboard.refresh;
  output['rows'] = dashboard.rows.map((row) => {
    const serialized: Record<string, unknown> = {};
    if (row.height !== undefined) serialized['height'] = row.height;
    serialized['widgets'] = row.widgets.map(serializeWidget);
    return serialized;
  });

  return stringifyYaml(output);
}

/**
 * Writes a dashboard to `<directory>/<name>.yaml`, creating the directory if
 * needed. This is the convention edit mode saves under — a dashboard whose
 * file does not already match `<name>.yaml` gets a new file rather than the
 * old one being overwritten, since nothing tracks a spec's original path.
 */
export async function saveDashboard(directory: string, dashboard: DashboardSpec): Promise<string> {
  const path = join(directory, `${dashboard.name}.yaml`);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path, serializeDashboard(dashboard), 'utf8');
  } catch (error) {
    throw new NightshiftError('CONFIG_UNWRITABLE', `Could not write ${path}.`, { cause: error });
  }
  return path;
}

const EXTENSIONS = new Set(['.yaml', '.yml']);

/** Reads and parses one dashboard file. */
export async function loadDashboardFile(path: string): Promise<DashboardSpec> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    throw new NightshiftError('DASHBOARD_NOT_FOUND', `Could not read ${path}.`, { cause: error });
  }
  return parseDashboard(source, { name: basename(path, extname(path)), source: path });
}

export interface DashboardLoadResult {
  dashboards: DashboardSpec[];
  /** Files that failed to parse, so the app can report them and carry on. */
  failed: { path: string; error: unknown }[];
}

/**
 * Loads every dashboard in a directory. A broken file is reported rather than
 * thrown, so one bad dashboard does not hide the rest.
 */
export async function loadDashboards(directory: string): Promise<DashboardLoadResult> {
  const result: DashboardLoadResult = { dashboards: [], failed: [] };

  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return result;
  }

  for (const entry of entries.sort()) {
    if (!EXTENSIONS.has(extname(entry))) continue;
    const path = join(directory, entry);
    try {
      result.dashboards.push(await loadDashboardFile(path));
    } catch (error) {
      result.failed.push({ path, error });
    }
  }

  return result;
}

/**
 * Combines dashboards loaded from disk with the built-ins, a user file
 * winning over a built-in of the same name rather than sitting alongside it
 * — the one merge rule `apps/cli`'s startup and `dashboard.reload` both need,
 * kept in one place so they cannot drift apart.
 */
export function mergeDashboards(
  loaded: readonly DashboardSpec[],
  builtIn: readonly DashboardSpec[],
): DashboardSpec[] {
  const names = new Set(loaded.map((dashboard) => dashboard.name));
  return [...loaded, ...builtIn.filter((dashboard) => !names.has(dashboard.name))].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
