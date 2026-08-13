import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  deleteYamlResource,
  loadYamlDir,
  NightshiftError,
  saveYamlResource,
} from '@nightshift/core';
import {
  BUILT_IN_THEMES,
  HEX_COLOR,
  THEME_COLOR_KEYS,
  type Theme,
  type ThemeColors,
} from '../theme.js';
import type { ThemeSpec } from './schema.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, expected: string): never {
  throw new NightshiftError('CONFIG_INVALID', `${path} must be ${expected}.`, {
    hint: 'See the theme format in the Themes screen contract.',
  });
}

function normalizeHex(value: string, path: string): string {
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) {
    fail(path, 'a lowercase hex color like #7aa2ff');
  }
  return trimmed;
}

function parseColors(input: unknown, label: string): ThemeColors {
  if (!isRecord(input)) fail(`${label}.colors`, 'an object of color keys');

  const colors = {} as ThemeColors;
  for (const key of THEME_COLOR_KEYS) {
    const raw = input[key];
    if (typeof raw !== 'string') fail(`${label}.colors.${key}`, 'a hex color string');
    colors[key] = normalizeHex(raw, `${label}.colors.${key}`);
  }
  return colors;
}

export interface ParseThemeOptions {
  /** Used when the document does not name itself — normally the file name. */
  name?: string;
  /** Shown in error messages. */
  source?: string;
}

/** Parses a theme YAML document. */
export function parseTheme(source: string, options: ParseThemeOptions = {}): ThemeSpec {
  const label = options.source ?? 'theme';

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

  const appearance = document['appearance'];
  if (appearance !== 'dark' && appearance !== 'light') {
    fail(`${label}.appearance`, "'dark' or 'light'");
  }

  const colorsInput = document['colors'];
  if (colorsInput === undefined) fail(`${label}.colors`, 'an object of color keys');

  return {
    name: name.trim(),
    appearance,
    colors: parseColors(colorsInput, label),
  };
}

/** Writes a theme as YAML. Round-trips through `parseTheme`. */
export function serializeTheme(theme: ThemeSpec): string {
  const colors: Record<string, string> = {};
  for (const key of THEME_COLOR_KEYS) colors[key] = theme.colors[key];
  return stringifyYaml({
    name: theme.name,
    appearance: theme.appearance,
    colors,
  });
}

/**
 * Writes a theme to `<directory>/<name>.yaml`, creating the directory if
 * needed. A user file of the same name replaces a built-in on the next load.
 */
export async function saveTheme(directory: string, theme: ThemeSpec): Promise<string> {
  return saveYamlResource(directory, theme.name, serializeTheme(theme));
}

/** Removes `themes/<name>.yaml`. Refused when the file does not exist. */
export async function deleteTheme(directory: string, name: string): Promise<void> {
  return deleteYamlResource(directory, name, {
    notFoundCode: 'CONFIG_INVALID',
    notFoundMessage: (path) => `No user theme file at ${path}.`,
    notFoundHint: 'Built-in themes cannot be deleted unless you have saved a user override.',
  });
}

/** Reads and parses one theme file. */
export async function loadThemeFile(path: string): Promise<ThemeSpec> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    throw new NightshiftError('CONFIG_INVALID', `Could not read ${path}.`, { cause: error });
  }
  return parseTheme(source, { name: basename(path, extname(path)), source: path });
}

export interface ThemeLoadResult {
  themes: ThemeSpec[];
  /** Files that failed to parse, so the app can report them and carry on. */
  failed: { path: string; error: unknown }[];
}

/**
 * Loads every theme in a directory. A broken file is reported rather than
 * thrown, so one bad theme does not hide the rest.
 */
export async function loadThemes(directory: string): Promise<ThemeLoadResult> {
  const { items, failed } = await loadYamlDir(directory, loadThemeFile);
  return { themes: items, failed };
}

/**
 * Merges user themes over built-ins by name. User files replace built-ins
 * of the same name rather than appearing alongside them.
 */
export function mergeThemes(
  userThemes: readonly ThemeSpec[],
  builtIn: readonly Theme[],
): ThemeSpec[] {
  const registry = new Map<string, ThemeSpec>(builtIn.map((theme) => [theme.name, theme]));
  for (const theme of userThemes) registry.set(theme.name, theme);
  return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export { BUILT_IN_THEMES };
