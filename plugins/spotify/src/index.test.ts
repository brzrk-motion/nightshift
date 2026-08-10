import { describe, expect, it } from 'vitest';
import type { Json, PluginCommand, PluginContext, PluginWidget } from '@nightshift/sdk';
import { createEntityStore } from '@nightshift/entities';
import plugin from './index.js';
import { SPOTIFY_SESSION_ENTITY, type SpotifySessionState } from './entity.js';

function mockContext(overrides: {
  storage?: Record<string, Json>;
  fetch?: PluginContext['fetch'];
} = {}): {
  context: PluginContext;
  commands: PluginCommand[];
  widgets: PluginWidget[];
  storage: Record<string, Json>;
} {
  const entities = createEntityStore();
  const commands: PluginCommand[] = [];
  const widgets: PluginWidget[] = [];
  const storage: Record<string, Json> = { ...(overrides.storage ?? {}) };

  const context: PluginContext = {
    manifest: plugin.manifest,
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
    registerAutomation: () => {},
    own: () => {},
  };

  return { context, commands, widgets, storage };
}

describe('spotify plugin', () => {
  it('declares network among its capabilities', () => {
    expect(plugin.manifest.id).toBe('spotify');
    expect(plugin.manifest.capabilities).toContain('network');
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
});
