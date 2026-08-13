import { MIDNIGHT_THEME, type Theme } from '../theme.js';

/** On-disk and in-engine theme document — same shape as `Theme`. */
export type ThemeSpec = Theme;

/** Seeds new theme drafts from the midnight palette. */
export function themeFromMidnight(name?: string): ThemeSpec {
  return {
    ...MIDNIGHT_THEME,
    name: name ?? '',
  };
}
