import { parseStoredVersion, type Json } from '@nightshift/sdk';

export const SPOTIFY_SESSION_ENTITY = 'spotify.session';
export const SPOTIFY_PLAYER_ENTITY = 'spotify.player';
export const SPOTIFY_LIBRARY_ENTITY = 'spotify.library';
export const SPOTIFY_EPISODES_ENTITY = 'spotify.episodes';

export const SPOTIFY_APP_DOCS_URL =
  'https://developer.spotify.com/documentation/web-api/concepts/apps';

/** Fixed loopback redirect — must be allowlisted in the Spotify app settings. */
export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:43891/callback';
/** Short local URL shown in the widget; the loopback server redirects to Spotify. */
export const SPOTIFY_LOGIN_URI = 'http://127.0.0.1:43891/login';
export const SPOTIFY_CALLBACK_PORT = 43891;

export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
] as const;

export type SpotifySessionStatus =
  'needs_credentials' | 'needs_auth' | 'connecting' | 'ready' | 'error';

export interface SpotifySessionState {
  status: SpotifySessionStatus;
  /** True when a Client ID is stored (secret never appears here). */
  clientIdSet: boolean;
  /** Authorize URL to open in a browser while connecting. */
  authUrl: string | null;
  error: string | null;
  userDisplayName: string | null;
  /** Hint when Player API returns 403 (typically non-Premium). */
  premiumRequired: boolean;
  [key: string]: Json;
}

export type SpotifyItemKind = 'track' | 'episode' | 'unknown';

export interface SpotifyPlayerState {
  isPlaying: boolean;
  name: string | null;
  artists: string | null;
  progressMs: number | null;
  durationMs: number | null;
  deviceName: string | null;
  itemKind: SpotifyItemKind;
  contextUri: string | null;
  contextName: string | null;
  updatedAt: string | null;
  [key: string]: Json;
}

export type SpotifyLibraryKind = 'playlist' | 'show' | 'episode';

export interface SpotifyLibraryItem {
  id: string;
  name: string;
  uri: string;
  kind: SpotifyLibraryKind;
  meta: string | null;
  [key: string]: Json;
}

export interface SpotifyLibraryState {
  playlists: SpotifyLibraryItem[];
  shows: SpotifyLibraryItem[];
  updatedAt: string | null;
  error: string | null;
  [key: string]: Json;
}

/** Episodes of the one show being browsed — loaded on demand, not with the
 * library, since a podcast's back catalogue is far larger than its shelf. */
export interface SpotifyEpisodesState {
  showId: string | null;
  showName: string | null;
  items: SpotifyLibraryItem[];
  loading: boolean;
  error: string | null;
  updatedAt: string | null;
  [key: string]: Json;
}

export const STORED_AUTH_VERSION = 1 as const;

/** Persisted under plugin storage — includes secrets; never mirror into entities. */
export interface SpotifyStoredAuth {
  version: typeof STORED_AUTH_VERSION;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  /** Epoch ms when the access token expires. */
  expiresAt?: number;
  userDisplayName?: string;
  [key: string]: Json | undefined;
}

export function initialSessionState(
  overrides: Partial<SpotifySessionState> = {},
): SpotifySessionState {
  return {
    status: 'needs_credentials',
    clientIdSet: false,
    authUrl: null,
    error: null,
    userDisplayName: null,
    premiumRequired: false,
    ...overrides,
  };
}

export function initialPlayerState(): SpotifyPlayerState {
  return {
    isPlaying: false,
    name: null,
    artists: null,
    progressMs: null,
    durationMs: null,
    deviceName: null,
    itemKind: 'unknown',
    contextUri: null,
    contextName: null,
    updatedAt: null,
  };
}

export function initialLibraryState(): SpotifyLibraryState {
  return {
    playlists: [],
    shows: [],
    updatedAt: null,
    error: null,
  };
}

export function initialEpisodesState(
  overrides: Partial<SpotifyEpisodesState> = {},
): SpotifyEpisodesState {
  return {
    showId: null,
    showName: null,
    items: [],
    loading: false,
    error: null,
    updatedAt: null,
    ...overrides,
  };
}

function isSpotifyStoredAuthBody(
  record: Record<string, unknown>,
): record is Record<string, unknown> & SpotifyStoredAuth {
  return (
    typeof record['clientId'] === 'string' &&
    record['clientId'].trim() !== '' &&
    typeof record['clientSecret'] === 'string' &&
    record['clientSecret'].trim() !== ''
  );
}

/** Defensive parse — corrupt/partial storage becomes null (unconfigured). */
export function parseStoredAuth(value: unknown): SpotifyStoredAuth | null {
  const parsed = parseStoredVersion(value, STORED_AUTH_VERSION, isSpotifyStoredAuthBody);
  if (parsed) return parsed;
  // Legacy blobs written before the version field was added. Only upgrade when
  // `version` is absent — never coerce a future/wrong version into v1.
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record['version'] !== undefined) return null;
  if (!isSpotifyStoredAuthBody(record)) return null;
  return { ...record, version: STORED_AUTH_VERSION } as SpotifyStoredAuth;
}

/** True only for versioned blobs — use `parseStoredAuth` to accept legacy shapes. */
export function isSpotifyStoredAuth(value: unknown): value is SpotifyStoredAuth {
  return parseStoredVersion(value, STORED_AUTH_VERSION, isSpotifyStoredAuthBody) !== null;
}

export function sessionFromStored(stored: SpotifyStoredAuth | undefined): SpotifySessionState {
  if (!stored) return initialSessionState();
  if (stored.refreshToken) {
    return initialSessionState({
      status: 'ready',
      clientIdSet: true,
      userDisplayName: stored.userDisplayName ?? null,
    });
  }
  return initialSessionState({
    status: 'needs_auth',
    clientIdSet: true,
  });
}

export function asJson(value: SpotifyStoredAuth): Json {
  const out: { [key: string]: Json } = {
    version: STORED_AUTH_VERSION,
    clientId: value.clientId,
    clientSecret: value.clientSecret,
  };
  if (value.accessToken !== undefined) out['accessToken'] = value.accessToken;
  if (value.refreshToken !== undefined) out['refreshToken'] = value.refreshToken;
  if (value.expiresAt !== undefined) out['expiresAt'] = value.expiresAt;
  if (value.userDisplayName !== undefined) out['userDisplayName'] = value.userDisplayName;
  return out;
}
