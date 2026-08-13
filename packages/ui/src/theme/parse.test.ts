import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MIDNIGHT_THEME } from '../theme.js';
import {
  deleteTheme,
  loadThemes,
  mergeThemes,
  parseTheme,
  saveTheme,
  serializeTheme,
} from './parse.js';

describe('parseTheme', () => {
  it('parses a valid theme document', () => {
    const source = serializeTheme(MIDNIGHT_THEME);
    const theme = parseTheme(source);
    expect(theme.name).toBe('midnight');
    expect(theme.appearance).toBe('dark');
    expect(theme.colors.accent).toBe('#7aa2ff');
  });

  it('rejects invalid hex colors', () => {
    const source = serializeTheme(MIDNIGHT_THEME).replace('#7aa2ff', '#GGGGGG');
    expect(() => parseTheme(source)).toThrow(/hex color/);
  });

  it('requires all color keys', () => {
    const source = `name: sparse\nappearance: dark\ncolors:\n  background: '#0b1020'\n`;
    expect(() => parseTheme(source)).toThrow(/colors\./);
  });
});

describe('serializeTheme round-trip', () => {
  it('round-trips through parseTheme', () => {
    const theme = {
      ...MIDNIGHT_THEME,
      name: 'forest',
      colors: { ...MIDNIGHT_THEME.colors, accent: '#5ad19b' },
    };
    expect(parseTheme(serializeTheme(theme))).toEqual(theme);
  });
});

describe('saveTheme and deleteTheme', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-themes-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes and reads a theme file', async () => {
    const theme = { ...MIDNIGHT_THEME, name: 'forest' };
    await saveTheme(dir, theme);
    const loaded = await loadThemes(dir);
    expect(loaded.themes).toHaveLength(1);
    expect(loaded.themes[0]?.name).toBe('forest');
  });

  it('deletes a user theme file', async () => {
    const theme = { ...MIDNIGHT_THEME, name: 'forest' };
    await saveTheme(dir, theme);
    await deleteTheme(dir, 'forest');
    const loaded = await loadThemes(dir);
    expect(loaded.themes).toHaveLength(0);
  });

  it('refuses to delete a missing file', async () => {
    await expect(deleteTheme(dir, 'missing')).rejects.toThrow(/No user theme file/);
  });
});

describe('loadThemes', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-themes-'));
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports broken files without throwing', async () => {
    await writeFile(join(dir, 'bad.yaml'), 'appearance: dark');
    const result = await loadThemes(dir);
    expect(result.themes).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });
});

describe('mergeThemes', () => {
  it('lets user themes override built-ins by name', () => {
    const user = [
      {
        ...MIDNIGHT_THEME,
        name: 'midnight',
        colors: { ...MIDNIGHT_THEME.colors, accent: '#ffffff' },
      },
    ];
    const merged = mergeThemes(user, [MIDNIGHT_THEME]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.colors.accent).toBe('#ffffff');
  });
});
