import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isNightshiftError, NIGHTSHIFT_API_VERSION } from '@nightshift/core';
import { createEntityStore, type EntityStore } from '@nightshift/entities';
import { definePlugin, type Capability, type PluginContext } from '@nightshift/sdk';
import { createPluginHost } from './host.js';
import { createPermissionPolicy } from './permissions.js';
import type { PluginSource } from './discovery.js';

let dataDir: string;
let entities: EntityStore;

const source: PluginSource = { id: 'demo', specifier: 'demo', origin: 'config' };

function demo(
  overrides: {
    id?: string;
    capabilities?: Capability[];
    apiVersion?: number;
    setup?: (context: PluginContext) => void | Promise<void>;
    teardown?: () => void | Promise<void>;
  } = {},
) {
  const plugin = definePlugin({
    id: overrides.id ?? 'demo',
    name: 'Demo',
    version: '1.0.0',
    capabilities: overrides.capabilities ?? [
      'entities:write',
      'widgets:register',
      'commands:register',
    ],
    ...(overrides.apiVersion === undefined ? {} : { apiVersion: overrides.apiVersion }),
    setup: overrides.setup ?? (() => {}),
    ...(overrides.teardown === undefined ? {} : { teardown: overrides.teardown }),
  });
  return { default: plugin };
}

function host(module: unknown, grants?: Record<string, Capability[] | 'all'>) {
  return createPluginHost({
    entities,
    dataDir,
    policy: createPermissionPolicy(grants === undefined ? {} : { grants }),
    importer: async () => module,
  });
}

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'nightshift-host-'));
  entities = createEntityStore();
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe('createPluginHost', () => {
  it('loads a plugin and records what it contributed', async () => {
    const plugins = host(
      demo({
        setup: (context) => {
          context.registerEntity('timer.focus', { status: 'idle' });
          context.registerWidget({ type: 'demo.card', title: 'Demo', entities: ['timer.focus'] });
          context.registerCommand({ id: 'demo.go', title: 'Go', run: () => {} });
          context.registerAutomation({
            name: 'demo.notice',
            when: { type: 'entity', entity: 'timer.focus' },
            then: [{ command: 'demo.go' }],
          });
        },
      }),
    );

    const loaded = await plugins.load(source);

    expect(loaded.manifest.id).toBe('demo');
    expect(loaded.entities).toEqual(['timer.focus']);
    expect(plugins.widgets().map((widget) => widget.type)).toEqual(['demo.card']);
    expect(plugins.commands().map((command) => command.id)).toEqual(['demo.go']);
    expect(plugins.automations().map((automation) => automation.name)).toEqual(['demo.notice']);
    expect(entities.get('timer.focus')?.meta.owner).toBe('demo');
  });

  it('grants automations:register automatically, like widgets and commands', async () => {
    const plugins = host(
      demo({
        capabilities: [],
        setup: (context) => {
          context.registerAutomation({ name: 'demo.notice', when: { type: 'startup' }, then: [] });
        },
      }),
    );

    await expect(plugins.load(source)).resolves.toBeTruthy();
    expect(plugins.automations()).toHaveLength(1);
  });

  it('announces a load', async () => {
    const plugins = host(demo());
    const loadedEvent = vi.fn();
    plugins.events.on('loaded', loadedEvent);

    await plugins.load(source);

    expect(loadedEvent).toHaveBeenCalledOnce();
  });

  it('passes a notification raised during setup on to whoever is listening', async () => {
    const plugins = host(
      demo({
        capabilities: [],
        setup: (context) => {
          context.notify('Spotify would not answer.', { tone: 'warning', key: 'request' });
        },
      }),
    );
    const notified = vi.fn();
    plugins.events.on('notification', notified);

    await plugins.load(source);

    expect(notified).toHaveBeenCalledWith({
      pluginId: 'demo',
      message: 'Spotify would not answer.',
      tone: 'warning',
      // Namespaced, so one plugin's "request" cannot replace another's.
      key: 'demo:request',
    });
  });

  it('defaults a notification to the info tone and trims the message', async () => {
    // No capabilities declared: `notify` comes for free, like `log`.
    const plugins = host(
      demo({ capabilities: [], setup: (context) => context.notify('  Ready.  ') }),
    );
    const notified = vi.fn();
    plugins.events.on('notification', notified);

    await plugins.load(source);

    expect(notified).toHaveBeenCalledWith({ pluginId: 'demo', message: 'Ready.', tone: 'info' });
  });

  it('ignores an empty notification', async () => {
    const plugins = host(demo({ capabilities: [], setup: (context) => context.notify('   ') }));
    const notified = vi.fn();
    plugins.events.on('notification', notified);

    await plugins.load(source);

    expect(notified).not.toHaveBeenCalled();
  });

  it('rejects a module that is not a plugin', async () => {
    await expect(host({ default: { nope: true } }).load(source)).rejects.toThrowError(
      /does not export a Nightshift plugin/,
    );
  });

  it('reports an import failure with the specifier', async () => {
    const plugins = createPluginHost({
      entities,
      dataDir,
      importer: () => Promise.reject(new Error('ENOENT')),
    });

    await expect(plugins.load(source)).rejects.toThrowError(/Could not import "demo"/);
  });

  it('refuses a plugin built against a different SDK version', async () => {
    const plugins = host(demo({ apiVersion: NIGHTSHIFT_API_VERSION + 1 }));

    try {
      await plugins.load(source);
      expect.unreachable('load should have thrown');
    } catch (error) {
      expect(isNightshiftError(error) && error.code).toBe('PLUGIN_INCOMPATIBLE');
    }
  });

  it('refuses a plugin asking for a capability it has not been granted', async () => {
    const plugins = host(demo({ capabilities: ['network', 'shell'] }));

    try {
      await plugins.load(source);
      expect.unreachable('load should have thrown');
    } catch (error) {
      expect(isNightshiftError(error) && error.code).toBe('PERMISSION_DENIED');
      expect(isNightshiftError(error) && error.message).toMatch(/network, shell/);
    }
  });

  it('loads a plugin once the sensitive capability is granted', async () => {
    const plugins = host(demo({ capabilities: ['network'] }), { demo: ['network'] });
    await expect(plugins.load(source)).resolves.toMatchObject({ manifest: { id: 'demo' } });
  });

  it('accepts an "all" grant', async () => {
    const plugins = host(demo({ capabilities: ['shell', 'network'] }), { demo: 'all' });
    await expect(plugins.load(source)).resolves.toBeTruthy();
  });

  it('gates context.fetch on the network capability', async () => {
    let denied: unknown;
    const plugins = createPluginHost({
      entities,
      dataDir,
      policy: createPermissionPolicy({ autoGrant: ['entities:read'] }),
      importer: async () =>
        demo({
          capabilities: ['entities:read'],
          setup: async (context) => {
            try {
              await context.fetch('https://example.com/');
            } catch (error) {
              denied = error;
            }
          },
        }),
    });

    await plugins.load(source);

    expect(isNightshiftError(denied) && denied.code).toBe('PERMISSION_DENIED');
  });

  it('refuses public http URLs from context.fetch', async () => {
    let denied: unknown;
    const plugins = host(
      demo({
        capabilities: ['network'],
        setup: async (context) => {
          try {
            await context.fetch('http://example.com/');
          } catch (error) {
            denied = error;
          }
        },
      }),
      { demo: ['network'] },
    );

    await plugins.load(source);

    expect(isNightshiftError(denied) && denied.code).toBe('NETWORK_DENIED');
  });

  it('allows http to private / loopback hosts when network is granted', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const plugins = host(
      demo({
        capabilities: ['network'],
        setup: async (context) => {
          expect((await context.fetch('http://192.168.0.2/')).status).toBe(200);
          expect((await context.fetch('http://127.0.0.1:8123/')).status).toBe(200);
        },
      }),
      { demo: ['network'] },
    );

    await plugins.load(source);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('fetches https URLs when network is granted', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const plugins = host(
      demo({
        capabilities: ['network'],
        setup: async (context) => {
          const response = await context.fetch('https://example.com/weather');
          expect(response.status).toBe(200);
        },
      }),
      { demo: ['network'] },
    );

    await plugins.load(source);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://example.com/weather');
    vi.unstubAllGlobals();
  });

  it('denies a registration the plugin did not ask for', async () => {
    let denied: unknown;
    const plugins = createPluginHost({
      entities,
      dataDir,
      policy: createPermissionPolicy({ autoGrant: ['entities:read'] }),
      importer: async () =>
        demo({
          capabilities: ['entities:read'],
          setup: (context) => {
            try {
              context.registerEntity('timer.focus', {});
            } catch (error) {
              denied = error;
            }
          },
        }),
    });

    await plugins.load(source);

    expect(isNightshiftError(denied) && denied.code).toBe('PERMISSION_DENIED');
    expect(entities.has('timer.focus')).toBe(false);
  });

  it('rolls back a plugin whose setup throws', async () => {
    const plugins = host(
      demo({
        setup: (context) => {
          context.registerEntity('timer.focus', {});
          throw new Error('boom');
        },
      }),
    );

    await expect(plugins.load(source)).rejects.toThrowError(/failed during setup/);
    expect(entities.has('timer.focus')).toBe(false);
    expect(plugins.list()).toEqual([]);
  });

  it('disposes what a failed setup owned', async () => {
    const dispose = vi.fn();
    const plugins = host(
      demo({
        setup: (context) => {
          context.own({ dispose });
          throw new Error('boom');
        },
      }),
    );

    await expect(plugins.load(source)).rejects.toThrow();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('refuses to load the same id twice', async () => {
    const plugins = host(demo());
    await plugins.load(source);

    await expect(plugins.load({ ...source, id: 'other' })).rejects.toThrowError(/already loaded/);
  });

  it('unloads a plugin, running teardown and removing its entities', async () => {
    const teardown = vi.fn();
    const dispose = vi.fn();
    const plugins = host(
      demo({
        teardown,
        setup: (context) => {
          context.registerEntity('timer.focus', {});
          context.own(dispose);
        },
      }),
    );
    await plugins.load(source);

    expect(await plugins.unload('demo')).toBe(true);

    expect(teardown).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    expect(entities.has('timer.focus')).toBe(false);
    expect(plugins.get('demo')).toBeUndefined();
  });

  it('reports unloading something that was never loaded', async () => {
    expect(await host(demo()).unload('nope')).toBe(false);
  });

  it('survives a teardown that throws', async () => {
    const plugins = host(
      demo({
        teardown: () => {
          throw new Error('boom');
        },
        setup: (context) => context.registerEntity('timer.focus', {}),
      }),
    );
    await plugins.load(source);

    await expect(plugins.unload('demo')).resolves.toBe(true);
    expect(entities.has('timer.focus')).toBe(false);
  });

  it('collects failures instead of stopping at the first', async () => {
    const modules: Record<string, unknown> = {
      good: demo({ id: 'good' }),
      bad: { default: {} },
    };
    const plugins = createPluginHost({
      entities,
      dataDir,
      importer: async (specifier) => modules[specifier],
    });

    const result = await plugins.loadAll([
      { id: 'bad', specifier: 'bad', origin: 'config' },
      { id: 'good', specifier: 'good', origin: 'config' },
    ]);

    expect(result.loaded.map((entry) => entry.manifest.id)).toEqual(['good']);
    expect(result.failed.map((entry) => entry.source.id)).toEqual(['bad']);
  });

  it('gives a plugin storage scoped to itself', async () => {
    let stored: unknown;
    const plugins = host(
      demo({
        capabilities: ['storage'],
        setup: async (context) => {
          await context.storage.set('sessions', 3);
          stored = await context.storage.get('sessions');
        },
      }),
    );

    await plugins.load(source);

    expect(stored).toBe(3);
  });

  it('unloads everything at once', async () => {
    const modules: Record<string, unknown> = { a: demo({ id: 'a' }), b: demo({ id: 'b' }) };
    const plugins = createPluginHost({
      entities,
      dataDir,
      importer: async (specifier) => modules[specifier],
    });
    await plugins.loadAll([
      { id: 'a', specifier: 'a', origin: 'config' },
      { id: 'b', specifier: 'b', origin: 'config' },
    ]);

    await plugins.unloadAll();

    expect(plugins.list()).toEqual([]);
  });
});
