import type { ReactNode } from 'react';

/**
 * A small, fixed set of glyphs used as icons throughout the shell. Terminal
 * "icons" are just characters, so this is a lookup table rather than an asset
 * pipeline — and every glyph in it is a block/geometric-shapes character
 * already used elsewhere in Nightshift (charts, badges, the palette), which is
 * the actual test of "renders everywhere a terminal does."
 */
export const ICONS = {
  dashboard: '▦',
  vibes: '◈',
  apps: '▣',
  entities: '◆',
  automations: '⚡',
  settings: '⚙',
  play: '▶',
  pause: '⏸',
  stop: '■',
  reset: '↺',
  check: '✔',
  cross: '✖',
  warning: '!',
  info: '·',
  dot: '●',
} as const;

export type IconName = keyof typeof ICONS;

/** The glyph for a name, or a plain-text fallback for one that is not known. */
export function iconGlyph(name: IconName | string, fallback?: string): string {
  return (ICONS as Record<string, string>)[name] ?? fallback ?? name.slice(0, 1).toUpperCase();
}

export interface IconProps {
  name: IconName | string;
  /** Shown instead of a glyph lookup, or when `name` is not a known icon. */
  fallback?: string;
  color?: string;
}

/** Renders one glyph. A plain `<text>` under the hood — this exists so every
 * call site names an icon by intent rather than picking a character by hand. */
export function Icon({ name, fallback, color }: IconProps): ReactNode {
  return <text {...(color === undefined ? {} : { fg: color })}>{iconGlyph(name, fallback)}</text>;
}
