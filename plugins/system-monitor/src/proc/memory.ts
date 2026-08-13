export interface MemoryStats {
  usedBytes: number;
  totalBytes: number;
  percent: number;
}

function parseKbLine(content: string, key: string): number | null {
  const match = content.match(new RegExp(`^${key}:\\s+(\\d+)\\s+kB$`, 'm'));
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 10);
  return Number.isNaN(value) ? null : value * 1024;
}

/** Parses `/proc/meminfo` into used/total RAM. */
export function parseMeminfo(content: string): MemoryStats | null {
  const totalBytes = parseKbLine(content, 'MemTotal');
  if (totalBytes === null || totalBytes <= 0) return null;

  const availableBytes = parseKbLine(content, 'MemAvailable');
  if (availableBytes !== null) {
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    return {
      usedBytes,
      totalBytes,
      percent: (usedBytes / totalBytes) * 100,
    };
  }

  const freeBytes = parseKbLine(content, 'MemFree') ?? 0;
  const buffersBytes = parseKbLine(content, 'Buffers') ?? 0;
  const cachedBytes = parseKbLine(content, 'Cached') ?? 0;
  const usedBytes = Math.max(0, totalBytes - freeBytes - buffersBytes - cachedBytes);
  return {
    usedBytes,
    totalBytes,
    percent: (usedBytes / totalBytes) * 100,
  };
}
