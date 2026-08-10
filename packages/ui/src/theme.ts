import { NightshiftError } from '@nightshift/core';

/**
 * Themes are plain data: a palette every component reads from, and nothing
 * else. Keeping them declarative means a dashboard, a vibe or a plugin can
 * switch the whole look by naming one.
 */
export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

export interface Theme {
  name: string;
  /** Hints the terminal about the surrounding colour scheme. */
  appearance: 'dark' | 'light';
  colors: ThemeColors;
}

/** The default theme — deep blues, low glare, made for working after dark. */
export const MIDNIGHT_THEME: Theme = {
  name: 'midnight',
  appearance: 'dark',
  colors: {
    background: '#0b1020',
    surface: '#141a2e',
    border: '#243050',
    text: '#e6ebff',
    muted: '#8b95b8',
    accent: '#7aa2ff',
    success: '#5ad19b',
    warning: '#f2c66b',
    danger: '#ff6b81',
  },
};

/** Warmer and dimmer than midnight, for the small hours. */
export const EMBER_THEME: Theme = {
  name: 'ember',
  appearance: 'dark',
  colors: {
    background: '#17110f',
    surface: '#231a17',
    border: '#3d2c25',
    text: '#f4e7de',
    muted: '#a8907f',
    accent: '#ff9e64',
    success: '#9ece6a',
    warning: '#e0af68',
    danger: '#f7768e',
  },
};

/** For daylight and for terminals with a light background. */
export const DAYLIGHT_THEME: Theme = {
  name: 'daylight',
  appearance: 'light',
  colors: {
    background: '#fbfbfd',
    surface: '#f0f1f6',
    border: '#d3d6e0',
    text: '#1b1f2a',
    muted: '#5f6675',
    accent: '#2f5bd7',
    success: '#1f8a5f',
    warning: '#9a6700',
    danger: '#c0323c',
  },
};

export const BUILT_IN_THEMES: readonly Theme[] = [MIDNIGHT_THEME, EMBER_THEME, DAYLIGHT_THEME];

export function getTheme(name: string): Theme | undefined {
  return BUILT_IN_THEMES.find((theme) => theme.name === name);
}

/** A theme with some colours overridden — how a vibe tints the workspace. */
export interface ThemeOverride {
  name?: string;
  appearance?: Theme['appearance'];
  colors?: Partial<ThemeColors>;
}

export function extendTheme(base: Theme, override: ThemeOverride): Theme {
  return {
    name: override.name ?? base.name,
    appearance: override.appearance ?? base.appearance,
    colors: { ...base.colors, ...override.colors },
  };
}

/**
 * The theme engine: holds the active theme, resolves names, and tells
 * subscribers when it changes. The shell owns one of these; components read it
 * through `useTheme()`.
 */
export interface ThemeEngine {
  readonly current: Theme;
  /** Every theme this engine can resolve, built-in and registered. */
  list(): Theme[];
  resolve(name: string): Theme | undefined;
  register(theme: Theme): void;
  /** Switches the active theme. Unknown names throw. */
  activate(name: string): Theme;
  /** Applies an override on top of the active theme. */
  override(override: ThemeOverride): Theme;
  subscribe(listener: (theme: Theme) => void): () => void;
}

export interface ThemeEngineOptions {
  /** Name of the theme to start on. Falls back to midnight when unknown. */
  initial?: string;
  /** Themes to register beyond the built-ins. */
  themes?: readonly Theme[];
}

export function createThemeEngine(options: ThemeEngineOptions = {}): ThemeEngine {
  const registry = new Map<string, Theme>(BUILT_IN_THEMES.map((theme) => [theme.name, theme]));
  for (const theme of options.themes ?? []) registry.set(theme.name, theme);

  let current = (options.initial ? registry.get(options.initial) : undefined) ?? MIDNIGHT_THEME;
  const listeners = new Set<(theme: Theme) => void>();

  const publish = (theme: Theme): Theme => {
    current = theme;
    for (const listener of [...listeners]) listener(theme);
    return theme;
  };

  return {
    get current() {
      return current;
    },
    list: () => [...registry.values()],
    resolve: (name) => registry.get(name),
    register(theme) {
      registry.set(theme.name, theme);
      if (theme.name === current.name) publish(theme);
    },
    activate(name) {
      const theme = registry.get(name);
      if (!theme) {
        throw new NightshiftError('CONFIG_INVALID', `No theme named "${name}".`, {
          hint: `Available themes: ${[...registry.keys()].join(', ')}.`,
        });
      }
      return publish(theme);
    },
    override(override) {
      return publish(extendTheme(current, override));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
