import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { networkThroughputFromDelta, parseNetDev } from './network.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));

describe('parseNetDev', () => {
  it('ignores loopback and sums interface bytes', async () => {
    const content = await readFile(`${fixtures}/net-dev-1.txt`, 'utf8');
    expect(parseNetDev(content)).toEqual({ bytes: 8_000_000 });
  });
});

describe('networkThroughputFromDelta', () => {
  it('returns non-negative bytes per second', async () => {
    const first = parseNetDev(await readFile(`${fixtures}/net-dev-1.txt`, 'utf8'))!;
    const second = parseNetDev(await readFile(`${fixtures}/net-dev-2.txt`, 'utf8'))!;
    expect(networkThroughputFromDelta(first, second, 1000)).toBe(1_500_000);
  });

  it('returns zero when counters go backwards', () => {
    expect(networkThroughputFromDelta({ bytes: 200 }, { bytes: 100 }, 1000)).toBe(0);
  });
});
