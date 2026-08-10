import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { NightshiftError, type Json } from '@nightshift/core';
import { isEntityId, type EntityId } from '@nightshift/entities';
import type { DashboardSpec, RowSpec, WidgetSpec } from './schema.js';

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
    name: name.trim(),
    rows: rows.map((row, index) => parseRow(row, `${label}.rows[${index}]`)),
  };

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
