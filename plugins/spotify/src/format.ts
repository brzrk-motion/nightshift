import type { SpotifyPlayerState } from './entity.js';

/** How much room the widget has, which decides how much of the hero survives. */
export type SpotifyLayout = 'compact' | 'regular' | 'wide';

export function resolveLayout(width: number, height: number): SpotifyLayout {
  if (width < 44 || height < 8) return 'compact';
  if (width >= 72 && height >= 14) return 'wide';
  return 'regular';
}

/**
 * Where playback has reached *now*, rather than when the poll last landed.
 * The player entity only updates every few seconds, so without this the
 * progress bar sits still and then jumps.
 */
export function interpolateProgress(player: SpotifyPlayerState, now: number): number | null {
  if (player.progressMs === null) return null;
  if (!player.isPlaying || player.updatedAt === null) return player.progressMs;

  const polledAt = Date.parse(player.updatedAt);
  if (Number.isNaN(polledAt)) return player.progressMs;

  const elapsed = Math.max(0, now - polledAt);
  const advanced = player.progressMs + elapsed;
  return player.durationMs === null ? advanced : Math.min(advanced, player.durationMs);
}

/** Progress as 0–1, safe for a duration that is missing or zero. */
export function progressRatio(progressMs: number | null, durationMs: number | null): number {
  if (progressMs === null || durationMs === null || durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, progressMs / durationMs));
}

/** How long Spotify needs before a transport command shows up in its own
 * player state. Long enough to have caught up, short enough to feel immediate. */
export const PLAYER_SETTLE_MS = 800;

/** Poll hard enough to track a playing track, gently when nothing is on. */
export function pollIntervalMs(isPlaying: boolean): number {
  return isPlaying ? 2_000 : 10_000;
}

/** Clips a label to the cells available, leaving room for an ellipsis. */
export function clip(text: string, width: number): string {
  if (width <= 0) return '';
  const characters = [...text];
  if (characters.length <= width) return text;
  if (width === 1) return '…';
  return `${characters.slice(0, width - 1).join('')}…`;
}
