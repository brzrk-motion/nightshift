import type { Json } from '@nightshift/core';

/**
 * Terminal component library. Phase 1 fixes the theme contract that every
 * component and dashboard reads from; the components themselves land in
 * Phase 3, once the OpenTUI renderer exists.
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

export const BUILT_IN_THEMES: readonly Theme[] = [MIDNIGHT_THEME];

export function getTheme(name: string): Theme | undefined {
  return BUILT_IN_THEMES.find((theme) => theme.name === name);
}

/** Props shared by every Nightshift component. */
export interface ComponentProps {
  key?: string;
  testId?: string;
}

/** Names of the components Phase 3 delivers. */
export const COMPONENT_TYPES = [
  'card',
  'panel',
  'button',
  'toggle',
  'progress',
  'tabs',
  'input',
  'table',
  'list',
  'badge',
  'sparkline',
  'line-chart',
  'bar-chart',
  'modal',
  'toast',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export type ComponentOptions = Record<string, Json>;
