import { describe, expect, it, vi } from 'vitest';
import type {
  Disposable,
  Entity,
  EntityId,
  Json,
  PluginCommand,
  PluginContext,
  PluginWidget,
} from '@nightshift/sdk';
import plugin from './index.js';
import { CLOCK_ENTITY, type ClockSettings } from './entity.js';
import { detectSystemTimezone } from './location.js';

/**
 * A minimal, in-memory `PluginContext` — enough to exercise `setup()` exactly
 * as the real plugin host would call it, without depending on
 * `@nightshift/services` from a plugin's own test suite.
 */
function fakeContext(fetchImpl?: PluginContext['fetch']) {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const disposers: (() => void)[] = [];
  const storageData = new Map<string, Json>();
  const notify = vi.fn();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: { id: 'clock', name: 'Clock', version: '0.1.0', apiVersion: 1, capabilities: [] },
    log: { error() {}, warn() {}, info() {}, debug() {} },
    notify,
    entities: {
      get: <State extends Json = Json>(id: EntityId) => entity(id) as Entity<State> | undefined,
      has: (id) => entities.has(id),
      list: () => [...entities.keys()].map((id) => entity(id)!),
      register: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      update: <State extends Json = Json>(id: EntityId, patch: Partial<State>) => {
        const next = { ...(entities.get(id) as Record<string, Json>), ...patch };
        entities.set(id, next);
        return entity(id)! as Entity<State>;
      },
      set: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      remove: (id) => entities.delete(id),
      subscribe: () => () => {},
      subscribeAll: () => () => {},
      // Not exercised by this plugin.
      events: undefined as never,
      clear: () => entities.clear(),
    },
    storage: {
      get: async (key) => storageData.get(key) as never,
      set: async (key, value) => void storageData.set(key, value),
      delete: async (key) => void storageData.delete(key),
    },
    fetch:
      fetchImpl ??
      (async () => {
        throw new Error('unexpected fetch');
      }),
    registerCommand: (command) => void commands.set(command.id, command),
    registerWidget: (widget) => void widgets.push(widget),
    registerAutomation: () => {
      throw new Error('clock does not register automations');
    },
    registerEntity: (id, state) => void entities.set(id, state),
    own: (disposable: Disposable | (() => void)) =>
      void disposers.push(
        typeof disposable === 'function' ? disposable : () => disposable.dispose(),
      ),
  };

  return { context, entities, commands, widgets, storageData };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const SYSTEM_TZ = detectSystemTimezone();

describe('manifest', () => {
  it('declares the capabilities its setup uses', () => {
    expect(plugin.manifest.id).toBe('clock');
    expect(plugin.manifest.capabilities).toEqual([
      'entities:read',
      'entities:write',
      'widgets:register',
      'commands:register',
      'storage',
      'network',
    ]);
  });
});

describe('setup', () => {
  it('registers the entity with default settings, timezone detected from the machine', async () => {
    const { context, entities } = fakeContext();
    await plugin.setup(context);

    expect(entities.get(CLOCK_ENTITY)).toEqual({
      hour12: false,
      showSeconds: true,
      dateFormat: 'long',
      timezone: SYSTEM_TZ,
      timezoneSource: 'system',
      locationQuery: '',
      locationLabel: '',
      locationStatus: 'idle',
      locationError: null,
    });
  });

  it('restores settings saved to storage, before the timezone feature existed', async () => {
    const { context, entities, storageData } = fakeContext();
    storageData.set('settings', { hour12: true, showSeconds: false, dateFormat: 'iso' });

    await plugin.setup(context);

    expect(entities.get(CLOCK_ENTITY)).toMatchObject({
      hour12: true,
      showSeconds: false,
      dateFormat: 'iso',
      timezone: SYSTEM_TZ,
      timezoneSource: 'system',
    });
  });

  it('restores a saved location override rather than re-detecting the system zone', async () => {
    const { context, entities, storageData } = fakeContext();
    storageData.set('settings', {
      hour12: false,
      showSeconds: true,
      dateFormat: 'long',
      timezone: 'Asia/Tokyo',
      timezoneSource: 'location',
      locationQuery: 'Tokyo',
      locationLabel: 'Tokyo, Japan',
    });

    await plugin.setup(context);

    expect(entities.get(CLOCK_ENTITY)).toMatchObject({
      timezone: 'Asia/Tokyo',
      timezoneSource: 'location',
      locationLabel: 'Tokyo, Japan',
    });
  });

  it('ignores malformed stored settings and falls back to defaults', async () => {
    const { context, entities, storageData } = fakeContext();
    storageData.set('settings', { hour12: true });

    await plugin.setup(context);

    expect(entities.get(CLOCK_ENTITY)).toMatchObject({ hour12: false, dateFormat: 'long' });
  });

  it('registers the hour-format, seconds, date-format and timezone commands', async () => {
    const { context, commands } = fakeContext();
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'clock.configure-location',
      'clock.set-date-format',
      'clock.set-hour-format',
      'clock.set-show-seconds',
      'clock.use-system-timezone',
    ]);
  });

  it('clock.set-hour-format updates and persists the setting', async () => {
    const { context, entities, commands, storageData } = fakeContext();
    await plugin.setup(context);

    await commands.get('clock.set-hour-format')?.run({ hour12: true });

    expect((entities.get(CLOCK_ENTITY) as { hour12: boolean }).hour12).toBe(true);
    expect((storageData.get('settings') as { hour12: boolean }).hour12).toBe(true);
  });

  it('clock.set-hour-format ignores a non-boolean argument', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);
    const before = entities.get(CLOCK_ENTITY);

    await commands.get('clock.set-hour-format')?.run({ hour12: 'nope' });

    expect(entities.get(CLOCK_ENTITY)).toEqual(before);
  });

  it('clock.set-show-seconds updates the setting', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('clock.set-show-seconds')?.run({ showSeconds: false });

    expect((entities.get(CLOCK_ENTITY) as { showSeconds: boolean }).showSeconds).toBe(false);
  });

  it('clock.set-date-format updates the setting when given a known preset', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('clock.set-date-format')?.run({ format: 'iso' });

    expect((entities.get(CLOCK_ENTITY) as { dateFormat: string }).dateFormat).toBe('iso');
  });

  it('clock.set-date-format ignores an unknown preset', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);
    const before = entities.get(CLOCK_ENTITY);

    await commands.get('clock.set-date-format')?.run({ format: 'bogus' });

    expect(entities.get(CLOCK_ENTITY)).toEqual(before);
  });

  it('clock.configure-location geocodes the query and switches the timezone source', async () => {
    const fetchImpl = (async (url: string) => {
      expect(url).toContain('geocoding-api');
      expect(url).toContain('Austin');
      return jsonResponse({
        results: [
          {
            name: 'Austin',
            admin1: 'Texas',
            country: 'United States',
            timezone: 'America/Chicago',
          },
        ],
      });
    }) as PluginContext['fetch'];
    const { context, entities, commands, storageData } = fakeContext(fetchImpl);
    await plugin.setup(context);

    await commands.get('clock.configure-location')?.run({ query: 'Austin' });

    const state = entities.get(CLOCK_ENTITY) as ClockSettings;
    expect(state.timezone).toBe('America/Chicago');
    expect(state.timezoneSource).toBe('location');
    expect(state.locationLabel).toBe('Austin, Texas, United States');
    expect(state.locationStatus).toBe('ready');
    expect((storageData.get('settings') as ClockSettings).timezone).toBe('America/Chicago');
  });

  it('clock.configure-location records an error when nothing matches', async () => {
    const fetchImpl = (async () => jsonResponse({ results: [] })) as PluginContext['fetch'];
    const { context, entities, commands } = fakeContext(fetchImpl);
    await plugin.setup(context);

    await commands.get('clock.configure-location')?.run({ query: 'Nowhere' });

    const state = entities.get(CLOCK_ENTITY) as ClockSettings;
    expect(state.locationStatus).toBe('error');
    expect(state.locationError).toMatch(/Nowhere/);
    expect(state.timezoneSource).toBe('system');
  });

  it('clock.configure-location records an error when the request fails', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as PluginContext['fetch'];
    const { context, entities, commands } = fakeContext(fetchImpl);
    await plugin.setup(context);

    await commands.get('clock.configure-location')?.run({ query: 'Austin' });

    const state = entities.get(CLOCK_ENTITY) as ClockSettings;
    expect(state.locationStatus).toBe('error');
    expect(state.locationError).toBe('network down');
  });

  it('clock.configure-location does nothing without a query', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);
    const before = entities.get(CLOCK_ENTITY);

    await commands.get('clock.configure-location')?.run({});

    expect(entities.get(CLOCK_ENTITY)).toEqual(before);
  });

  it('clock.use-system-timezone reverts a location override back to the machine zone', async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        results: [{ name: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' }],
      })) as PluginContext['fetch'];
    const { context, entities, commands } = fakeContext(fetchImpl);
    await plugin.setup(context);
    await commands.get('clock.configure-location')?.run({ query: 'Tokyo' });
    expect((entities.get(CLOCK_ENTITY) as ClockSettings).timezoneSource).toBe('location');

    await commands.get('clock.use-system-timezone')?.run();

    const state = entities.get(CLOCK_ENTITY) as ClockSettings;
    expect(state.timezoneSource).toBe('system');
    expect(state.timezone).toBe(SYSTEM_TZ);
    expect(state.locationLabel).toBe('');
    expect(state.locationQuery).toBe('');
  });

  it('registers one widget with a real renderer', async () => {
    const { context, widgets } = fakeContext();
    await plugin.setup(context);

    expect(widgets.map((widget) => widget.type)).toEqual(['clock.now']);
    expect(typeof widgets[0]?.render).toBe('function');
  });
});
