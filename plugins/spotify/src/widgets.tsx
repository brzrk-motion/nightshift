import { useState, type ReactNode } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  TextInput,
  Toolbar,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import { formatProgress } from './client.js';
import {
  SPOTIFY_APP_DOCS_URL,
  SPOTIFY_LIBRARY_ENTITY,
  SPOTIFY_PLAYER_ENTITY,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SESSION_ENTITY,
  initialLibraryState,
  initialPlayerState,
  initialSessionState,
  type SpotifyLibraryItem,
  type SpotifyLibraryState,
  type SpotifyPlayerState,
  type SpotifySessionState,
} from './entity.js';

function CredentialsForm({ error }: { error?: string | null }): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [focusSecret, setFocusSecret] = useState(false);

  const save = (): void => {
    const id = clientId.trim();
    const secret = clientSecret.trim();
    if (id === '' || secret === '') return;
    void commands.run('spotify.configure', { clientId: id, clientSecret: secret });
  };

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.colors.muted}>Set up a Spotify Developer app, then paste its credentials.</text>
      <text fg={theme.colors.accent}>{SPOTIFY_APP_DOCS_URL}</text>
      <text fg={theme.colors.muted}>Redirect URI to allowlist:</text>
      <text fg={theme.colors.text}>{SPOTIFY_REDIRECT_URI}</text>
      {error ? <text fg={theme.colors.danger}>{error}</text> : null}
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <text fg={theme.colors.muted}>Client ID</text>
        <TextInput
          value={clientId}
          onInput={setClientId}
          onSubmit={() => setFocusSecret(true)}
          focused={!focusSecret}
          placeholder="from the Spotify Dashboard"
        />
      </box>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <text fg={theme.colors.muted}>Secret</text>
        <TextInput
          value={clientSecret}
          onInput={setClientSecret}
          onSubmit={save}
          focused={focusSecret}
          placeholder="Client Secret"
        />
        <Button label="Save" onPress={save} />
      </box>
    </box>
  );
}

function ConnectPane({ session }: { session: SpotifySessionState }): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [paste, setPaste] = useState('');

  const submitPaste = (): void => {
    const url = paste.trim();
    if (url === '') return;
    void commands.run('spotify.submit-redirect', { url });
  };

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.colors.muted}>
        Credentials saved. Connect your Spotify account (Premium required for playback control).
      </text>
      {session.status === 'connecting' && session.authUrl ? (
        <>
          <text fg={theme.colors.muted}>1. Open this Spotify URL in a browser:</text>
          <text fg={theme.colors.accent} wrapMode="char">
            {session.authUrl}
          </text>
          <text fg={theme.colors.muted}>
            2. After you authorize, the browser may say &quot;Unable to connect&quot; — that is
            expected over SSH. Copy the full URL from the address bar and paste it here:
          </text>
          <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
            <TextInput
              value={paste}
              onInput={setPaste}
              onSubmit={submitPaste}
              focused
              placeholder="http://127.0.0.1:43891/callback?code=…"
            />
            <Button label="Submit" onPress={submitPaste} />
          </box>
          <text fg={theme.colors.muted}>Waiting for authorization…</text>
        </>
      ) : (
        <Toolbar>
          <Button label="Connect" onPress={() => void commands.run('spotify.connect')} />
          <Button
            label="Change credentials"
            onPress={() => void commands.run('spotify.reset-credentials')}
          />
        </Toolbar>
      )}
      {session.error ? <text fg={theme.colors.danger}>{session.error}</text> : null}
    </box>
  );
}

function LibraryList({
  title,
  items,
}: {
  title: string;
  items: readonly SpotifyLibraryItem[];
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();

  if (items.length === 0) {
    return <text fg={theme.colors.muted}>No {title.toLowerCase()} yet.</text>;
  }

  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      <text fg={theme.colors.muted}>{title}</text>
      {items.map((item) => (
        <box key={item.id} style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
          <Button
            label="Play"
            onPress={() => void commands.run('spotify.play-context', { uri: item.uri })}
          />
          <text fg={theme.colors.text}>{item.name}</text>
          {item.meta ? <text fg={theme.colors.muted}>{item.meta}</text> : null}
        </box>
      ))}
    </box>
  );
}

function ReadyPane({
  session,
  player,
  library,
}: {
  session: SpotifySessionState;
  player: SpotifyPlayerState;
  library: SpotifyLibraryState;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const who = session.userDisplayName ? ` · ${session.userDisplayName}` : '';

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <text fg={theme.colors.muted}>Spotify{who}</text>
        <box style={{ flexGrow: 1 }} />
        <Button label="Refresh" onPress={() => void commands.run('spotify.refresh')} />
        <Button label="Disconnect" onPress={() => void commands.run('spotify.disconnect')} />
      </box>

      {session.premiumRequired || session.error ? (
        <text fg={theme.colors.warning}>
          {session.error ??
            'Playback control needs Spotify Premium and an open Spotify client.'}
        </text>
      ) : null}

      {player.name ? (
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <text fg={theme.colors.text}>
            {player.isPlaying ? '>' : '='} {player.name}
            {player.artists ? ` — ${player.artists}` : ''}
          </text>
          <text fg={theme.colors.muted}>
            {formatProgress(player.progressMs, player.durationMs)}
            {player.deviceName ? ` · ${player.deviceName}` : ''}
          </text>
        </box>
      ) : (
        <EmptyState
          message="Nothing playing"
          hint="Start something in Spotify, or pick a playlist below."
        />
      )}

      <Toolbar>
        <Button label="Prev" onPress={() => void commands.run('spotify.previous')} />
        {player.isPlaying ? (
          <Button label="Pause" onPress={() => void commands.run('spotify.pause')} />
        ) : (
          <Button label="Play" onPress={() => void commands.run('spotify.play')} />
        )}
        <Button label="Next" onPress={() => void commands.run('spotify.next')} />
      </Toolbar>

      {library.error ? <ErrorState message={library.error} /> : null}

      <scrollbox style={{ flexGrow: 1 }}>
        <box style={{ flexDirection: 'column', gap: 1 }}>
          <LibraryList title="Playlists" items={library.playlists} />
          <LibraryList title="Podcasts" items={library.shows} />
        </box>
      </scrollbox>
    </box>
  );
}

/**
 * Spotify Connect controller: credentials → OAuth → now playing + library.
 * Secrets stay in plugin storage; only status flags live on the session entity.
 */
export function PlayerWidget(_props: WidgetProps): ReactNode {
  const sessionEntity = useEntity<SpotifySessionState>(SPOTIFY_SESSION_ENTITY);
  const playerEntity = useEntity<SpotifyPlayerState>(SPOTIFY_PLAYER_ENTITY);
  const libraryEntity = useEntity<SpotifyLibraryState>(SPOTIFY_LIBRARY_ENTITY);
  const session = sessionEntity?.state ?? initialSessionState();
  const player = playerEntity?.state ?? initialPlayerState();
  const library = libraryEntity?.state ?? initialLibraryState();

  if (session.status === 'needs_credentials') {
    return <CredentialsForm error={session.error} />;
  }

  if (session.status === 'needs_auth' || session.status === 'connecting') {
    return <ConnectPane session={session} />;
  }

  if (session.status === 'error') {
    return <CredentialsForm error={session.error} />;
  }

  return <ReadyPane session={session} player={player} library={library} />;
}
