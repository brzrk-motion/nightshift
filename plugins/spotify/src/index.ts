import { HttpError } from '@nightshift/plugin-shared';
import { argString, definePlugin, type PluginContext } from '@nightshift/sdk';
import { ensureAccessToken, startConnectFlow } from './auth.js';
import {
  fetchCurrentlyPlaying,
  fetchLibrary,
  fetchProfile,
  fetchShowEpisodes,
  isSpotifyPremiumRequired,
  pause,
  play,
  playContext,
  skipNext,
  skipPrevious,
} from './client.js';
import { PLAYER_SETTLE_MS, pollIntervalMs } from './format.js';
import {
  SPOTIFY_EPISODES_ENTITY,
  SPOTIFY_LIBRARY_ENTITY,
  SPOTIFY_PLAYER_ENTITY,
  SPOTIFY_SESSION_ENTITY,
  asJson,
  initialEpisodesState,
  initialLibraryState,
  initialPlayerState,
  initialSessionState,
  parseStoredAuth,
  sessionFromStored,
  STORED_AUTH_VERSION,
  type SpotifyEpisodesState,
  type SpotifyLibraryState,
  type SpotifyPlayerState,
  type SpotifySessionState,
  type SpotifyStoredAuth,
} from './entity.js';
import { PlayerWidget } from './widgets.js';

const STORAGE_KEY = 'auth';

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
    'automations:register',
    'storage',
    'network',
  ],

  async setup(context: PluginContext) {
    const raw = await context.storage.get(STORAGE_KEY);
    let stored: SpotifyStoredAuth | undefined = parseStoredAuth(raw) ?? undefined;

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
    context.registerEntity(SPOTIFY_EPISODES_ENTITY, initialEpisodesState(), {
      title: 'Spotify episodes',
      owner: 'spotify',
    });

    const readSession = (): SpotifySessionState =>
      context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state ??
      initialSessionState();

    const writeSession = (next: SpotifySessionState): void => {
      context.entities.set(SPOTIFY_SESSION_ENTITY, next);
    };

    const readPlayer = (): SpotifyPlayerState =>
      context.entities.get<SpotifyPlayerState>(SPOTIFY_PLAYER_ENTITY)?.state ??
      initialPlayerState();

    const writePlayer = (next: SpotifyPlayerState): void => {
      context.entities.set(SPOTIFY_PLAYER_ENTITY, next);
    };

    const writeLibrary = (next: SpotifyLibraryState): void => {
      context.entities.set(SPOTIFY_LIBRARY_ENTITY, next);
    };

    const writeEpisodes = (next: SpotifyEpisodesState): void => {
      context.entities.set(SPOTIFY_EPISODES_ENTITY, next);
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

    // A failing poll should say so once, not every few seconds: the message is
    // remembered until something succeeds, so a Spotify that is down for an
    // hour costs one toast rather than hundreds.
    let announced: string | null = null;

    const announce = (message: string, tone: 'warning' | 'danger'): void => {
      if (announced === message) return;
      announced = message;
      context.notify(message, { tone, key: 'request' });
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
        const premiumRequired = isSpotifyPremiumRequired(error);
        const authLost =
          /refresh failed|Not connected|401/i.test(message) ||
          (error instanceof HttpError && error.status === 401);
        // Only what the widget has to draw a form for belongs on the entity. A
        // request that failed is transient, so it goes to the notification
        // stack rather than a warning line wedged into the player.
        writeSession({
          ...readSession(),
          status: authLost ? 'needs_auth' : 'ready',
          error: authLost ? message : null,
          premiumRequired,
          clientIdSet: true,
        });
        context.log.warn('Spotify request failed', { error: message });
        if (!authLost) announce(message, premiumRequired ? 'warning' : 'danger');
        return undefined;
      }
    };

    const refreshPlayer = async (): Promise<void> => {
      await withToken(async (token) => {
        try {
          const player = await fetchCurrentlyPlaying(context.fetch, token);
          writePlayer(player);
          announced = null;
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
          if (isSpotifyPremiumRequired(error)) {
            writeSession({
              ...readSession(),
              status: 'ready',
              premiumRequired: true,
              error: null,
            });
            announce(
              'Playback control needs Spotify Premium (and an open Spotify client).',
              'warning',
            );
            return;
          }
          throw error;
        }
      });
    };

    // Spotify's player state lags the command it has just accepted, so the read
    // straight after a play often still reports the old state — or nothing at
    // all — and the widget looks idle while music is coming out of the speakers.
    // Read again once the service has caught up.
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshPlayerSettled = async (): Promise<void> => {
      await refreshPlayer();
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => void refreshPlayer(), PLAYER_SETTLE_MS);
      settleTimer.unref?.();
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
        const clientId = argString(args, 'clientId');
        const clientSecret = argString(args, 'clientSecret');
        if (!clientId || !clientSecret) {
          context.log.warn('spotify.configure needs clientId and clientSecret');
          return;
        }

        const next: SpotifyStoredAuth = {
          version: STORED_AUTH_VERSION,
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
        const value = argString(args, 'url') ?? argString(args, 'redirect');
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
            error:
              'Could not find code= and state= in what you pasted. Copy the full URL from the browser address bar.',
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
            version: STORED_AUTH_VERSION,
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
          await refreshPlayerSettled();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.pause',
      title: 'Spotify pause',
      run: async () => {
        await withToken(async (token) => {
          await pause(context.fetch, token);
          await refreshPlayerSettled();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.next',
      title: 'Spotify skip next',
      run: async () => {
        await withToken(async (token) => {
          await skipNext(context.fetch, token);
          await refreshPlayerSettled();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.previous',
      title: 'Spotify skip previous',
      run: async () => {
        await withToken(async (token) => {
          await skipPrevious(context.fetch, token);
          await refreshPlayerSettled();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.play-context',
      title: 'Spotify play playlist or show',
      run: async (args) => {
        const uri = argString(args, 'uri');
        if (!uri) {
          context.log.warn('spotify.play-context needs a uri');
          return;
        }
        await withToken(async (token) => {
          await playContext(context.fetch, token, uri);
          await refreshPlayerSettled();
        });
      },
    });

    context.registerCommand({
      id: 'spotify.show-episodes',
      title: 'Load a Spotify podcast’s episodes',
      run: async (args) => {
        const uri = argString(args, 'uri');
        if (!uri || !uri.startsWith('spotify:show:')) {
          context.log.warn('spotify.show-episodes needs a show uri');
          return;
        }
        const showId = uri.slice('spotify:show:'.length);
        const showName = argString(args, 'name') ?? null;

        writeEpisodes(
          initialEpisodesState({ showId, showName, loading: true, items: [], error: null }),
        );

        await withToken(async (token) => {
          try {
            const items = await fetchShowEpisodes(context.fetch, token, showId);
            writeEpisodes(
              initialEpisodesState({
                showId,
                showName,
                items,
                loading: false,
                updatedAt: new Date().toISOString(),
              }),
            );
          } catch (error) {
            // A podcast that will not load is this page's problem, not the
            // session's — the rest of the widget keeps working.
            writeEpisodes(
              initialEpisodesState({
                showId,
                showName,
                loading: false,
                error: error instanceof Error ? error.message : String(error),
                updatedAt: new Date().toISOString(),
              }),
            );
          }
        });
      },
    });

    context.registerCommand({
      id: 'spotify.play-episode',
      title: 'Spotify play episode',
      run: async (args) => {
        const uri = argString(args, 'uri');
        if (!uri) {
          context.log.warn('spotify.play-episode needs a uri');
          return;
        }
        await withToken(async (token) => {
          await play(context.fetch, token, { uris: [uri] });
          await refreshPlayerSettled();
        });
      },
    });

    context.registerWidget({
      type: 'spotify.player',
      title: 'Spotify',
      entities: [
        SPOTIFY_SESSION_ENTITY,
        SPOTIFY_PLAYER_ENTITY,
        SPOTIFY_LIBRARY_ENTITY,
        SPOTIFY_EPISODES_ENTITY,
      ],
      description:
        'Control Spotify Connect: now playing, transport, playlists and podcasts. Configure your app credentials in the widget.',
      render: PlayerWidget,
    });

    // Poll only while the widget is on screen — credentials in storage must not
    // mean background API traffic on dashboards that never show Spotify.
    let widgetMounted = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (): void => {
      timer = setTimeout(() => {
        void poll();
      }, pollIntervalMs(readPlayer().isPlaying));
      timer.unref?.();
    };

    const poll = async (): Promise<void> => {
      if (readSession().status === 'ready') await refreshPlayer();
      if (widgetMounted > 0) schedule();
    };

    const startPolling = (): void => {
      if (timer !== undefined) return;
      schedule();
    };

    const stopPolling = (): void => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
    };

    context.registerCommand({
      id: 'spotify.widget-mounted',
      title: 'Spotify widget mounted',
      hidden: true,
      run: () => {
        widgetMounted += 1;
        if (widgetMounted === 1) {
          startPolling();
          if (readSession().status === 'ready') void refreshAll();
        }
      },
    });

    context.registerCommand({
      id: 'spotify.widget-unmounted',
      title: 'Spotify widget unmounted',
      hidden: true,
      run: () => {
        widgetMounted = Math.max(0, widgetMounted - 1);
        if (widgetMounted === 0) stopPolling();
      },
    });

    // Widgets cannot call each other; exclusive playback goes through the
    // shared command registry. Pausing ambient does not set isPlaying, so
    // the reverse automation does not loop.
    context.registerAutomation({
      name: 'spotify.pause-ambient-noise',
      when: { type: 'entity', entity: SPOTIFY_PLAYER_ENTITY, key: 'isPlaying' },
      and: [{ type: 'equals', entity: SPOTIFY_PLAYER_ENTITY, key: 'isPlaying', value: true }],
      then: [{ command: 'ambient-noise.pause' }],
    });

    context.own(() => {
      stopPolling();
      if (settleTimer) clearTimeout(settleTimer);
    });

    context.log.info('Spotify plugin ready', {
      status: sessionFromStored(stored).status,
    });
  },
});

export {
  SPOTIFY_APP_DOCS_URL,
  SPOTIFY_EPISODES_ENTITY,
  SPOTIFY_LIBRARY_ENTITY,
  SPOTIFY_LOGIN_URI,
  SPOTIFY_PLAYER_ENTITY,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SESSION_ENTITY,
  initialEpisodesState,
  initialLibraryState,
  initialPlayerState,
  initialSessionState,
  isSpotifyStoredAuth,
  parseStoredAuth,
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
