import {
  appendHistory,
  clampPercent,
  emptyMetricSample,
  HISTORY_LEN,
  type MetricKey,
  type MetricSample,
  type MonitorMetricsState,
  type Platform,
} from './entity.js';
import { formatMemoryDetail, formatPercent, formatRate } from './format.js';
import { cpuPercentFromDelta, parseProcStat, type CpuCounters } from './proc/cpu.js';
import { readGpuPercent } from './proc/gpu.js';
import { parseMeminfo } from './proc/memory.js';
import { networkThroughputFromDelta, parseNetDev, type NetworkCounters } from './proc/network.js';

export type ReadFileFn = (path: string) => Promise<string>;

export interface CollectorState {
  previousCpu: CpuCounters | null;
  previousNetwork: NetworkCounters | null;
  previousPollAt: number | null;
}

export interface CollectorDeps {
  platform: Platform;
  readFile: ReadFileFn;
  readGpu?: () => Promise<number | null>;
}

export function initialCollectorState(): CollectorState {
  return {
    previousCpu: null,
    previousNetwork: null,
    previousPollAt: null,
  };
}

function okSample(
  value: number,
  label: string,
  history: readonly number[],
  detail: string | null = null,
): MetricSample {
  return {
    status: 'ok',
    value,
    label,
    detail,
    history: appendHistory(history, value, HISTORY_LEN),
    error: null,
  };
}

function unavailableSample(history: readonly number[], error: string | null = null): MetricSample {
  return {
    status: 'unavailable',
    value: null,
    label: '—',
    detail: null,
    history: [...history],
    error,
  };
}

function errorSample(history: readonly number[], message: string): MetricSample {
  return {
    status: 'error',
    value: null,
    label: '—',
    detail: null,
    history: [...history],
    error: message,
  };
}

async function readProcFile(readFile: ReadFileFn, path: string): Promise<string | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

export async function pollMetrics(
  current: MonitorMetricsState,
  collectorState: CollectorState,
  deps: CollectorDeps,
): Promise<{ metrics: MonitorMetricsState; collectorState: CollectorState }> {
  const now = Date.now();
  const deltaMs =
    collectorState.previousPollAt === null ? deps.platform === 'linux' ? POLL_FALLBACK_MS : 0 : now - collectorState.previousPollAt;

  if (deps.platform !== 'linux') {
    const metrics = { ...current.metrics };
    for (const key of Object.keys(metrics) as MetricKey[]) {
      metrics[key] = unavailableSample(metrics[key]!.history, 'Unsupported platform');
    }
    return {
      metrics: { ...current, lastUpdatedAt: now, metrics },
      collectorState: { ...collectorState, previousPollAt: now },
    };
  }

  const nextMetrics: Record<MetricKey, MetricSample> = { ...current.metrics };
  let nextCollector = { ...collectorState, previousPollAt: now };

  const statContent = await readProcFile(deps.readFile, '/proc/stat');
  if (statContent === null) {
    nextMetrics.cpu = errorSample(current.metrics.cpu.history, 'Could not read CPU stats');
  } else {
    const counters = parseProcStat(statContent);
    if (counters === null) {
      nextMetrics.cpu = errorSample(current.metrics.cpu.history, 'Could not parse CPU stats');
    } else if (nextCollector.previousCpu === null) {
      nextCollector = { ...nextCollector, previousCpu: counters };
      nextMetrics.cpu = {
        ...current.metrics.cpu,
        status: 'ok',
        label: '…',
        error: null,
      };
    } else {
      const percent = clampPercent(cpuPercentFromDelta(nextCollector.previousCpu, counters));
      nextCollector = { ...nextCollector, previousCpu: counters };
      nextMetrics.cpu = okSample(
        percent,
        formatPercent(percent),
        current.metrics.cpu.history,
      );
    }
  }

  const memContent = await readProcFile(deps.readFile, '/proc/meminfo');
  if (memContent === null) {
    nextMetrics.ram = errorSample(current.metrics.ram.history, 'Could not read memory stats');
  } else {
    const memory = parseMeminfo(memContent);
    if (memory === null) {
      nextMetrics.ram = errorSample(current.metrics.ram.history, 'Could not parse memory stats');
    } else {
      const percent = clampPercent(memory.percent);
      nextMetrics.ram = okSample(
        percent,
        formatPercent(percent),
        current.metrics.ram.history,
        formatMemoryDetail(memory.usedBytes, memory.totalBytes),
      );
    }
  }

  const netContent = await readProcFile(deps.readFile, '/proc/net/dev');
  if (netContent === null) {
    nextMetrics.network = errorSample(current.metrics.network.history, 'Could not read network stats');
  } else {
    const counters = parseNetDev(netContent);
    if (counters === null) {
      nextMetrics.network = unavailableSample(current.metrics.network.history, 'No network interfaces');
    } else if (nextCollector.previousNetwork === null || deltaMs <= 0) {
      nextCollector = { ...nextCollector, previousNetwork: counters };
      nextMetrics.network = {
        ...current.metrics.network,
        status: 'ok',
        label: '0 B/s',
        value: 0,
        error: null,
      };
    } else {
      const rate = networkThroughputFromDelta(nextCollector.previousNetwork, counters, deltaMs);
      nextCollector = { ...nextCollector, previousNetwork: counters };
      nextMetrics.network = okSample(rate, formatRate(rate), current.metrics.network.history);
    }
  }

  const readGpu = deps.readGpu ?? (() => readGpuPercent(deps.readFile));
  try {
    const gpuPercent = await readGpu();
    if (gpuPercent === null) {
      nextMetrics.gpu = unavailableSample(current.metrics.gpu.history, 'GPU stats unavailable');
    } else {
      const percent = clampPercent(gpuPercent);
      nextMetrics.gpu = okSample(percent, formatPercent(percent), current.metrics.gpu.history);
    }
  } catch {
    nextMetrics.gpu = unavailableSample(current.metrics.gpu.history, 'GPU stats unavailable');
  }

  return {
    metrics: {
      ...current,
      lastUpdatedAt: now,
      metrics: nextMetrics,
    },
    collectorState: nextCollector,
  };
}

const POLL_FALLBACK_MS = 1000;

export function createEmptyMetrics(platform: Platform): MonitorMetricsState {
  return {
    platform,
    polling: false,
    lastUpdatedAt: null,
    intervalMs: POLL_FALLBACK_MS,
    metrics: {
      cpu: emptyMetricSample(),
      gpu: emptyMetricSample(),
      network: emptyMetricSample(),
      ram: emptyMetricSample(),
    },
  };
}
