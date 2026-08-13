import type { Json } from '@nightshift/sdk';

export const SETTINGS_ENTITY = 'system-monitor.settings';
export const METRICS_ENTITY = 'system-monitor.metrics';

export const HISTORY_LEN = 60;
export const POLL_MS = 1000;

export type MetricKey = 'cpu' | 'gpu' | 'network' | 'ram';
export type MetricStatus = 'ok' | 'unavailable' | 'error';
export type Platform = 'linux' | 'unsupported';

export const METRIC_KEYS: readonly MetricKey[] = ['cpu', 'gpu', 'network', 'ram'];

export interface MetricSample {
  status: MetricStatus;
  value: number | null;
  label: string;
  detail: string | null;
  history: number[];
  error: string | null;
  [key: string]: Json;
}

export interface MonitorSettings {
  version: 1;
  showCpu: boolean;
  showGpu: boolean;
  showNetwork: boolean;
  showRam: boolean;
  [key: string]: Json;
}

export interface MonitorMetricsState {
  platform: Platform;
  polling: boolean;
  lastUpdatedAt: number | null;
  intervalMs: number;
  metrics: Record<MetricKey, MetricSample>;
  [key: string]: Json;
}

export function emptyMetricSample(): MetricSample {
  return {
    status: 'unavailable',
    value: null,
    label: '—',
    detail: null,
    history: [],
    error: null,
  };
}

export function initialMetrics(platform: Platform): MonitorMetricsState {
  return {
    platform,
    polling: false,
    lastUpdatedAt: null,
    intervalMs: POLL_MS,
    metrics: {
      cpu: emptyMetricSample(),
      gpu: emptyMetricSample(),
      network: emptyMetricSample(),
      ram: emptyMetricSample(),
    },
  };
}

export function detectPlatform(): Platform {
  return process.platform === 'linux' ? 'linux' : 'unsupported';
}

export function settingsFieldForMetric(metric: MetricKey): keyof MonitorSettings {
  switch (metric) {
    case 'cpu':
      return 'showCpu';
    case 'gpu':
      return 'showGpu';
    case 'network':
      return 'showNetwork';
    case 'ram':
      return 'showRam';
  }
}

export function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === 'string' && (METRIC_KEYS as readonly string[]).includes(value);
}

export function appendHistory(history: readonly number[], value: number, cap = HISTORY_LEN): number[] {
  const next = [...history, value];
  if (next.length <= cap) return next;
  return next.slice(next.length - cap);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
