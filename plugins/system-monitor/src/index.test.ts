import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPluginTestContext } from '@nightshift/sdk/testing';
import plugin from './index.js';
import { METRICS_ENTITY, SETTINGS_ENTITY } from './entity.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('manifest', () => {
  it('declares storage and widget capabilities', () => {
    expect(plugin.manifest.id).toBe('system-monitor');
    expect(plugin.manifest.capabilities).toEqual([
      'entities:read',
      'entities:write',
      'widgets:register',
      'commands:register',
      'storage',
    ]);
  });
});

describe('setup', () => {
  it('registers settings and metrics entities', async () => {
    const { context, entities } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'system-monitor tests do not use network',
    });
    await plugin.setup(context);

    expect(entities.get(SETTINGS_ENTITY)).toMatchObject({
      version: 1,
      showCpu: true,
      showGpu: true,
      showNetwork: true,
      showRam: true,
    });
    expect(entities.get(METRICS_ENTITY)).toMatchObject({
      intervalMs: 1000,
      metrics: {
        cpu: { status: 'unavailable' },
        gpu: { status: 'unavailable' },
        network: { status: 'unavailable' },
        ram: { status: 'unavailable' },
      },
    });
  });

  it('registers mount, unmount, and settings commands', async () => {
    const { context, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'system-monitor tests do not use network',
    });
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'system-monitor.reset-settings',
      'system-monitor.set-graph-enabled',
      'system-monitor.widget-mounted',
      'system-monitor.widget-unmounted',
    ]);
  });

  it('registers the overview widget', async () => {
    const { context, widgets } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'system-monitor tests do not use network',
    });
    await plugin.setup(context);

    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({
      type: 'system-monitor.overview',
      entities: [SETTINGS_ENTITY, METRICS_ENTITY],
    });
    expect(typeof widgets[0]?.render).toBe('function');
  });

  it('persists graph toggles via set-graph-enabled', async () => {
    const { context, entities, storageData, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'system-monitor tests do not use network',
    });
    await plugin.setup(context);

    await commands.get('system-monitor.set-graph-enabled')?.run({ metric: 'ram', enabled: false });

    expect(entities.get(SETTINGS_ENTITY)).toMatchObject({ showRam: false });
    await vi.waitFor(() => expect(storageData.get('settings')).toBeTruthy());
    expect(storageData.get('settings')).toMatchObject({ showRam: false });
  });

  it('starts polling when a widget mounts and stops on unmount', async () => {
    const { context, entities, commands, disposers } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'system-monitor tests do not use network',
    });
    await plugin.setup(context);

    await commands.get('system-monitor.widget-mounted')?.run();
    expect((entities.get(METRICS_ENTITY) as { polling: boolean }).polling).toBe(true);

    vi.advanceTimersByTime(1000);
    await vi.waitFor(() =>
      expect(
        (entities.get(METRICS_ENTITY) as { lastUpdatedAt: number | null }).lastUpdatedAt,
      ).not.toBeNull(),
    );

    await commands.get('system-monitor.widget-unmounted')?.run();
    expect((entities.get(METRICS_ENTITY) as { polling: boolean }).polling).toBe(false);

    for (const dispose of disposers) dispose();
  });
});
