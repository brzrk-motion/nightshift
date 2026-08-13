import { describe, expect, it, vi } from 'vitest';
import type {
  AutomationSpec,
  Json,
  PluginCommand,
  PluginContext,
  PluginWidget,
} from '@nightshift/sdk';
import { createEntityStore } from '@nightshift/entities';
import plugin from './index.js';
import { PLAYER_SETTLE_MS } from './format.js';
import {
  SPOTIFY_PLAYER_ENTITY,
  SPOTIFY_SESSION_ENTITY,
  type SpotifyPlayerState,
  type SpotifySessionState,
} from './entity.js';

function mockContext(
  overrides: {
    storage?: Record<string, Json>;
    fetch?: PluginContext['fetch'];
  } = {},
): {
  context: PluginContext;
  commands: PluginCommand[];
  widgets: PluginWidget[];
  automations: AutomationSpec[];
  storage: Record<string, Json>;
  notify: PluginContext['notify'];
} {
  const entities = createEntityStore();
  const commands: PluginCommand[] = [];
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const storage: Record<string, Json> = { ...(overrides.storage ?? {}) };
  const notify = vi.fn();

  const context: PluginContext = {
    manifest: plugin.manifest,
    notify,
    log: {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
    },
    entities,
    storage: {
      get: async <T extends Json>(key: string) => storage[key] as T | undefined,
      set: async (key, value) => {
        storage[key] = value;
      },
      delete: async (key) => {
        delete storage[key];
      },
    },
    fetch:
      overrides.fetch ??
      (async () => {
        throw new Error('spotify tests do not use network by default');
      }),
    registerCommand: (command) => void commands.push(command),
    registerWidget: (widget) => void widgets.push(widget),
    registerEntity: (id, state, meta) => entities.register(id, state, meta),
    registerAutomation: (automation) => void automations.push(automation),
    own: () => {},
  };

  return { context, commands, widgets, automations, storage, notify };
}

const CONNECTED_AUTH: Json = {
  clientId: 'cid',
  clientSecret: 'csecret',
  refreshToken: 'refresh',
  accessToken: 'access',
  expiresAt: Date.now() + 3_600_000,
};

describe('spotify plugin', () => {
  it('declares network among its capabilities', () => {
    expect(plugin.manifest.id).toBe('spotify');
    expect(plugin.manifest.capabilities).toContain('network');
    expect(plugin.manifest.capabilities).toContain('automations:register');
  });

  it('pauses ambient noise when Spotify starts playing', async () => {
    const { context, automations } = mockContext();
    await plugin.setup(context);
    expect(automations).toHaveLength(1);
    expect(automations[0]).toMatchObject({
      name: 'spotify.pause-ambient-noise',
      when: { type: 'entity', entity: SPOTIFY_PLAYER_ENTITY, key: 'isPlaying' },
      and: [{ type: 'equals', entity: SPOTIFY_PLAYER_ENTITY, key: 'isPlaying', value: true }],
      then: [{ command: 'ambient-noise.pause' }],
    });
  });

  it('registers the player widget and transport commands', async () => {
    const { context, commands, widgets } = mockContext();
    await plugin.setup(context);
    expect(widgets.map((w) => w.type)).toContain('spotify.player');
    expect(commands.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        'spotify.configure',
        'spotify.connect',
        'spotify.play',
        'spotify.pause',
        'spotify.next',
        'spotify.previous',
        'spotify.play-context',
        'spotify.show-episodes',
        'spotify.play-episode',
      ]),
    );
  });

  it('starts in needs_credentials with empty storage', async () => {
    const { context } = mockContext();
    await plugin.setup(context);
    const session = context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state;
    expect(session?.status).toBe('needs_credentials');
  });

  it('persists credentials via spotify.configure without putting the secret on the entity', async () => {
    const { context, commands, storage } = mockContext();
    await plugin.setup(context);
    const configure = commands.find((c) => c.id === 'spotify.configure');
    await configure?.run({ clientId: 'cid', clientSecret: 'csecret' });

    expect(storage['auth']).toEqual({ clientId: 'cid', clientSecret: 'csecret' });
    const session = context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state;
    expect(session?.status).toBe('needs_auth');
    expect(session?.clientIdSet).toBe(true);
    expect(JSON.stringify(session)).not.toContain('csecret');
  });

  it('re-reads the player after Spotify has had time to accept a play', async () => {
    vi.useFakeTimers();
    try {
      let playing = false;
      const calls: string[] = [];
      const fetchFn: PluginContext['fetch'] = async (url) => {
        calls.push(url);
        if (url.includes('/me/player/devices')) {
          return new Response(
            JSON.stringify({ devices: [{ id: 'dev-1', name: 'Laptop', is_active: true }] }),
          );
        }
        if (url.includes('/me/player/play')) {
          playing = true;
          return new Response(null, { status: 204 });
        }
        if (url.includes('/me/player/currently-playing')) {
          // Spotify keeps reporting the old state for a moment after the play.
          if (!playing) return new Response(null, { status: 204 });
          return new Response(
            JSON.stringify({
              is_playing: true,
              progress_ms: 0,
              item: { name: 'Night Drive', type: 'track', duration_ms: 180_000 },
            }),
          );
        }
        return new Response(JSON.stringify({ items: [], next: null }));
      };

      const { context, commands } = mockContext({
        storage: {
          auth: {
            clientId: 'cid',
            clientSecret: 'csecret',
            refreshToken: 'refresh',
            accessToken: 'access',
            expiresAt: Date.now() + 3_600_000,
          },
        },
        fetch: fetchFn,
      });
      await plugin.setup(context);
      await vi.advanceTimersByTimeAsync(0);

      const play = commands.find((c) => c.id === 'spotify.play-context');
      await play?.run({ uri: 'spotify:playlist:p1' });

      const before = calls.filter((url) => url.includes('currently-playing')).length;
      await vi.advanceTimersByTimeAsync(PLAYER_SETTLE_MS);
      expect(calls.filter((url) => url.includes('currently-playing')).length).toBeGreaterThan(
        before,
      );

      const player = context.entities.get<SpotifyPlayerState>(SPOTIFY_PLAYER_ENTITY)?.state;
      expect(player?.isPlaying).toBe(true);
      expect(player?.name).toBe('Night Drive');
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces a failed request instead of parking it on the session entity', async () => {
    const { context, commands, notify } = mockContext({
      storage: { auth: CONNECTED_AUTH },
      fetch: async () =>
        new Response('{"error":{"message":"Service unavailable"}}', { status: 503 }),
    });
    await plugin.setup(context);

    await commands.find((c) => c.id === 'spotify.refresh')?.run();

    expect(notify).toHaveBeenCalledWith('Service unavailable', {
      tone: 'danger',
      key: 'request',
    });
    const session = context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state;
    // The player stays on screen, unshoved: nothing for the widget to draw.
    expect(session?.status).toBe('ready');
    expect(session?.error).toBeNull();
  });

  it('announces the same failure once however often the poll repeats', async () => {
    const { context, commands, notify } = mockContext({
      storage: { auth: CONNECTED_AUTH },
      fetch: async () =>
        new Response('{"error":{"message":"Service unavailable"}}', { status: 503 }),
    });
    await plugin.setup(context);
    const refresh = commands.find((c) => c.id === 'spotify.refresh');

    await refresh?.run();
    await refresh?.run();
    await refresh?.run();

    expect(notify).toHaveBeenCalledOnce();
  });

  it('announces a 403 as the Premium warning it is', async () => {
    const { context, commands, notify } = mockContext({
      storage: { auth: CONNECTED_AUTH },
      fetch: async () =>
        new Response('{"error":{"message":"Player command failed"}}', { status: 403 }),
    });
    await plugin.setup(context);

    await commands.find((c) => c.id === 'spotify.refresh')?.run();

    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Premium'), {
      tone: 'warning',
      key: 'request',
    });
    const session = context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state;
    expect(session?.premiumRequired).toBe(true);
    expect(session?.error).toBeNull();
  });

  it('keeps a lost session on the entity, since the widget has to draw the connect form', async () => {
    const { context, commands, notify } = mockContext({
      storage: { auth: CONNECTED_AUTH },
      fetch: async () =>
        new Response('{"error":{"message":"Invalid access token"}}', { status: 401 }),
    });
    await plugin.setup(context);

    await commands.find((c) => c.id === 'spotify.refresh')?.run();

    const session = context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state;
    expect(session?.status).toBe('needs_auth');
    expect(session?.error).toContain('Invalid access token');
    // The pane it switches to says why; a toast on top would be saying it twice.
    expect(notify).not.toHaveBeenCalled();
  });

  it('announces a failure again once a good poll has been and gone', async () => {
    let failing = true;
    const { context, commands, notify } = mockContext({
      storage: { auth: CONNECTED_AUTH },
      fetch: async (url) => {
        if (failing)
          return new Response('{"error":{"message":"Service unavailable"}}', { status: 503 });
        if (url.includes('currently-playing')) return new Response(null, { status: 204 });
        return new Response(JSON.stringify({ items: [], next: null }));
      },
    });
    await plugin.setup(context);
    const refresh = commands.find((c) => c.id === 'spotify.refresh');

    await refresh?.run();
    failing = false;
    await refresh?.run();
    failing = true;
    await refresh?.run();

    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('resets credentials completely', async () => {
    const { context, commands, storage } = mockContext({
      storage: { auth: { clientId: 'cid', clientSecret: 'csecret' } },
    });
    await plugin.setup(context);
    const reset = commands.find((c) => c.id === 'spotify.reset-credentials');
    await reset?.run();
    expect(storage['auth']).toBeUndefined();
    const session = context.entities.get<SpotifySessionState>(SPOTIFY_SESSION_ENTITY)?.state;
    expect(session?.status).toBe('needs_credentials');
  });

  it('does not hit the network on setup when connected but the widget is off-screen', async () => {
    const fetchFn = vi.fn(
      async () => new Response('{"error":{"message":"Service unavailable"}}', { status: 503 }),
    );
    const { context, commands } = mockContext({
      storage: { auth: CONNECTED_AUTH },
      fetch: fetchFn,
    });
    await plugin.setup(context);

    expect(fetchFn).not.toHaveBeenCalled();

    await commands.find((c) => c.id === 'spotify.widget-mounted')?.run();
    expect(fetchFn).toHaveBeenCalled();
  });

  it('stops polling when the widget unmounts', async () => {
    vi.useFakeTimers();
    try {
      let playingPolls = 0;
      const fetchFn = vi.fn(async (url: string) => {
        if (url.includes('currently-playing')) {
          playingPolls += 1;
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ items: [], next: null }));
      });
      const { context, commands } = mockContext({
        storage: { auth: CONNECTED_AUTH },
        fetch: fetchFn,
      });
      await plugin.setup(context);
      const mounted = commands.find((c) => c.id === 'spotify.widget-mounted');
      const unmounted = commands.find((c) => c.id === 'spotify.widget-unmounted');

      await mounted?.run();
      // refreshAll is fire-and-forget — flush it without advancing the poll timer.
      await vi.advanceTimersByTimeAsync(0);

      await unmounted?.run();
      const pollsAfterUnmount = playingPolls;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(playingPolls).toBe(pollsAfterUnmount);
    } finally {
      vi.useRealTimers();
    }
  });
});
