import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMeminfo } from './memory.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));

describe('parseMeminfo', () => {
  it('computes used/total and percent from MemAvailable', async () => {
    const content = await readFile(`${fixtures}/meminfo.txt`, 'utf8');
    const memory = parseMeminfo(content);
    expect(memory).toEqual({
      usedBytes: 8192000 * 1024,
      totalBytes: 16384000 * 1024,
      percent: 50,
    });
  });
});
