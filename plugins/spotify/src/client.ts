import type { PluginFetchInit } from '@nightshift/sdk';
import type {
  SpotifyItemKind,
  SpotifyLibraryItem,
  SpotifyLibraryState,
  SpotifyPlayerState,
} from './entity.js';
import { initialLibraryState, initialPlayerState } from './entity.js';

export type SpotifyFetch = (url: string, init?: PluginFetchInit) => Promise<Response>;

const API = 'https://api.spotify.com/v1';

export class SpotifyApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Spotify API error (${status})`);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.body = body;
  }

  get premiumRequired(): boolean {
    return this.status === 403;
  }
}

async function api(
  fetchFn: SpotifyFetch,
  accessToken: string,
  path: string,
  init?: PluginFetchInit,
): Promise<Response> {
  const response = await fetchFn(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  return response;
}

async function readError(response: Response): Promise<never> {
  const body = await response.text();
  throw new SpotifyApiError(response.status, body);
}

/** Empty 204/200 responses are success for player control endpoints. */
async function ensureOk(response: Response): Promise<void> {
  if (response.status === 204 || response.ok) return;
  await readError(response);
}

export interface SpotifyProfile {
  id: string;
  displayName: string;
}

export async function fetchProfile(
  fetchFn: SpotifyFetch,
  accessToken: string,
): Promise<SpotifyProfile> {
  const response = await api(fetchFn, accessToken, '/me');
  if (!response.ok) await readError(response);
  const body = (await response.json()) as { id?: string; display_name?: string };
  return {
    id: body.id ?? '',
    displayName: body.display_name ?? body.id ?? 'Spotify user',
  };
}

interface CurrentlyPlayingJson {
  is_playing?: boolean;
  progress_ms?: number | null;
  device?: { name?: string } | null;
  context?: { uri?: string | null; type?: string | null } | null;
  item?: {
    name?: string;
    duration_ms?: number;
    type?: string;
    artists?: Array<{ name?: string }>;
    show?: { name?: string };
  } | null;
}

export function mapCurrentlyPlaying(body: CurrentlyPlayingJson | null): SpotifyPlayerState {
  if (!body || !body.item) {
    return {
      ...initialPlayerState(),
      updatedAt: new Date().toISOString(),
    };
  }

  const item = body.item;
  const kind: SpotifyItemKind =
    item.type === 'track' ? 'track' : item.type === 'episode' ? 'episode' : 'unknown';
  const artists =
    kind === 'episode'
      ? (item.show?.name ?? null)
      : (item.artists?.map((a) => a.name).filter(Boolean).join(', ') ?? null);

  return {
    isPlaying: Boolean(body.is_playing),
    name: item.name ?? null,
    artists,
    progressMs: typeof body.progress_ms === 'number' ? body.progress_ms : null,
    durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : null,
    deviceName: body.device?.name ?? null,
    itemKind: kind,
    contextUri: body.context?.uri ?? null,
    contextName: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchCurrentlyPlaying(
  fetchFn: SpotifyFetch,
  accessToken: string,
): Promise<SpotifyPlayerState> {
  const response = await api(fetchFn, accessToken, '/me/player/currently-playing');
  if (response.status === 204) {
    return { ...initialPlayerState(), updatedAt: new Date().toISOString() };
  }
  if (!response.ok) await readError(response);
  const body = (await response.json()) as CurrentlyPlayingJson;
  return mapCurrentlyPlaying(body);
}

export async function play(
  fetchFn: SpotifyFetch,
  accessToken: string,
  options?: { contextUri?: string },
): Promise<void> {
  const body =
    options?.contextUri === undefined
      ? undefined
      : JSON.stringify({ context_uri: options.contextUri });
  const response = await api(fetchFn, accessToken, '/me/player/play', {
    method: 'PUT',
    ...(body === undefined ? {} : { body }),
  });
  await ensureOk(response);
}

export async function pause(fetchFn: SpotifyFetch, accessToken: string): Promise<void> {
  const response = await api(fetchFn, accessToken, '/me/player/pause', { method: 'PUT' });
  await ensureOk(response);
}

export async function skipNext(fetchFn: SpotifyFetch, accessToken: string): Promise<void> {
  const response = await api(fetchFn, accessToken, '/me/player/next', { method: 'POST' });
  await ensureOk(response);
}

export async function skipPrevious(fetchFn: SpotifyFetch, accessToken: string): Promise<void> {
  const response = await api(fetchFn, accessToken, '/me/player/previous', { method: 'POST' });
  await ensureOk(response);
}

interface Paging<T> {
  items?: T[];
  next?: string | null;
}

export async function fetchPlaylists(
  fetchFn: SpotifyFetch,
  accessToken: string,
): Promise<SpotifyLibraryItem[]> {
  const items: SpotifyLibraryItem[] = [];
  let path: string | null = '/me/playlists?limit=50';

  while (path) {
    const response = await api(fetchFn, accessToken, path);
    if (!response.ok) await readError(response);
    const body = (await response.json()) as Paging<{
      id?: string;
      name?: string;
      uri?: string;
      tracks?: { total?: number };
    }>;
    for (const entry of body.items ?? []) {
      if (!entry.id || !entry.uri || !entry.name) continue;
      items.push({
        id: entry.id,
        name: entry.name,
        uri: entry.uri,
        kind: 'playlist',
        meta: typeof entry.tracks?.total === 'number' ? `${entry.tracks.total} tracks` : null,
      });
    }
    path = nextApiPath(body.next);
  }

  return items;
}

export async function fetchShows(
  fetchFn: SpotifyFetch,
  accessToken: string,
): Promise<SpotifyLibraryItem[]> {
  const items: SpotifyLibraryItem[] = [];
  let path: string | null = '/me/shows?limit=50';

  while (path) {
    const response = await api(fetchFn, accessToken, path);
    if (!response.ok) await readError(response);
    const body = (await response.json()) as Paging<{
      show?: { id?: string; name?: string; uri?: string; publisher?: string };
    }>;
    for (const entry of body.items ?? []) {
      const show = entry.show;
      if (!show?.id || !show.uri || !show.name) continue;
      items.push({
        id: show.id,
        name: show.name,
        uri: show.uri,
        kind: 'show',
        meta: show.publisher ?? null,
      });
    }
    path = nextApiPath(body.next);
  }

  return items;
}

export async function fetchLibrary(
  fetchFn: SpotifyFetch,
  accessToken: string,
): Promise<SpotifyLibraryState> {
  try {
    const [playlists, shows] = await Promise.all([
      fetchPlaylists(fetchFn, accessToken),
      fetchShows(fetchFn, accessToken),
    ]);
    return {
      playlists,
      shows,
      updatedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    return {
      ...initialLibraryState(),
      error: error instanceof Error ? error.message : String(error),
      updatedAt: new Date().toISOString(),
    };
  }
}

/** Strip the absolute API host from a Spotify paging `next` URL. */
export function nextApiPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (next.startsWith(API)) return next.slice(API.length);
  if (next.startsWith('/')) return next;
  try {
    const url = new URL(next);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function formatProgress(progressMs: number | null, durationMs: number | null): string {
  const fmt = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  if (progressMs === null && durationMs === null) return '—';
  return `${fmt(progressMs ?? 0)} / ${fmt(durationMs ?? 0)}`;
}
