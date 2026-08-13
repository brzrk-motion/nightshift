import { describe, expect, it, vi } from 'vitest';
import { isNightshiftError } from '@nightshift/core';
import {
  BUILT_IN_THEMES,
  createThemeEngine,
  extendTheme,
  getTheme,
  MIDNIGHT_THEME,
} from './theme.js';

describe('themes', () => {
  it('ships midnight as the default and finds it by name', () => {
    expect(getTheme('midnight')).toBe(MIDNIGHT_THEME);
    expect(getTheme('nope')).toBeUndefined();
  });

  it('gives every built-in theme a full palette', () => {
    for (const theme of BUILT_IN_THEMES) {
      for (const [key, value] of Object.entries(theme.colors)) {
        expect(value, `${theme.name}.${key}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('overrides only the colours it is given', () => {
    const tinted = extendTheme(MIDNIGHT_THEME, { name: 'tinted', colors: { accent: '#ff0000' } });

    expect(tinted.name).toBe('tinted');
    expect(tinted.colors.accent).toBe('#ff0000');
    expect(tinted.colors.text).toBe(MIDNIGHT_THEME.colors.text);
  });
});

describe('createThemeEngine', () => {
  it('starts on the requested theme', () => {
    expect(createThemeEngine({ initial: 'daylight' }).current.name).toBe('daylight');
  });

  it('falls back to midnight for an unknown initial theme', () => {
    expect(createThemeEngine({ initial: 'nope' }).current.name).toBe('midnight');
  });

  it('activates a theme and tells subscribers', () => {
    const engine = createThemeEngine();
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.activate('ember');

    expect(engine.current.name).toBe('ember');
    expect(listener).toHaveBeenCalledWith(engine.current);
  });

  it('throws on an unknown theme, listing what is available', () => {
    const engine = createThemeEngine();

    expect(() => engine.activate('nope')).toThrowError(/No theme named "nope"/);
    try {
      engine.activate('nope');
    } catch (error) {
      expect(isNightshiftError(error) && error.hint).toMatch(/midnight/);
    }
  });

  it('registers extra themes and can activate them', () => {
    const engine = createThemeEngine();
    engine.register({ ...MIDNIGHT_THEME, name: 'custom' });

    expect(engine.activate('custom').name).toBe('custom');
    expect(engine.list().map((theme) => theme.name)).toContain('custom');
  });

  it('stops notifying after unsubscribe', () => {
    const engine = createThemeEngine();
    const listener = vi.fn();
    engine.subscribe(listener)();

    engine.activate('ember');

    expect(listener).not.toHaveBeenCalled();
  });
});
