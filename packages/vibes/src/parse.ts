import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { NightshiftError, type Json } from '@nightshift/core';
import { isEntityId, type EntityId } from '@nightshift/entities';
import type { VibeAction, VibeSpec } from './schema.js';

/**
 * Parsing and validating vibe files. Mirrors the dashboard parser: strict
 * validation with errors that name the exact path that is wrong, because a
 * vibe is a file people edit by hand.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, expected: string): never {
  throw new NightshiftError('CONFIG_INVALID', `${path} must be ${expected}.`, {
    hint: 'See the vibe guide for the file format.',
  });
}

function parseAction(input: unknown, path: string): VibeAction {
  // `- focus.start` is shorthand for `- command: focus.start`.
  if (typeof input === 'string') {
    if (input.trim() === '') fail(path, 'a command id');
    return { command: input.trim() };
  }
  if (!isRecord(input)) fail(path, 'a command id or an action object');

  const command = input['command'];
  if (typeof command !== 'string' || command.trim() === '') {
    fail(`${path}.command`, 'a command id');
  }

  const action: VibeAction = { command: command.trim() };
  if (input['args'] !== undefined) {
    if (!isRecord(input['args'])) fail(`${path}.args`, 'an object');
    action.args = input['args'] as Record<string, Json>;
  }
  return action;
}

function parseActions(input: unknown, path: string): VibeAction[] {
  if (!Array.isArray(input)) fail(path, 'a list of commands');
  return input.map((action, index) => parseAction(action, `${path}[${index}]`));
}

function parseEntities(input: unknown, path: string): Record<EntityId, Record<string, Json>> {
  if (!isRecord(input)) fail(path, 'an object keyed by entity id');

  const entities: Record<EntityId, Record<string, Json>> = {};
  for (const [id, state] of Object.entries(input)) {
    if (!isEntityId(id)) fail(`${path}.${id}`, 'an entity id like `timer.focus`');
    if (!isRecord(state)) fail(`${path}.${id}`, 'an object of state to merge in');
    entities[id] = state as Record<string, Json>;
  }
  return entities;
}

export interface ParseVibeOptions {
  /** Used when the document does not name itself — normally the file name. */
  name?: string;
  /** Shown in error messages. */
  source?: string;
}

/** Parses a vibe YAML document. */
export function parseVibe(source: string, options: ParseVibeOptions = {}): VibeSpec {
  const label = options.source ?? 'vibe';

  let document: unknown;
  try {
    document = parseYaml(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : undefined;
    throw new NightshiftError('CONFIG_INVALID', `${label} is not valid YAML.`, {
      cause: error,
      ...(detail === undefined ? {} : { hint: detail }),
    });
  }

  if (!isRecord(document)) fail(label, 'a YAML mapping');

  const name = document['name'] ?? options.name;
  if (typeof name !== 'string' || name.trim() === '') fail(`${label}.name`, 'a name');

  const vibe: VibeSpec = { name: name.trim() };

  if (document['title'] !== undefined) {
    if (typeof document['title'] !== 'string') fail(`${label}.title`, 'a string');
    vibe.title = document['title'];
  }
  if (document['description'] !== undefined) {
    if (typeof document['description'] !== 'string') fail(`${label}.description`, 'a string');
    vibe.description = document['description'];
  }
  if (document['theme'] !== undefined) {
    if (typeof document['theme'] !== 'string') fail(`${label}.theme`, 'a theme name');
    vibe.theme = document['theme'];
  }
  if (document['dashboard'] !== undefined) {
    if (typeof document['dashboard'] !== 'string') fail(`${label}.dashboard`, 'a dashboard name');
    vibe.dashboard = document['dashboard'];
  }
  if (document['entities'] !== undefined) {
    vibe.entities = parseEntities(document['entities'], `${label}.entities`);
  }
  if (document['onActivate'] !== undefined) {
    vibe.onActivate = parseActions(document['onActivate'], `${label}.onActivate`);
  }
  if (document['onDeactivate'] !== undefined) {
    vibe.onDeactivate = parseActions(document['onDeactivate'], `${label}.onDeactivate`);
  }

  return vibe;
}

function serializeAction(action: VibeAction): Record<string, unknown> | string {
  // Canonical form always uses an object when args are present; bare command
  // ids stay as strings so hand-edited files stay short.
  if (action.args === undefined) return action.command;
  return { command: action.command, args: action.args };
}

/**
 * Writes a vibe as YAML. Round-trips: `parseVibe(serializeVibe(spec))`
 * describes the same vibe `spec` does, give or take key order and action
 * shorthand expansion.
 */
export function serializeVibe(vibe: VibeSpec): string {
  const output: Record<string, unknown> = { name: vibe.name };
  if (vibe.title !== undefined) output['title'] = vibe.title;
  if (vibe.description !== undefined) output['description'] = vibe.description;
  if (vibe.theme !== undefined) output['theme'] = vibe.theme;
  if (vibe.dashboard !== undefined) output['dashboard'] = vibe.dashboard;
  if (vibe.entities !== undefined) output['entities'] = vibe.entities;
  if (vibe.onActivate !== undefined) {
    output['onActivate'] = vibe.onActivate.map(serializeAction);
  }
  if (vibe.onDeactivate !== undefined) {
    output['onDeactivate'] = vibe.onDeactivate.map(serializeAction);
  }
  return stringifyYaml(output);
}

/**
 * Writes a vibe to `<directory>/<name>.yaml`, creating the directory if
 * needed. A user file of the same name replaces a built-in on the next load.
 */
export async function saveVibe(directory: string, vibe: VibeSpec): Promise<string> {
  const path = join(directory, `${vibe.name}.yaml`);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path, serializeVibe(vibe), 'utf8');
  } catch (error) {
    throw new NightshiftError('CONFIG_UNWRITABLE', `Could not write ${path}.`, { cause: error });
  }
  return path;
}

const EXTENSIONS = new Set(['.yaml', '.yml']);

/** Reads and parses one vibe file. */
export async function loadVibeFile(path: string): Promise<VibeSpec> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    throw new NightshiftError('VIBE_NOT_FOUND', `Could not read ${path}.`, { cause: error });
  }
  return parseVibe(source, { name: basename(path, extname(path)), source: path });
}

export interface VibeLoadResult {
  vibes: VibeSpec[];
  /** Files that failed to parse, so the app can report them and carry on. */
  failed: { path: string; error: unknown }[];
}

/**
 * Loads every vibe in a directory. A broken file is reported rather than
 * thrown, so one bad vibe does not hide the rest.
 */
export async function loadVibes(directory: string): Promise<VibeLoadResult> {
  const result: VibeLoadResult = { vibes: [], failed: [] };

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
      result.vibes.push(await loadVibeFile(path));
    } catch (error) {
      result.failed.push({ path, error });
    }
  }

  return result;
}
