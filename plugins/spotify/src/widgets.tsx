import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  clipText,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  ProgressBar,
  Tabs,
  TextInput,
  Toolbar,
  useCommands,
  useEntity,
  useRenderer,
  useTheme,
  useToasts,
  type WidgetProps,
} from '@nightshift/sdk';
import { formatProgress } from './client.js';
import { interpolateProgress, progressRatio, resolveLayout } from './format.js';
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
  type SpotifyEpisodesState,
  type SpotifyLibraryItem,
  type SpotifyLibraryState,
  type SpotifyPlayerState,
  type SpotifySessionState,
} from './entity.js';

// Every transport glyph is one cell wide. The obvious pause character, ⏸, is
// East-Asian-Wide: it takes two cells, so a play button and a pause button
// drawn with it are different widths and neither sits centred in its border.
const PREVIOUS_GLYPH = '◀◀';
const NEXT_GLYPH = '▶▶';
const COMPACT_PREVIOUS_GLYPH = '«';
const COMPACT_NEXT_GLYPH = '»';
const PLAY_GLYPH = '▶';
const PAUSE_GLYPH = '▮';

/** Re-renders once a second so the progress bar moves between polls. */
function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    timer.unref?.();
    return () => clearInterval(timer);
  }, [active]);

  return now;
}

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
      <text fg={theme.colors.muted}>
        Set up a Spotify Developer app, then paste its credentials.
      </text>
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
  const toasts = useToasts();
  const renderer = useRenderer();
  const [paste, setPaste] = useState('');

  const submitPaste = (): void => {
    const url = paste.trim();
    if (url === '') return;
    void commands.run('spotify.submit-redirect', { url });
  };

  const copyAuthUrl = (): void => {
    if (!session.authUrl) return;
    if (renderer.copyToClipboardOSC52(session.authUrl)) {
      toasts.push('Spotify link copied — paste it in a browser.', { tone: 'success' });
    } else {
      toasts.push('Could not copy the Spotify link.', { tone: 'danger' });
    }
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
          <text fg={theme.colors.muted}>1. Copy the Spotify link and open it in a browser:</text>
          <Button label="Copy link" onPress={copyAuthUrl} />
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

/** One library entry. Highlights under the pointer, since the whole row — not
 * a button tucked inside it — is what the click lands on. */
function BrowseRow({
  item,
  width,
  onPress,
}: {
  item: SpotifyLibraryItem;
  width: number;
  onPress: (item: SpotifyLibraryItem) => void;
}): ReactNode {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);

  const metaWidth = width >= 56 ? 18 : 0;
  const nameWidth = Math.max(8, width - metaWidth - 6);

  return (
    <box
      onMouseDown={() => onPress(item)}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      style={{
        flexDirection: 'row',
        gap: 1,
        height: 1,
        flexShrink: 0,
        paddingLeft: 1,
        ...(hovered ? { backgroundColor: theme.colors.border } : {}),
      }}
    >
      <text fg={hovered ? theme.colors.accent : theme.colors.muted}>{hovered ? '▸' : '·'}</text>
      <text fg={hovered ? theme.colors.accent : theme.colors.text}>
        {clipText(item.name, nameWidth)}
      </text>
      <box style={{ flexGrow: 1 }} />
      {metaWidth > 0 && item.meta ? (
        <text fg={theme.colors.muted}>{clipText(item.meta, metaWidth)}</text>
      ) : null}
    </box>
  );
}

/** A podcast's episodes, loaded on demand by `spotify.show-episodes`. */
function EpisodesPage({
  show,
  episodes,
  width,
  onBack,
  onPlayed,
}: {
  show: SpotifyLibraryItem;
  episodes: SpotifyEpisodesState;
  width: number;
  onBack: () => void;
  onPlayed: () => void;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();

  // The entity is shared, so ignore whatever is left over from a show that is
  // no longer on screen.
  const current = episodes.showId === show.id ? episodes : null;

  const playEpisode = (item: SpotifyLibraryItem): void => {
    void commands.run('spotify.play-episode', { uri: item.uri });
    onPlayed();
  };

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <Button label="← Podcasts" onPress={onBack} />
        <text fg={theme.colors.accent}>{clipText(show.name, Math.max(8, width - 20))}</text>
      </box>

      {current === null || current.loading ? (
        <EmptyState message="Loading episodes…" />
      ) : current.error ? (
        <ErrorState message={current.error} />
      ) : current.items.length === 0 ? (
        <EmptyState message="No episodes here." hint="Try another podcast." />
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          {current.items.map((item) => (
            <BrowseRow key={item.id} item={item} width={width} onPress={playEpisode} />
          ))}
        </scrollbox>
      )}

      <text fg={theme.colors.muted}>Click an episode to play it.</text>
    </box>
  );
}

/**
 * The library, given the whole widget: playlists and podcasts on their own
 * tabs rather than stacked in one scroll, so neither buries the other.
 */
function BrowsePage({
  library,
  episodes,
  width,
  onBack,
  onPlayed,
}: {
  library: SpotifyLibraryState;
  episodes: SpotifyEpisodesState;
  width: number;
  onBack: () => void;
  onPlayed: () => void;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [tab, setTab] = useState('playlists');
  const [show, setShow] = useState<SpotifyLibraryItem | null>(null);

  if (show) {
    return (
      <EpisodesPage
        show={show}
        episodes={episodes}
        width={width}
        onBack={() => setShow(null)}
        onPlayed={onPlayed}
      />
    );
  }

  const items = tab === 'playlists' ? library.playlists : library.shows;
  const label = tab === 'playlists' ? 'playlists' : 'podcasts';

  const press = (item: SpotifyLibraryItem): void => {
    if (item.kind === 'show') {
      void commands.run('spotify.show-episodes', { uri: item.uri, name: item.name });
      setShow(item);
      return;
    }
    void commands.run('spotify.play-context', { uri: item.uri });
    onPlayed();
  };

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <Button label="← Back" onPress={onBack} />
        <text fg={theme.colors.muted}>
          {items.length} {label}
        </text>
        <box style={{ flexGrow: 1 }} />
        <IconButton
          icon="reset"
          label="Refresh"
          onPress={() => void commands.run('spotify.refresh')}
        />
      </box>

      <Tabs
        items={[
          { id: 'playlists', label: `Playlists (${library.playlists.length})` },
          { id: 'shows', label: `Podcasts (${library.shows.length})` },
        ]}
        value={tab}
        onChange={setTab}
      >
        {library.error ? (
          <ErrorState message={library.error} />
        ) : items.length === 0 ? (
          <EmptyState message={`No ${label} yet.`} hint="Refresh to reload your library." />
        ) : (
          <scrollbox style={{ flexGrow: 1 }}>
            {items.map((item) => (
              <BrowseRow key={item.id} item={item} width={width} onPress={press} />
            ))}
          </scrollbox>
        )}
      </Tabs>

      <text fg={theme.colors.muted}>
        {tab === 'playlists'
          ? 'Click a playlist to play it here.'
          : 'Click a podcast for episodes.'}
      </text>
    </box>
  );
}

/** Title, artist and device — the part of the widget that should read from
 * across the room. */
function NowPlaying({
  player,
  isPlaying,
  width,
  compact,
}: {
  player: SpotifyPlayerState;
  isPlaying: boolean;
  width: number;
  compact: boolean;
}): ReactNode {
  const theme = useTheme();

  if (!player.name) {
    return (
      <EmptyState message="Nothing playing" hint="Press Browse to pick a playlist or podcast." />
    );
  }

  const mark = isPlaying ? PLAY_GLYPH : PAUSE_GLYPH;
  const detail = [player.artists, player.deviceName].filter(Boolean).join(' · ');

  if (compact) {
    return (
      <box style={{ flexDirection: 'column', flexShrink: 0 }}>
        <text fg={theme.colors.text}>
          <span fg={isPlaying ? theme.colors.success : theme.colors.muted}>{mark}</span>{' '}
          {clipText(player.name, Math.max(8, width - 6))}
        </text>
        {detail ? (
          <text fg={theme.colors.muted}>{clipText(detail, Math.max(8, width - 2))}</text>
        ) : null}
      </box>
    );
  }

  return (
    <box style={{ flexDirection: 'column', flexShrink: 0, gap: 0 }}>
      <box style={{ flexDirection: 'row', gap: 1, height: 1 }}>
        <text fg={isPlaying ? theme.colors.success : theme.colors.muted}>{mark}</text>
        <text fg={theme.colors.accent}>
          <b>{clipText(player.name, Math.max(10, width - 8))}</b>
        </text>
      </box>
      {player.artists ? (
        <text fg={theme.colors.text}>{clipText(player.artists, Math.max(10, width - 4))}</text>
      ) : null}
      {player.deviceName ? (
        <text fg={theme.colors.muted}>
          {clipText(`on ${player.deviceName}`, Math.max(10, width - 4))}
        </text>
      ) : null}
    </box>
  );
}

function ReadyPane({
  session,
  player,
  library,
  episodes,
  width,
  height,
}: {
  session: SpotifySessionState;
  player: SpotifyPlayerState;
  library: SpotifyLibraryState;
  episodes: SpotifyEpisodesState;
  width: number;
  height: number;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [browsing, setBrowsing] = useState(false);
  // Transport should answer the press, not the next poll — the guess stands
  // until a fresh reading of the player replaces it.
  const [guess, setGuess] = useState<{ isPlaying: boolean; at: string | null } | null>(null);

  const isPlaying = guess && guess.at === player.updatedAt ? guess.isPlaying : player.isPlaying;
  const now = useTicker(isPlaying);
  const layout = resolveLayout(width, height);
  const compact = layout === 'compact';

  if (browsing) {
    // Starting something is the end of browsing: playback is the hero, so the
    // page steps back out of the way as soon as it has done its job.
    return (
      <BrowsePage
        library={library}
        episodes={episodes}
        width={width}
        onBack={() => setBrowsing(false)}
        onPlayed={() => setBrowsing(false)}
      />
    );
  }

  const run = (command: string, playing: boolean): void => {
    setGuess({ isPlaying: playing, at: player.updatedAt });
    void commands.run(command);
  };

  const progressMs = interpolateProgress({ ...player, isPlaying }, now);
  const barWidth = Math.max(8, Math.min(width - 22, 64));
  const who = session.userDisplayName ? ` · ${session.userDisplayName}` : '';

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, gap: compact ? 0 : 1 }}>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <text fg={theme.colors.muted}>{clipText(`Spotify${who}`, Math.max(8, width - 26))}</text>
        <box style={{ flexGrow: 1 }} />
        <IconButton icon="apps" label="Browse" onPress={() => setBrowsing(true)} />
        <IconButton icon="reset" onPress={() => void commands.run('spotify.refresh')} />
      </box>

      {/* A failed request is announced through `context.notify`, so nothing
          here grows a warning line and shoves the transport down the widget. */}

      {/* Length is explicit: a divider left to grow would stretch down the
          column instead of ruling across it. */}
      {layout === 'wide' ? <Divider length={Math.max(4, width - 4)} /> : null}

      <box
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
          gap: compact ? 0 : 1,
        }}
      >
        <NowPlaying player={player} isPlaying={isPlaying} width={width} compact={compact} />

        {player.name ? (
          <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
            <ProgressBar
              value={progressRatio(progressMs, player.durationMs)}
              width={barWidth}
              tone={isPlaying ? 'success' : 'accent'}
            />
            <text fg={theme.colors.muted}>{formatProgress(progressMs, player.durationMs)}</text>
          </box>
        ) : null}
      </box>

      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        {compact ? (
          <Toolbar>
            <IconButton
              icon={COMPACT_PREVIOUS_GLYPH}
              onPress={() => run('spotify.previous', isPlaying)}
            />
            {isPlaying ? (
              <IconButton icon={PAUSE_GLYPH} onPress={() => run('spotify.pause', false)} />
            ) : (
              <IconButton icon={PLAY_GLYPH} onPress={() => run('spotify.play', true)} />
            )}
            <IconButton icon={COMPACT_NEXT_GLYPH} onPress={() => run('spotify.next', isPlaying)} />
          </Toolbar>
        ) : (
          <>
            <Button label={PREVIOUS_GLYPH} onPress={() => run('spotify.previous', isPlaying)} />
            {isPlaying ? (
              <Button label={PAUSE_GLYPH} primary onPress={() => run('spotify.pause', false)} />
            ) : (
              <Button label={PLAY_GLYPH} primary onPress={() => run('spotify.play', true)} />
            )}
            <Button label={NEXT_GLYPH} onPress={() => run('spotify.next', isPlaying)} />
          </>
        )}
        <box style={{ flexGrow: 1 }} />
        {layout === 'wide' ? (
          <IconButton
            icon="cross"
            label="Disconnect"
            onPress={() => void commands.run('spotify.disconnect')}
          />
        ) : null}
      </box>
    </box>
  );
}

/**
 * Spotify Connect controller: credentials → OAuth → now playing + library.
 * Secrets stay in plugin storage; only status flags live on the session entity.
 */
export function PlayerWidget({ width, height }: WidgetProps): ReactNode {
  const commands = useCommands();
  const sessionEntity = useEntity<SpotifySessionState>(SPOTIFY_SESSION_ENTITY);
  const playerEntity = useEntity<SpotifyPlayerState>(SPOTIFY_PLAYER_ENTITY);
  const libraryEntity = useEntity<SpotifyLibraryState>(SPOTIFY_LIBRARY_ENTITY);
  const episodesEntity = useEntity<SpotifyEpisodesState>(SPOTIFY_EPISODES_ENTITY);
  const session = sessionEntity?.state ?? initialSessionState();
  const player = playerEntity?.state ?? initialPlayerState();
  const library = libraryEntity?.state ?? initialLibraryState();
  const episodes = episodesEntity?.state ?? initialEpisodesState();

  useEffect(() => {
    void commands.run('spotify.widget-mounted');
    return () => {
      void commands.run('spotify.widget-unmounted');
    };
  }, [commands]);

  if (session.status === 'needs_credentials') {
    return <CredentialsForm error={session.error} />;
  }

  if (session.status === 'needs_auth' || session.status === 'connecting') {
    return <ConnectPane session={session} />;
  }

  if (session.status === 'error') {
    return <CredentialsForm error={session.error} />;
  }

  return (
    <ReadyPane
      session={session}
      player={player}
      library={library}
      episodes={episodes}
      width={width}
      height={height}
    />
  );
}
