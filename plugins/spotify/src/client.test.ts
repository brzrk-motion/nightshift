import { describe, expect, it } from 'vitest';
import {
  formatProgress,
  mapCurrentlyPlaying,
  nextApiPath,
} from './client.js';

describe('nextApiPath', () => {
  it('strips the Spotify API host from a paging next URL', () => {
    expect(nextApiPath('https://api.spotify.com/v1/me/playlists?offset=50')).toBe(
      '/me/playlists?offset=50',
    );
  });

  it('passes through relative paths and null', () => {
    expect(nextApiPath('/me/shows?offset=50')).toBe('/me/shows?offset=50');
    expect(nextApiPath(null)).toBeNull();
    expect(nextApiPath(undefined)).toBeNull();
  });
});

describe('mapCurrentlyPlaying', () => {
  it('maps a track payload', () => {
    const player = mapCurrentlyPlaying({
      is_playing: true,
      progress_ms: 12_000,
      device: { name: 'Desktop' },
      item: {
        name: 'Song',
        type: 'track',
        duration_ms: 180_000,
        artists: [{ name: 'Artist' }],
      },
    });
    expect(player.isPlaying).toBe(true);
    expect(player.name).toBe('Song');
    expect(player.artists).toBe('Artist');
    expect(player.itemKind).toBe('track');
    expect(player.deviceName).toBe('Desktop');
  });

  it('maps an episode payload using the show name', () => {
    const player = mapCurrentlyPlaying({
      is_playing: false,
      item: {
        name: 'Ep 1',
        type: 'episode',
        duration_ms: 60_000,
        show: { name: 'Podcast' },
      },
    });
    expect(player.itemKind).toBe('episode');
    expect(player.artists).toBe('Podcast');
  });

  it('returns an idle player for empty payloads', () => {
    expect(mapCurrentlyPlaying(null).name).toBeNull();
    expect(mapCurrentlyPlaying({}).name).toBeNull();
  });
});

describe('formatProgress', () => {
  it('formats mm:ss pairs', () => {
    expect(formatProgress(65_000, 125_000)).toBe('1:05 / 2:05');
    expect(formatProgress(null, null)).toBe('—');
  });
});
