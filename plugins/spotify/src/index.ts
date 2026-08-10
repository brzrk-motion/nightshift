import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';
import { ensureAccessToken, startConnectFlow } from './auth.js';
import {
  SpotifyApiError,
  fetchCurrentlyPlaying,
  fetchLibrary,
  fetchProfile,
  pause,
  play,
  skipNext,
  skipPrevious,
} from './client.js';
import {
  SPOTIFY_LIBRARY_ENTITY,
  SPOTIFY_PLAYER_ENTITY,
  SPOTIFY_SESSION_ENTITY,
  asJson,
  initialLibraryState,
  initialPlayerState,
  initialSessionState,
  isSpotifyStoredAuth,
  sessionFromStored,
  type SpotifyLibraryState,
  type SpotifyPlayerState,
  type SpotifySessionState,
  type SpotifyStoredAuth,
} from './entity.js';
import { PlayerWidget } from './widgets.js';

const STORAGE_KEY = 'auth';
const POLL_MS = 5_000;

function stringArg(args: Record<string, Json> | undefined, key: string): string | undefined {
  const value = args?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export default definePlugin({
  id: 'spotify',
  name: 'Spotify',
  version: '0.1.0',
  description:
    'Control the Spotify client on your machine — playlists, podcasts, and transport. Does not stream audio.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
    'network',
  ],

  async setup(context: PluginContext) {
    const raw = await context.storage.get(STORAGE_KEY);
    let stored: SpotifyStoredAuth | undefined = isSpotifyStoredAuth(raw) ? raw : undefined;

    context.registerEntity(SPOTIFY_SESSION_ENTITY, sessionFromStored(stored), {
      title: 'Spotify session',
      owner: 'spotify',
    });
    context.registerEntity(SPOTIFY_PLAYER_ENTITY, initialPlayerState(), {
      title: 'Spotify now playing',
      owner: 'spotify',
    });
    context.registerEntity(SPOTIFY_LIBRARY_ENTITY, initialLibraryState(), {
      title: 'Spotify library',
      owner: 'spotify',
    });

    const readSession = (): SpotifySessionState =>
      context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state ??
      initialSessionState();

    const writeSession = (next: SpotifySessionState): void => {
      context.entities.set(SPOTIFY_SESSION_ENTITY, next);
    };

    const writePlayer = (next: SpotifyPlayerState): void => {
      context.entities.set(SPOTIFY_PLAYER_ENTITY, next);
    };

    const writeLibrary = (next: SpotifyLibraryState): void => {
      context.entities.set(SPOTIFY_LIBRARY_ENTITY, next);
    };

    const persist = async (next: SpotifyStoredAuth | undefined): Promise<void> => {
      stored = next;
      try {
        if (next) await context.storage.set(STORAGE_KEY, asJson(next));
        else await context.storage.delete(STORAGE_KEY);
      } catch (error) {
        context.log.warn('Could not persist Spotify auth', { error: `${error}` });
      }
    };

    const withToken = async <T>(fn: (token: string) => Promise<T>): Promise<T | undefined> => {
      if (!stored?.refreshToken) {
        writeSession(
          initialSessionState({
            status: stored ? 'needs_auth' : 'needs_credentials',
            clientIdSet: Boolean(stored),
            error: 'Connect to Spotify first.',
          }),
        );
        return undefined;
      }

      try {
        const ensured = await ensureAccessToken(context.fetch, stored);
        if (ensured.stored !== stored) await persist(ensured.stored);
        return await fn(ensured.token);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const authLost =
          /refresh failed|Not connected|401/i.test(message) ||
          (error instanceof SpotifyApiError && error.status === 401);
        writeSession({
          ...readSession(),
          status: authLost ? 'needs_auth' : 'ready',
          error: message,
          premiumRequired: error instanceof SpotifyApiError && error.premiumRequired,
          clientIdSet: true,
        });
        context.log.warn('Spotify request failed', { error: message });
        return undefined;
      }
    };

    const refreshPlayer = async (): Promise<void> => {
      await withToken(async (token) => {
        try {
          const player = await fetchCurrentlyPlaying(context.fetch, token);
          writePlayer(player);
          const session = readSession();
          if (session.status !== 'ready' || session.error) {
            writeSession({
              ...session,
              status: 'ready',
              error: null,
              premiumRequired: false,
            });
          }
        } catch (error) {
          if (error instanceof SpotifyApiError && error.premiumRequired) {
            writeSession({
              ...readSession(),
              status: 'ready',
              premiumRequired: true,
              error: 'Playback control needs Spotify Premium (and an open Spotify client).',
            });
            return;
          }
          throw error;
        }
      });
    };

    const refreshLibrary = async (): Promise<void> => {
      await withToken(async (token) => {
        const library = await fetchLibrary(context.fetch, token);
        writeLibrary(library);
      });
    };

    const refreshAll = async (): Promise<void> => {
      await refreshPlayer();
      await refreshLibrary();
    };

    context.registerCommand({
      id: 'spotify.configure',
      title: 'Configure Spotify app credentials',
      run: async (args) => {
        const clientId = stringArg(args, 'clientId');
        const clientSecret = stringArg(args, 'clientSecret');
        if (!clientId || !clientSecret) {
          context.log.warn('spotify.configure needs clientId and clientSecret');
          return;
        }

        const next: SpotifyStoredAuth = {
          clientId,
          clientSecret,
          // Drop tokens when credentials change — force a fresh Connect.
        };
        await persist(next);
        writeSession(
          initialSessionState({
            status: 'needs_auth',
            clientIdSet: true,
          }),
        );
        writePlayer(initialPlayerState());
        writeLibrary(initialLibraryState());
      },
    });

    let activeConnect:
      | {
          submitRedirect: (input: string) => boolean;
          dispose: () => void;
        }
      | undefined;

    const finishConnect = async (completed: Promise<SpotifyStoredAuth>): Promise<void> => {
      try {
        const next = await completed;
        activeConnect = undefined;
        let withProfile = next;
        try {
          const ensured = await ensureAccessToken(context.fetch, next);
          withProfile = ensured.stored;
          const profile = await fetchProfile(context.fetch, ensured.token);
          withProfile = { ...withProfile, userDisplayName: profile.displayName };
        } catch (error) {
          context.log.warn('Connected but could not load Spotify profile', {
            error: `${error}`,
          });
        }

        await persist(withProfile);
        writeSession(
          initialSessionState({
            status: 'ready',
            clientIdSet: true,
            userDisplayName: withProfile.userDisplayName ?? null,
          }),
        );
        await refreshAll();
      } catch (error) {
        activeConnect = undefined;
        const message = error instanceof Error ? error.message : String(error);
        writeSession({
          ...readSession(),
          status: 'needs_auth',
          authUrl: null,
          error: message,
          clientIdSet: true,
        });
        context.log.warn('Spotify connect failed', { error: message });
      }
    };

    context.registerCommand({
      id: 'spotify.connect',
      title: 'Connect Spotify account',
      run: async () => {
        if (!stored) {
          writeSession(
            initialSessionState({
              status: 'needs_credentials',
              error: 'Enter your Client ID and Secret first.',
            }),
          );
          return;
        }

        activeConnect?.dispose();
        writeSession({
          ...readSession(),
          status: 'connecting',
          error: null,
          authUrl: null,
          clientIdSet: true,
        });

        const flow = startConnectFlow(context.fetch, stored);
        activeConnect = { submitRedirect: flow.submitRedirect, dispose: flow.dispose };
        writeSession({
          ...readSession(),
          status: 'connecting',
          authUrl: flow.authUrl,
          clientIdSet: true,
          error: null,
        });
        context.log.info('Spotify connect: open the authorize URL, then paste the redirect URL', {
          url: flow.authUrl,
        });

        await finishConnect(flow.completed);
      },
    });

    context.registerCommand({
      id: 'spotify.submit-redirect',
      title: 'Submit Spotify auth redirect URL',
      run: (args) => {
        const value = stringArg(args, 'url') ?? stringArg(args, 'redirect');
        if (!value) {
          context.log.warn('spotify.submit-redirect needs a url');
          return;
        }
        if (!activeConnect) {
          writeSession({
            ...readSession(),
            error: 'Press Connect first, then paste the redirect URL.',
          });
          return;
        }
        if (!activeConnect.submitRedirect(value)) {
          writeSession({
            ...readSession(),
            error: 'Could not find code= and state= in what you pasted. Copy the full URL from the browser address bar.',
          });
        }
      },
    });

    context.registerCommand({
      id: 'spotify.disconnect',
      title: 'Disconnect Spotify account',
      run: async () => {
        if (stored) {
          await persist({
            clientId: stored.clientId,
            clientSecret: stored.clientSecret,
          });
        }
        writeSession(
          initialSessionState({
            status: stored ? 'needs_auth' : 'needs_credentials',
            clientIdSet: Boolean(stored),
          }),
        );
        writePlayer(initialPlayerState());
        writeLibrary(initialLibraryState());
      },
    });

    context.registerCommand({
      id: 'spotify.reset-credentials',
      title: 'Reset Spotify app credentials',
      run: async () => {
        await persist(undefined);
        writeSession(initialSessionState());
        writePlayer(initialPlayerState());
        writeLibrary(initialLibraryState());
      },
    });

    context.registerCommand({
      id: 'spotify.refresh',
      title: 'Refresh Spotify player and library',
      run: async () => {
        await refreshAll();
      },
    });

    context.registerCommand({
      id: 'spotify.play',
      title: 'Spotify play',
      run: async () => {
        await withToken(async (token) => {
          await play(context.fetch, token);
          await refreshPlayer();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.pause',
      title: 'Spotify pause',
      run: async () => {
        await withToken(async (token) => {
          await pause(context.fetch, token);
          await refreshPlayer();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.next',
      title: 'Spotify skip next',
      run: async () => {
        await withToken(async (token) => {
          await skipNext(context.fetch, token);
          await refreshPlayer();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.previous',
      title: 'Spotify skip previous',
      run: async () => {
        await withToken(async (token) => {
          await skipPrevious(context.fetch, token);
          await refreshPlayer();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.play-context',
      title: 'Spotify play playlist or show',
      run: async (args) => {
        const uri = stringArg(args, 'uri');
        if (!uri) {
          context.log.warn('spotify.play-context needs a uri');
          return;
        }
        await withToken(async (token) => {
          await play(context.fetch, token, { contextUri: uri });
          await refreshPlayer();
        });
      },
    });

    context.registerWidget({
      type: 'spotify.player',
      title: 'Spotify',
      entities: [SPOTIFY_SESSION_ENTITY, SPOTIFY_PLAYER_ENTITY, SPOTIFY_LIBRARY_ENTITY],
      description:
        'Control Spotify Connect: now playing, transport, playlists and podcasts. Configure your app credentials in the widget.',
      render: PlayerWidget,
    });

    const timer = setInterval(() => {
      if (readSession().status === 'ready') void refreshPlayer();
    }, POLL_MS);
    timer.unref?.();
    context.own(() => clearInterval(timer));

    if (stored?.refreshToken) void refreshAll();

    context.log.info('Spotify plugin ready', {
      status: sessionFromStored(stored).status,
    });
  },
});

export {
  SPOTIFY_APP_DOCS_URL,
  SPOTIFY_LIBRARY_ENTITY,
  SPOTIFY_LOGIN_URI,
  SPOTIFY_PLAYER_ENTITY,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SESSION_ENTITY,
  initialLibraryState,
  initialPlayerState,
  initialSessionState,
  isSpotifyStoredAuth,
  sessionFromStored,
} from './entity.js';
export { PlayerWidget } from './widgets.js';
export {
  base64Url,
  buildAuthorizeUrl,
  codeChallenge,
  generateCodeVerifier,
  generateState,
  loginRedirectHtml,
  parseAuthRedirect,
} from './auth.js';
export { formatProgress, mapCurrentlyPlaying, nextApiPath } from './client.js';
