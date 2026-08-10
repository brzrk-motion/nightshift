import { notImplemented, type Json } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';

/**
 * A vibe is a named state of the workspace: a theme, a dashboard, a set of
 * entity values, and a list of actions to fire on activation. Phase 4
 * implements loading and activation.
 */

export interface VibeAction {
  /** Command id to run, e.g. `focus.start`. */
  command: string;
  /** Arguments passed to the command. */
  args?: Record<string, Json>;
}

export interface VibeSpec {
  /** Unique vibe name, matching its file name. */
  name: string;
  title?: string;
  description?: string;
  /** Theme to switch to on activation. */
  theme?: string;
  /** Dashboard to open on activation. */
  dashboard?: string;
  /** Entity states applied on activation. */
  entities?: Record<EntityId, Json>;
  /** Commands run on activation, in order. */
  onActivate?: VibeAction[];
  /** Commands run when another vibe takes over. */
  onDeactivate?: VibeAction[];
}

/** Parses a vibe YAML document. Implemented in Phase 4. */
export function parseVibe(_source: string): VibeSpec {
  return notImplemented('Vibe parsing', 'Phase 4');
}

/** The three vibes a fresh install ships with. */
export const BUILT_IN_VIBES: readonly VibeSpec[] = [
  {
    name: 'locked-in',
    title: 'Locked In',
    description: 'Deep work. Timer running, nothing else asking for attention.',
    theme: 'midnight',
    dashboard: 'home',
    onActivate: [{ command: 'focus.start', args: { minutes: 50 } }],
  },
  {
    name: 'morning',
    title: 'Morning',
    description: 'Ease in. Today at a glance before the first session.',
    dashboard: 'home',
  },
  {
    name: 'night-shift',
    title: 'Night Shift',
    description: 'Late hours. Dimmed, quiet, long sessions.',
    theme: 'midnight',
    dashboard: 'home',
    onActivate: [{ command: 'focus.start', args: { minutes: 90 } }],
  },
];

export function findVibe(name: string): VibeSpec | undefined {
  return BUILT_IN_VIBES.find((vibe) => vibe.name === name);
}
