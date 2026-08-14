import {
  authorizedFetch,
  ensureOk,
  HttpError,
  type HttpErrorMessageFormatter,
} from '@nightshift/plugin-shared';
import type { PluginFetch, PluginFetchInit } from '@nightshift/sdk';
import type {
  SpotifyItemKind,
  SpotifyLibraryItem,
  SpotifyLibraryState,
  SpotifyPlayerState,
} from './entity.js';
import { initialLibraryState, initialPlayerState } from './entity.js';

const API = 'https://api.spotify.com/v1';

/** Pull Spotify's `{ error: { message, reason } }` out of a response body. */
export function parseSpotifyErrorMessage(
  status: number,
  body: string,
): { message: string; reason: string | null } {
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string; reason?: string };
    };
    const message = json.error?.message?.trim();
    const reason = json.error?.reason?.trim() || null;
    if (message) {
      return {
        message: reason ? `${message} (${reason})` : message,
        reason,
      };
    }
  } catch {
    // not JSON — fall through
  }
  const trimmed = body.trim();
  return {
    message: trimmed || `Spotify API error (${status})`,
    reason: null,
  };
}

const spotifyErrorMessage: HttpErrorMessageFormatter = (status, body) =>
  parseSpotifyErrorMessage(status, body).message;

async function api(
  fetchFn: PluginFetch,
  accessToken: string,
  path: string,
  init?: PluginFetchInit,
): Promise<Response> {
  return authorizedFetch(fetchFn, accessToken, `${API}${path}`, init);
}

async function readError(response: Response): Promise<never> {
  const body = await response.text();
  const parsed = parseSpotifyErrorMessage(response.status, body);
  throw new HttpError(response.status, body, parsed.message, parsed.reason);
}

function isPremiumRequired(error: HttpError): boolean {
  return error.status === 403;
}

function isNoActiveDevice(error: HttpError): boolean {
  return error.status === 404 && error.reason === 'NO_ACTIVE_DEVICE';
}

export interface SpotifyDevice {
  id: string;
  name: string;
  isActive: boolean;
}

/** Prefer the active Connect device; otherwise the first available one. */
export function pickDeviceId(devices: readonly SpotifyDevice[]): string | undefined {
  return devices.find((device) => device.isActive)?.id ?? devices[0]?.id;
}

export async function fetchDevices(
  fetchFn: PluginFetch,
  accessToken: string,
): Promise<SpotifyDevice[]> {
  const response = await api(fetchFn, accessToken, '/me/player/devices');
  if (!response.ok) await readError(response);
  const body = (await response.json()) as {
    devices?: Array<{ id?: string | null; name?: string; is_active?: boolean }>;
  };
  const devices: SpotifyDevice[] = [];
  for (const entry of body.devices ?? []) {
    if (!entry.id) continue;
    devices.push({
      id: entry.id,
      name: entry.name ?? entry.id,
      isActive: Boolean(entry.is_active),
    });
  }
  return devices;
}

async function resolveDeviceId(
  fetchFn: PluginFetch,
  accessToken: string,
  preferred?: string,
): Promise<string | undefined> {
  if (preferred) return preferred;
  return pickDeviceId(await fetchDevices(fetchFn, accessToken));
}

function withDeviceQuery(path: string, deviceId: string | undefined): string {
  if (!deviceId) return path;
  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}device_id=${encodeURIComponent(deviceId)}`;
}

const NO_DEVICE_HINT =
  'No Spotify device found. Open the Spotify app on a phone or computer, then try again.';

export interface SpotifyProfile {
  id: string;
  displayName: string;
}

export async function fetchProfile(
  fetchFn: PluginFetch,
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
      : (item.artists
          ?.map((a) => a.name)
          .filter(Boolean)
          .join(', ') ?? null);

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

/**
 * `additional_types` is not cosmetic: without it the endpoint only admits to
 * tracks, so a playing podcast episode comes back as nothing playing at all.
 * @see https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track
 */
const CURRENTLY_PLAYING_PATH = '/me/player/currently-playing?additional_types=track,episode';

export async function fetchCurrentlyPlaying(
  fetchFn: PluginFetch,
  accessToken: string,
): Promise<SpotifyPlayerState> {
  const response = await api(fetchFn, accessToken, CURRENTLY_PLAYING_PATH);
  if (response.status === 204) {
    return { ...initialPlayerState(), updatedAt: new Date().toISOString() };
  }
  if (!response.ok) await readError(response);
  const body = (await response.json()) as CurrentlyPlayingJson;
  return mapCurrentlyPlaying(body);
}

export interface PlayOptions {
  /** Album / artist / playlist URI (not shows — use `uris` or `playContext`). */
  contextUri?: string;
  /** Explicit track/episode URIs to play. */
  uris?: string[];
  deviceId?: string;
}

export async function play(
  fetchFn: PluginFetch,
  accessToken: string,
  options: PlayOptions = {},
): Promise<void> {
  const deviceId = await resolveDeviceId(fetchFn, accessToken, options.deviceId);
  if (!deviceId) {
    throw new HttpError(404, '', NO_DEVICE_HINT, 'NO_ACTIVE_DEVICE');
  }

  const payload: Record<string, unknown> = {};
  if (options.contextUri !== undefined) payload.context_uri = options.contextUri;
  if (options.uris !== undefined) payload.uris = options.uris;
  const body = Object.keys(payload).length === 0 ? undefined : JSON.stringify(payload);

  const response = await api(fetchFn, accessToken, withDeviceQuery('/me/player/play', deviceId), {
    method: 'PUT',
    ...(body === undefined ? {} : { body }),
  });
  try {
    await ensureOk(response, spotifyErrorMessage);
  } catch (error) {
    if (error instanceof HttpError && isNoActiveDevice(error)) {
      throw new HttpError(404, error.body, NO_DEVICE_HINT, 'NO_ACTIVE_DEVICE');
    }
    throw error;
  }
}

/**
 * Start playback from a library URI. Playlists/albums/artists use `context_uri`;
 * shows are not valid contexts — we play their recent episode URIs instead.
 * @see https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
 */
export async function playContext(
  fetchFn: PluginFetch,
  accessToken: string,
  uri: string,
): Promise<void> {
  if (uri.startsWith('spotify:show:')) {
    const showId = uri.slice('spotify:show:'.length);
    const uris = await fetchShowEpisodeUris(fetchFn, accessToken, showId);
    if (uris.length === 0) {
      throw new HttpError(404, '', 'That podcast has no playable episodes.');
    }
    await play(fetchFn, accessToken, { uris });
    return;
  }
  await play(fetchFn, accessToken, { contextUri: uri });
}

function episodeMeta(entry: { duration_ms?: number; release_date?: string }): string | null {
  const parts: string[] = [];
  if (typeof entry.duration_ms === 'number') {
    parts.push(`${Math.max(1, Math.round(entry.duration_ms / 60_000))} min`);
  }
  if (entry.release_date) parts.push(entry.release_date);
  return parts.length === 0 ? null : parts.join(' · ');
}

/** A show's most recent episodes, newest first — what the browse page lists. */
export async function fetchShowEpisodes(
  fetchFn: PluginFetch,
  accessToken: string,
  showId: string,
  limit = 50,
): Promise<SpotifyLibraryItem[]> {
  const response = await api(
    fetchFn,
    accessToken,
    `/shows/${encodeURIComponent(showId)}/episodes?limit=${limit}`,
  );
  if (!response.ok) await readError(response);
  const body = (await response.json()) as Paging<{
    id?: string;
    name?: string;
    uri?: string;
    duration_ms?: number;
    release_date?: string;
  } | null>;

  const items: SpotifyLibraryItem[] = [];
  for (const entry of body.items ?? []) {
    if (!entry?.id || !entry.uri || !entry.name) continue;
    items.push({
      id: entry.id,
      name: entry.name,
      uri: entry.uri,
      kind: 'episode',
      meta: episodeMeta(entry),
    });
  }
  return items;
}

export async function fetchShowEpisodeUris(
  fetchFn: PluginFetch,
  accessToken: string,
  showId: string,
  limit = 20,
): Promise<string[]> {
  const episodes = await fetchShowEpisodes(fetchFn, accessToken, showId, limit);
  return episodes.map((episode) => episode.uri);
}

async function playerControl(
  fetchFn: PluginFetch,
  accessToken: string,
  path: string,
  method: 'PUT' | 'POST',
): Promise<void> {
  const deviceId = await resolveDeviceId(fetchFn, accessToken);
  if (!deviceId) {
    throw new HttpError(404, '', NO_DEVICE_HINT, 'NO_ACTIVE_DEVICE');
  }
  const response = await api(fetchFn, accessToken, withDeviceQuery(path, deviceId), { method });
  try {
    await ensureOk(response, spotifyErrorMessage);
  } catch (error) {
    if (error instanceof HttpError && isNoActiveDevice(error)) {
      throw new HttpError(404, error.body, NO_DEVICE_HINT, 'NO_ACTIVE_DEVICE');
    }
    throw error;
  }
}

export async function pause(fetchFn: PluginFetch, accessToken: string): Promise<void> {
  await playerControl(fetchFn, accessToken, '/me/player/pause', 'PUT');
}

export async function skipNext(fetchFn: PluginFetch, accessToken: string): Promise<void> {
  await playerControl(fetchFn, accessToken, '/me/player/next', 'POST');
}

export async function skipPrevious(fetchFn: PluginFetch, accessToken: string): Promise<void> {
  await playerControl(fetchFn, accessToken, '/me/player/previous', 'POST');
}

interface Paging<T> {
  items?: T[];
  next?: string | null;
}

export async function fetchPlaylists(
  fetchFn: PluginFetch,
  accessToken: string,
): Promise<SpotifyLibraryItem[]> {
  const items: SpotifyLibraryItem[] = [];
  let path: string | null = '/me/playlists?limit=50';

  while (path) {
    const response = await api(fetchFn, accessToken, path);
    if (!response.ok) await readError(response);
    // Spotify pads these arrays with nulls for anything unavailable in the
    // user's market, so every entry is optional until proven otherwise.
    const body = (await response.json()) as Paging<{
      id?: string;
      name?: string;
      uri?: string;
      tracks?: { total?: number };
    } | null>;
    for (const entry of body.items ?? []) {
      if (!entry?.id || !entry.uri || !entry.name) continue;
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
  fetchFn: PluginFetch,
  accessToken: string,
): Promise<SpotifyLibraryItem[]> {
  const items: SpotifyLibraryItem[] = [];
  let path: string | null = '/me/shows?limit=50';

  while (path) {
    const response = await api(fetchFn, accessToken, path);
    if (!response.ok) await readError(response);
    const body = (await response.json()) as Paging<{
      show?: { id?: string; name?: string; uri?: string; publisher?: string } | null;
    } | null>;
    for (const entry of body.items ?? []) {
      const show = entry?.show;
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
  fetchFn: PluginFetch,
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

export function isSpotifyPremiumRequired(error: unknown): boolean {
  return error instanceof HttpError && isPremiumRequired(error);
}

export function isSpotifyNoActiveDevice(error: unknown): boolean {
  return error instanceof HttpError && isNoActiveDevice(error);
}
