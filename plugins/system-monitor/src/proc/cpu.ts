export interface CpuCounters {
  total: number;
  idle: number;
}

/** Parses the aggregate `cpu` line from `/proc/stat`. */
export function parseProcStat(content: string): CpuCounters | null {
  for (const line of content.split('\n')) {
    if (!line.startsWith('cpu ')) continue;
    const parts = line.trim().split(/\s+/);
    const values = parts.slice(1).map((part) => Number.parseInt(part, 10));
    if (values.some((value) => Number.isNaN(value))) return null;

    const user = values[0] ?? 0;
    const nice = values[1] ?? 0;
    const system = values[2] ?? 0;
    const idle = values[3] ?? 0;
    const iowait = values[4] ?? 0;
    const irq = values[5] ?? 0;
    const softirq = values[6] ?? 0;
    const steal = values[7] ?? 0;

    const total = user + nice + system + idle + iowait + irq + softirq + steal;
    return { total, idle: idle + iowait };
  }
  return null;
}

/** Returns aggregate CPU utilization percent from two counter samples. */
export function cpuPercentFromDelta(previous: CpuCounters, current: CpuCounters): number {
  const totalDelta = current.total - previous.total;
  const idleDelta = current.idle - previous.idle;
  if (totalDelta <= 0) return 0;
  if (idleDelta < 0) return 100;
  const busy = totalDelta - idleDelta;
  return Math.min(100, Math.max(0, (busy / totalDelta) * 100));
}
