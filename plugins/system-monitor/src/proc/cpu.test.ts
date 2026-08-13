import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cpuPercentFromDelta, parseProcStat } from './cpu.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));

describe('parseProcStat', () => {
  it('parses the aggregate cpu line', async () => {
    const content = await readFile(`${fixtures}/stat-idle.txt`, 'utf8');
    const counters = parseProcStat(content);
    expect(counters).not.toBeNull();
    expect(counters!.total).toBeGreaterThan(counters!.idle);
  });
});

describe('cpuPercentFromDelta', () => {
  it('returns a percent between 0 and 100', async () => {
    const idle = parseProcStat(await readFile(`${fixtures}/stat-idle.txt`, 'utf8'))!;
    const busy = parseProcStat(await readFile(`${fixtures}/stat-busy.txt`, 'utf8'))!;
    const percent = cpuPercentFromDelta(idle, busy);
    expect(percent).toBeGreaterThanOrEqual(0);
    expect(percent).toBeLessThanOrEqual(100);
  });

  it('returns 0 when totals do not advance', () => {
    const sample = { total: 100, idle: 80 };
    expect(cpuPercentFromDelta(sample, sample)).toBe(0);
  });
});
