import { readFile as fsReadFile } from 'node:fs/promises';
import { definePlugin, type PluginContext } from '@nightshift/sdk';
import {
  initialCollectorState,
  pollMetrics,
  type CollectorState,
  type ReadFileFn,
} from './collector.js';
import {
  detectPlatform,
  initialMetrics,
  isMetricKey,
  METRICS_ENTITY,
  POLL_MS,
  settingsFieldForMetric,
  SETTINGS_ENTITY,
  type MonitorMetricsState,
  type MonitorSettings,
} from './entity.js';
import { hydrateSettings, initialSettings, settingsToStorage, SETTINGS_STORAGE_KEY } from './settings.js';
import { OverviewWidget } from './widgets.js';

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export default definePlugin({
  id: 'system-monitor',
  name: 'System Monitor',
  version: '0.1.0',
  description: 'CPU, RAM, network, and GPU trend graphs with toggleable settings.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    const platform = detectPlatform();
    const stored = await context.storage.get(SETTINGS_STORAGE_KEY);
    const settings = hydrateSettings(stored);

    context.registerEntity(SETTINGS_ENTITY, settings, {
      title: 'System monitor settings',
      owner: 'system-monitor',
    });
    context.registerEntity(METRICS_ENTITY, initialMetrics(platform), {
      title: 'System metrics',
      owner: 'system-monitor',
    });

    const readSettings = (): MonitorSettings =>
      context.entities.get<MonitorSettings>(SETTINGS_ENTITY)?.state ?? initialSettings();

    const writeSettings = (next: MonitorSettings): void => {
      context.entities.set(SETTINGS_ENTITY, next);
      context.storage.set(SETTINGS_STORAGE_KEY, settingsToStorage(next)).catch((error: unknown) => {
        context.log.warn('Could not save system monitor settings', { error: `${error}` });
      });
    };

    const readMetrics = (): MonitorMetricsState =>
      context.entities.get<MonitorMetricsState>(METRICS_ENTITY)?.state ?? initialMetrics(platform);

    const writeMetrics = (next: MonitorMetricsState): void => {
      context.entities.set(METRICS_ENTITY, next);
    };

    let widgetMounted = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let collectorState: CollectorState = initialCollectorState();
    const readFile: ReadFileFn = (path) => fsReadFile(path, 'utf8');

    const setPollingFlag = (polling: boolean): void => {
      writeMetrics({ ...readMetrics(), polling });
    };

    const tick = async (): Promise<void> => {
      const current = readMetrics();
      const result = await pollMetrics(current, collectorState, { platform, readFile });
      collectorState = result.collectorState;
      writeMetrics({ ...result.metrics, polling: widgetMounted > 0 });
    };

    const startPolling = (): void => {
      if (timer !== undefined) return;
      setPollingFlag(true);
      timer = setInterval(() => {
        void tick();
      }, POLL_MS);
      timer.unref?.();
    };

    const stopPolling = (): void => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
      setPollingFlag(false);
    };

    context.registerCommand({
      id: 'system-monitor.widget-mounted',
      title: 'System monitor widget mounted',
      hidden: true,
      run: () => {
        widgetMounted += 1;
        if (widgetMounted === 1) {
          startPolling();
          void tick();
        }
      },
    });

    context.registerCommand({
      id: 'system-monitor.widget-unmounted',
      title: 'System monitor widget unmounted',
      hidden: true,
      run: () => {
        widgetMounted = Math.max(0, widgetMounted - 1);
        if (widgetMounted === 0) stopPolling();
      },
    });

    context.registerCommand({
      id: 'system-monitor.set-graph-enabled',
      title: 'Toggle a system monitor graph',
      run: (args) => {
        const metric = args?.['metric'];
        const enabled = args?.['enabled'];
        if (!isMetricKey(metric) || !isBoolean(enabled)) return;
        writeSettings({ ...readSettings(), [settingsFieldForMetric(metric)]: enabled });
      },
    });

    context.registerCommand({
      id: 'system-monitor.reset-settings',
      title: 'Reset system monitor settings',
      run: () => {
        writeSettings(initialSettings());
      },
    });

    context.registerWidget({
      type: 'system-monitor.overview',
      title: 'System monitor',
      entities: [SETTINGS_ENTITY, METRICS_ENTITY],
      description: 'Live CPU, RAM, network, and GPU graphs with toggleable settings.',
      render: OverviewWidget,
    });

    context.own(() => stopPolling());
    context.log.info('System monitor plugin ready', { platform });
  },
});

export {
  SETTINGS_ENTITY,
  METRICS_ENTITY,
  detectPlatform,
  initialMetrics,
  type MonitorMetricsState,
  type MonitorSettings,
  type MetricKey,
  type MetricSample,
} from './entity.js';
export { hydrateSettings, initialSettings } from './settings.js';
export { pollMetrics, createEmptyMetrics } from './collector.js';
export { OverviewWidget } from './widgets.js';
