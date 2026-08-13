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
  METRICS_ENTITY,
  SETTINGS_ENTITY,
  type MonitorMetricsState,
  type MonitorSettings,
} from './entity.js';
import { initialSettings } from './settings.js';
import { OverviewWidget } from './widgets.js';

const renderable = detectRuntime().ffi;

function sampleMetrics(): MonitorMetricsState {
  return {
    platform: 'linux',
    polling: true,
    lastUpdatedAt: Date.now(),
    intervalMs: 1000,
    metrics: {
      cpu: {
        status: 'ok',
        value: 42,
        label: '42%',
        detail: null,
        history: [10, 20, 30, 42],
        error: null,
      },
      ram: {
        status: 'ok',
        value: 55,
        label: '55%',
        detail: '8.0 GB / 16.0 GB',
        history: [50, 52, 54, 55],
        error: null,
      },
      network: {
        status: 'ok',
        value: 1_500_000,
        label: '1.5 MB/s',
        detail: null,
        history: [0, 500_000, 1_000_000, 1_500_000],
        error: null,
      },
      gpu: {
        status: 'unavailable',
        value: null,
        label: '—',
        detail: null,
        history: [],
        error: 'GPU stats unavailable',
      },
    },
  };
}

describe.skipIf(!renderable)('OverviewWidget', () => {
  it('draws CPU, RAM, and network in a grid on wide widgets', async () => {
    const entities = createEntityStore();
    entities.register(SETTINGS_ENTITY, initialSettings() satisfies MonitorSettings);
    entities.register(METRICS_ENTITY, sampleMetrics());
    const runtime = createAppRuntime({ entities });

    runtime.commands.register({
      id: 'system-monitor.widget-mounted',
      title: 'mounted',
      run: () => {},
    });
    runtime.commands.register({
      id: 'system-monitor.widget-unmounted',
      title: 'unmounted',
      run: () => {},
    });

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <OverviewWidget options={{}} width={64} height={18} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 68, height: 20 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('CPU');
      expect(frame).toContain('RAM');
      expect(frame).toContain('Network');
      expect(frame).toMatch(/[▁-█]/u);
      expect(frame).toContain('Settings');
    } finally {
      setup.renderer.destroy();
    }
  });
});
