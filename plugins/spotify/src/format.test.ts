import { describe, expect, it } from 'vitest';
import { initialPlayerState } from './entity.js';
import {
  clip,
  interpolateProgress,
  pollIntervalMs,
  progressRatio,
  resolveLayout,
} from './format.js';

describe('resolveLayout', () => {
  it('falls back to compact in a small slot', () => {
    expect(resolveLayout(30, 20)).toBe('compact');
    expect(resolveLayout(80, 6)).toBe('compact');
  });

  it('uses wide only when there is room for the full hero', () => {
    expect(resolveLayout(72, 14)).toBe('wide');
    expect(resolveLayout(60, 14)).toBe('regular');
    expect(resolveLayout(90, 10)).toBe('regular');
  });
});

describe('interpolateProgress', () => {
  const polledAt = '2026-08-10T12:00:00.000Z';
  const now = Date.parse(polledAt) + 3_000;

  it('advances a playing track by the time since the poll', () => {
    const player = {
      ...initialPlayerState(),
      isPlaying: true,
      progressMs: 30_000,
      durationMs: 180_000,
      updatedAt: polledAt,
    };
    expect(interpolateProgress(player, now)).toBe(33_000);
  });

  it('holds still while paused', () => {
    const player = {
      ...initialPlayerState(),
      isPlaying: false,
      progressMs: 30_000,
      durationMs: 180_000,
      updatedAt: polledAt,
    };
    expect(interpolateProgress(player, now)).toBe(30_000);
  });

  it('never runs past the end of the track', () => {
    const player = {
      ...initialPlayerState(),
      isPlaying: true,
      progressMs: 179_000,
      durationMs: 180_000,
      updatedAt: polledAt,
    };
    expect(interpolateProgress(player, now)).toBe(180_000);
  });

  it('returns null when nothing is playing', () => {
    expect(interpolateProgress(initialPlayerState(), now)).toBeNull();
  });
});

describe('progressRatio', () => {
  it('maps progress into 0–1', () => {
    expect(progressRatio(30_000, 120_000)).toBe(0.25);
  });

  it('is zero for missing or zero durations', () => {
    expect(progressRatio(30_000, null)).toBe(0);
    expect(progressRatio(30_000, 0)).toBe(0);
    expect(progressRatio(null, 120_000)).toBe(0);
  });
});

describe('pollIntervalMs', () => {
  it('polls faster while playing', () => {
    expect(pollIntervalMs(true)).toBeLessThan(pollIntervalMs(false));
  });
});

describe('clip', () => {
  it('leaves short text alone', () => {
    expect(clip('Focus', 10)).toBe('Focus');
  });

  it('ellipsises text that does not fit', () => {
    expect(clip('Deep Work Sessions', 8)).toBe('Deep Wo…');
    expect(clip('anything', 1)).toBe('…');
    expect(clip('anything', 0)).toBe('');
  });
});
