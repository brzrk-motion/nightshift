import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import {
  createAppRuntime,
  detectRuntime,
  MIDNIGHT_THEME,
  RuntimeProvider,
  ThemeProvider,
} from '@nightshift/ui';
import {
  SPOTIFY_APP_DOCS_URL,
  SPOTIFY_EPISODES_ENTITY,
  SPOTIFY_LIBRARY_ENTITY,
  SPOTIFY_PLAYER_ENTITY,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SESSION_ENTITY,
  initialEpisodesState,
  initialLibraryState,
  initialPlayerState,
  initialSessionState,
} from './entity.js';
import { PlayerWidget } from './widgets.js';

const renderable = detectRuntime().ffi;

async function draw(
  session = initialSessionState(),
  player = initialPlayerState(),
  library = initialLibraryState(),
  size: { width: number; height: number } = { width: 60, height: 20 },
): Promise<string> {
  const entities = createEntityStore();
  entities.register(SPOTIFY_SESSION_ENTITY, session);
  entities.register(SPOTIFY_PLAYER_ENTITY, player);
  entities.register(SPOTIFY_LIBRARY_ENTITY, library);
  entities.register(SPOTIFY_EPISODES_ENTITY, initialEpisodesState());
  const runtime = createAppRuntime({ entities });
  for (const id of [
    'spotify.configure',
    'spotify.connect',
    'spotify.submit-redirect',
    'spotify.disconnect',
    'spotify.reset-credentials',
    'spotify.refresh',
    'spotify.play',
    'spotify.pause',
    'spotify.next',
    'spotify.previous',
    'spotify.play-context',
    'spotify.show-episodes',
    'spotify.play-episode',
  ]) {
    runtime.commands.register({ id, title: id, run: () => {} });
  }

  const setup = await testRender(
    <ThemeProvider theme={MIDNIGHT_THEME}>
      <RuntimeProvider runtime={runtime}>
        <PlayerWidget options={{}} width={size.width} height={size.height} />
      </RuntimeProvider>
    </ThemeProvider>,
    { width: size.width + 12, height: size.height + 4 },
  );
  try {
    await setup.renderOnce();
    return setup.captureCharFrame();
  } finally {
    setup.renderer.destroy();
  }
}

describe.skipIf(!renderable)('PlayerWidget', () => {
  it('asks for credentials and shows the Spotify app docs link', async () => {
    const frame = await draw(initialSessionState({ status: 'needs_credentials' }));
    expect(frame).toContain('Client ID');
    expect(frame).toContain(SPOTIFY_APP_DOCS_URL);
    expect(frame).toContain(SPOTIFY_REDIRECT_URI);
  });

  it('prompts to connect once credentials are saved', async () => {
    const frame = await draw(initialSessionState({ status: 'needs_auth', clientIdSet: true }));
    expect(frame).toContain('Connect');
    expect(frame).toContain('Change credentials');
  });

  it('shows a copy-link button and paste prompt while connecting', async () => {
    const authorizeUrl = 'https://accounts.spotify.com/authorize?response_type=code&client_id=cid';
    const frame = await draw(
      initialSessionState({
        status: 'connecting',
        clientIdSet: true,
        authUrl: authorizeUrl,
      }),
    );
    expect(frame).toContain('Copy link');
    expect(frame).not.toContain('accounts.spotify.com');
    expect(frame).toContain('Unable to connect');
    expect(frame).toContain('Submit');
  });

  it('draws now playing, transport and library when ready', async () => {
    const frame = await draw(
      initialSessionState({
        status: 'ready',
        clientIdSet: true,
        userDisplayName: 'Ada',
      }),
      {
        ...initialPlayerState(),
        isPlaying: true,
        name: 'Night Drive',
        artists: 'Neon',
        progressMs: 30_000,
        durationMs: 180_000,
        deviceName: 'Laptop',
        itemKind: 'track',
        contextUri: null,
        contextName: null,
        updatedAt: '2026-08-10T12:00:00.000Z',
      },
      {
        playlists: [
          {
            id: 'p1',
            name: 'Focus',
            uri: 'spotify:playlist:p1',
            kind: 'playlist',
            meta: '12 tracks',
          },
        ],
        shows: [
          {
            id: 's1',
            name: 'Deep Work',
            uri: 'spotify:show:s1',
            kind: 'show',
            meta: 'Studio',
          },
        ],
        updatedAt: '2026-08-10T12:00:00.000Z',
        error: null,
      },
    );
    expect(frame).toContain('Night Drive');
    expect(frame).toContain('Neon');
    expect(frame).toContain('Laptop');
    expect(frame).toContain('Ada');
    expect(frame).toContain('Browse');
    // The library lives on the browse page now, not under the hero.
    expect(frame).not.toContain('Focus');
    expect(frame).not.toContain('Deep Work');
  });

  it('keeps the transport visible when the slot is small', async () => {
    const frame = await draw(
      initialSessionState({ status: 'ready', clientIdSet: true }),
      {
        ...initialPlayerState(),
        isPlaying: false,
        name: 'Night Drive',
        artists: 'Neon',
        progressMs: 0,
        durationMs: 180_000,
        updatedAt: '2026-08-10T12:00:00.000Z',
      },
      initialLibraryState(),
      { width: 36, height: 7 },
    );
    expect(frame).toContain('Night Drive');
    expect(frame).toContain('Browse');
  });
});
