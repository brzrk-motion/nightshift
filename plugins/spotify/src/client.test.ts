import { describe, expect, it, vi } from 'vitest';
import {
  SpotifyApiError,
  fetchCurrentlyPlaying,
  fetchPlaylists,
  fetchShowEpisodes,
  fetchShows,
  formatProgress,
  mapCurrentlyPlaying,
  nextApiPath,
  parseSpotifyErrorMessage,
  pickDeviceId,
  play,
  playContext,
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

describe('parseSpotifyErrorMessage', () => {
  it('reads message and reason from a Spotify error body', () => {
    expect(
      parseSpotifyErrorMessage(
        404,
        JSON.stringify({
          error: {
            status: 404,
            message: 'Player command failed: No active device found',
            reason: 'NO_ACTIVE_DEVICE',
          },
        }),
      ),
    ).toEqual({
      message: 'Player command failed: No active device found (NO_ACTIVE_DEVICE)',
      reason: 'NO_ACTIVE_DEVICE',
    });
  });

  it('falls back when the body is not JSON', () => {
    expect(parseSpotifyErrorMessage(500, 'boom')).toEqual({
      message: 'boom',
      reason: null,
    });
  });
});

describe('SpotifyApiError', () => {
  it('flags NO_ACTIVE_DEVICE 404s', () => {
    const error = new SpotifyApiError(
      404,
      JSON.stringify({
        error: { message: 'No active device found', reason: 'NO_ACTIVE_DEVICE' },
      }),
    );
    expect(error.noActiveDevice).toBe(true);
    expect(error.message).toContain('No active device found');
  });
});

describe('pickDeviceId', () => {
  it('prefers the active device, else the first one', () => {
    expect(
      pickDeviceId([
        { id: 'a', name: 'A', isActive: false },
        { id: 'b', name: 'B', isActive: true },
      ]),
    ).toBe('b');
    expect(pickDeviceId([{ id: 'a', name: 'A', isActive: false }])).toBe('a');
    expect(pickDeviceId([])).toBeUndefined();
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

describe('play', () => {
  it('targets an available device via device_id', async () => {
    const fetchFn = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (url.includes('/me/player/devices')) {
        return new Response(
          JSON.stringify({
            devices: [{ id: 'dev-1', name: 'Laptop', is_active: false }],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/me/player/play')) {
        expect(url).toContain('device_id=dev-1');
        expect(init?.method).toBe('PUT');
        expect(JSON.parse(init?.body ?? '{}')).toEqual({
          context_uri: 'spotify:playlist:abc',
        });
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected ${url}`);
    });

    await play(fetchFn, 'token', { contextUri: 'spotify:playlist:abc' });
    expect(fetchFn).toHaveBeenCalled();
  });

  it('throws a clear error when no devices are available', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('/me/player/devices')) {
        return new Response(JSON.stringify({ devices: [] }), { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    });

    await expect(play(fetchFn, 'token')).rejects.toMatchObject({
      noActiveDevice: true,
      message: expect.stringContaining('Open the Spotify app'),
    });
  });
});

describe('playContext', () => {
  it('plays shows via episode uris instead of context_uri', async () => {
    const fetchFn = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (url.includes('/shows/show1/episodes')) {
        return new Response(
          JSON.stringify({
            items: [
              { id: 'e1', name: 'One', uri: 'spotify:episode:e1' },
              { id: 'e2', name: 'Two', uri: 'spotify:episode:e2' },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/me/player/devices')) {
        return new Response(
          JSON.stringify({ devices: [{ id: 'dev-1', name: 'Phone', is_active: true }] }),
          { status: 200 },
        );
      }
      if (url.includes('/me/player/play')) {
        expect(JSON.parse(init?.body ?? '{}')).toEqual({
          uris: ['spotify:episode:e1', 'spotify:episode:e2'],
        });
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected ${url}`);
    });

    await playContext(fetchFn, 'token', 'spotify:show:show1');
  });
});

describe('fetchCurrentlyPlaying', () => {
  it('asks for episodes as well as tracks, and maps a playing episode', async () => {
    const fetchFn = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify({
            is_playing: true,
            progress_ms: 1_000,
            device: { name: 'Laptop' },
            item: {
              name: 'Episode One',
              duration_ms: 1_800_000,
              type: 'episode',
              show: { name: 'Deep Work' },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const player = await fetchCurrentlyPlaying(fetchFn, 'token');
    expect(fetchFn.mock.calls[0]?.[0]).toContain('additional_types=track,episode');
    expect(player).toMatchObject({
      isPlaying: true,
      name: 'Episode One',
      artists: 'Deep Work',
      itemKind: 'episode',
      deviceName: 'Laptop',
    });
  });
});

describe('library mapping', () => {
  const json = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body)));

  it('skips null playlist entries', async () => {
    const fetchFn = json({
      items: [null, { id: 'p1', name: 'Focus', uri: 'spotify:playlist:p1', tracks: { total: 3 } }],
      next: null,
    });
    await expect(fetchPlaylists(fetchFn, 'token')).resolves.toEqual([
      { id: 'p1', name: 'Focus', uri: 'spotify:playlist:p1', kind: 'playlist', meta: '3 tracks' },
    ]);
  });

  it('skips null show entries and null shows', async () => {
    const fetchFn = json({
      items: [
        null,
        { show: null },
        { show: { id: 's1', name: 'Deep Work', uri: 'spotify:show:s1', publisher: 'Studio' } },
      ],
      next: null,
    });
    await expect(fetchShows(fetchFn, 'token')).resolves.toEqual([
      { id: 's1', name: 'Deep Work', uri: 'spotify:show:s1', kind: 'show', meta: 'Studio' },
    ]);
  });

  it('maps episodes with duration and release date, skipping nulls', async () => {
    const fetchFn = json({
      items: [
        null,
        {
          id: 'e1',
          name: 'Episode One',
          uri: 'spotify:episode:e1',
          duration_ms: 1_800_000,
          release_date: '2026-08-01',
        },
      ],
    });
    await expect(fetchShowEpisodes(fetchFn, 'token', 'show1')).resolves.toEqual([
      {
        id: 'e1',
        name: 'Episode One',
        uri: 'spotify:episode:e1',
        kind: 'episode',
        meta: '30 min · 2026-08-01',
      },
    ]);
  });
});
