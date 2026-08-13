export interface NetworkCounters {
  bytes: number;
}

/** Sums RX+TX bytes across non-loopback interfaces in `/proc/net/dev`. */
export function parseNetDev(content: string): NetworkCounters | null {
  let total = 0;
  let found = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('Inter-') || trimmed.startsWith('face')) continue;

    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;

    const iface = trimmed.slice(0, colon).trim();
    if (iface === 'lo') continue;

    const parts = trimmed.slice(colon + 1).trim().split(/\s+/);
    const rxBytes = Number.parseInt(parts[0] ?? '', 10);
    const txBytes = Number.parseInt(parts[8] ?? '', 10);
    if (Number.isNaN(rxBytes) || Number.isNaN(txBytes)) continue;

    total += rxBytes + txBytes;
    found = true;
  }

  return found ? { bytes: total } : null;
}

/** Returns combined throughput in bytes per second; negative deltas become zero. */
export function networkThroughputFromDelta(
  previous: NetworkCounters,
  current: NetworkCounters,
  deltaMs: number,
): number {
  if (deltaMs <= 0) return 0;
  const deltaBytes = current.bytes - previous.bytes;
  if (deltaBytes < 0) return 0;
  return (deltaBytes * 1000) / deltaMs;
}
