import { describe, expect, it, vi } from 'vitest';
import type { Json, PluginCommand, PluginContext, PluginWidget } from '@nightshift/sdk';
import { createEntityStore } from '@nightshift/entities';
import plugin from './index.js';
import {
  HOME_ASSISTANT_CONNECTION_ENTITY,
  HOME_ASSISTANT_SCENES_ENTITY,
  type ConnectionState,
  type ScenesState,
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
  storage: Record<string, Json>;
  notify: PluginContext['notify'];
} {
  const entities = createEntityStore();
  const commands: PluginCommand[] = [];
  const widgets: PluginWidget[] = [];
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
        throw new Error('home-assistant tests do not use network by default');
      }),
    registerCommand: (command) => void commands.push(command),
    registerWidget: (widget) => void widgets.push(widget),
    registerEntity: (id, state, meta) => entities.register(id, state, meta),
    registerAutomation: () => {},
    own: () => {},
  };

  return { context, commands, widgets, storage, notify };
}

describe('home-assistant plugin', () => {
  it('declares network among its capabilities', () => {
    expect(plugin.manifest.id).toBe('home-assistant');
    expect(plugin.manifest.capabilities).toContain('network');
  });

  it('registers entities, widget, and commands without throwing on corrupt storage', async () => {
    const { context, commands, widgets } = mockContext({
      storage: { credentials: { version: 99 } as Json },
    });
    await expect(plugin.setup(context)).resolves.toBeUndefined();
    expect(widgets.map((w) => w.type)).toContain('home-assistant.scenes');
    expect(commands.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        'home-assistant.configure',
        'home-assistant.clear',
        'home-assistant.refresh',
        'home-assistant.activate-scene',
        'home-assistant.widget-mounted',
        'home-assistant.widget-unmounted',
      ]),
    );
    const connection = context.entities.get<ConnectionState>(
      HOME_ASSISTANT_CONNECTION_ENTITY,
    )?.state;
    expect(connection?.configured).toBe(false);
    expect(JSON.stringify(connection)).not.toContain('token');
  });

  it('persists credentials via configure without putting the token on the entity', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('/api/')) return new Response('{"message":"API running."}', { status: 200 });
      if (url.endsWith('/api/states')) {
        return new Response(
          JSON.stringify([
            {
              entity_id: 'scene.focus',
              state: 'scening',
              attributes: { friendly_name: 'Focus' },
            },
          ]),
          { status: 200 },
        );
      }
      throw new Error(`unexpected ${url}`);
    });
    const { context, commands, storage } = mockContext({ fetch: fetchFn });
    await plugin.setup(context);

    const configure = commands.find((c) => c.id === 'home-assistant.configure');
    await configure?.run({ address: '192.168.1.10', token: 'secret-token' });

    expect(storage['credentials']).toEqual({
      version: 1,
      baseUrl: 'http://192.168.1.10:8123',
      token: 'secret-token',
    });
    const connection = context.entities.get<ConnectionState>(
      HOME_ASSISTANT_CONNECTION_ENTITY,
    )?.state;
    expect(connection?.configured).toBe(true);
    expect(connection?.status).toBe('connected');
    expect(JSON.stringify(connection)).not.toContain('secret-token');

    const scenes = context.entities.get<ScenesState>(HOME_ASSISTANT_SCENES_ENTITY)?.state;
    expect(scenes?.scenes).toEqual([{ entityId: 'scene.focus', name: 'Focus', state: 'scening' }]);
  });

  it('surfaces auth errors without throwing', async () => {
    const fetchFn = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
    const { context, commands } = mockContext({ fetch: fetchFn });
    await plugin.setup(context);
    const configure = commands.find((c) => c.id === 'home-assistant.configure');
    await expect(
      configure?.run({ address: '192.168.1.10', token: 'bad' }),
    ).resolves.toBeUndefined();
    const connection = context.entities.get<ConnectionState>(
      HOME_ASSISTANT_CONNECTION_ENTITY,
    )?.state;
    expect(connection?.status).toBe('error');
    expect(connection?.configured).toBe(true);
  });

  it('activate-scene soft-fails on missing entity_id and does not throw', async () => {
    const { context, commands } = mockContext({
      storage: {
        credentials: {
          version: 1,
          baseUrl: 'http://192.168.1.10:8123',
          token: 'tok',
        },
      },
      fetch: async () => new Response('{"message":"API running."}', { status: 200 }),
    });
    await plugin.setup(context);
    const activate = commands.find((c) => c.id === 'home-assistant.activate-scene');
    await expect(activate?.run({})).resolves.toBeUndefined();
    await expect(activate?.run({ entity_id: 'light.not_a_scene' })).resolves.toBeUndefined();
  });

  it('activate-scene POSTs turn_on and soft-fails on network errors', async () => {
    const fetchFn = vi.fn(async (url: string, init?: { method?: string }) => {
      if (url.endsWith('/api/')) return new Response('{}', { status: 200 });
      if (url.endsWith('/api/states')) return new Response('[]', { status: 200 });
      if (url.endsWith('/api/services/scene/turn_on') && init?.method === 'POST') {
        return new Response('[]', { status: 200 });
      }
      throw new Error(`unexpected ${url}`);
    });
    const { context, commands } = mockContext({
      storage: {
        credentials: {
          version: 1,
          baseUrl: 'http://192.168.1.10:8123',
          token: 'tok',
        },
      },
      fetch: fetchFn,
    });
    await plugin.setup(context);
    await commands.find((c) => c.id === 'home-assistant.widget-mounted')?.run();
    await vi.waitFor(() => {
      expect(
        context.entities.get<ConnectionState>(HOME_ASSISTANT_CONNECTION_ENTITY)?.state?.status,
      ).toBe('connected');
    });

    const activate = commands.find((c) => c.id === 'home-assistant.activate-scene');
    await activate?.run({ entity_id: 'scene.focus' });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://192.168.1.10:8123/api/services/scene/turn_on',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ entity_id: 'scene.focus' }),
      }),
    );

    fetchFn.mockImplementation(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(activate?.run({ entity_id: 'scene.focus' })).resolves.toBeUndefined();
  });

  it('clear removes credentials and resets entities', async () => {
    const { context, commands, storage } = mockContext({
      storage: {
        credentials: {
          version: 1,
          baseUrl: 'http://192.168.1.10:8123',
          token: 'tok',
        },
      },
      fetch: async (url: string) => {
        if (url.endsWith('/api/')) return new Response('{}', { status: 200 });
        if (url.endsWith('/api/states')) return new Response('[]', { status: 200 });
        throw new Error(url);
      },
    });
    await plugin.setup(context);
    const clear = commands.find((c) => c.id === 'home-assistant.clear');
    await clear?.run();
    expect(storage['credentials']).toBeUndefined();
    expect(
      context.entities.get<ConnectionState>(HOME_ASSISTANT_CONNECTION_ENTITY)?.state?.configured,
    ).toBe(false);
    expect(context.entities.get<ScenesState>(HOME_ASSISTANT_SCENES_ENTITY)?.state?.scenes).toEqual(
      [],
    );
  });

  it('reconfigure replaces the token used by subsequent activates', async () => {
    const tokensSeen: string[] = [];
    const fetchFn = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      const auth = init?.headers?.['Authorization'] ?? '';
      if (url.includes('turn_on')) tokensSeen.push(auth);
      if (url.endsWith('/api/') || url.endsWith('/api/states') || url.includes('turn_on')) {
        return new Response(url.endsWith('/api/states') ? '[]' : '{}', { status: 200 });
      }
      throw new Error(url);
    });
    const { context, commands } = mockContext({ fetch: fetchFn });
    await plugin.setup(context);
    const configure = commands.find((c) => c.id === 'home-assistant.configure');
    const activate = commands.find((c) => c.id === 'home-assistant.activate-scene');
    await configure?.run({ address: '10.0.0.1', token: 'first' });
    await activate?.run({ entity_id: 'scene.a' });
    await configure?.run({ address: '10.0.0.1', token: 'second' });
    await activate?.run({ entity_id: 'scene.a' });
    expect(tokensSeen.some((h) => h.includes('first'))).toBe(true);
    expect(tokensSeen.some((h) => h.includes('second'))).toBe(true);
  });

  it('does not hit the network on setup when credentials are stored but no widget is mounted', async () => {
    const fetchFn = vi.fn(async () => new Response('[]', { status: 200 }));
    const { context, commands } = mockContext({
      storage: {
        credentials: {
          version: 1,
          baseUrl: 'http://192.168.1.10:8123',
          token: 'tok',
        },
      },
      fetch: fetchFn,
    });
    await plugin.setup(context);

    expect(fetchFn).not.toHaveBeenCalled();

    await commands.find((c) => c.id === 'home-assistant.widget-mounted')?.run();
    expect(fetchFn).toHaveBeenCalled();
  });
});
