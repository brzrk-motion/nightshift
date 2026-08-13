import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initialCollectorState, pollMetrics } from './collector.js';
import { createEmptyMetrics } from './collector.js';
import { HISTORY_LEN } from './entity.js';

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));

async function fixtureMap(): Promise<Map<string, string>> {
  const files = {
    '/proc/stat': `${fixtures}/stat-busy.txt`,
    '/proc/meminfo': `${fixtures}/meminfo.txt`,
    '/proc/net/dev': `${fixtures}/net-dev-2.txt`,
  } as const;

  const map = new Map<string, string>();
  for (const [path, file] of Object.entries(files)) {
    map.set(path, await readFile(file, 'utf8'));
  }
  return map;
}

describe('pollMetrics', () => {
  it('caps history length', async () => {
    const readFileFn = viRead(await fixtureMap());
    let metrics = createEmptyMetrics('linux');
    let state = initialCollectorState();

    for (let index = 0; index < HISTORY_LEN + 5; index += 1) {
      const result = await pollMetrics(metrics, state, {
        platform: 'linux',
        readFile: readFileFn,
        readGpu: async () => 10,
      });
      metrics = result.metrics;
      state = result.collectorState;
    }

    expect(metrics.metrics.cpu.history.length).toBe(HISTORY_LEN);
    expect(metrics.metrics.ram.history.length).toBe(HISTORY_LEN);
  });

  it('marks metrics unavailable on unsupported platforms', async () => {
    const result = await pollMetrics(createEmptyMetrics('unsupported'), initialCollectorState(), {
      platform: 'unsupported',
      readFile: async () => '',
    });

    expect(result.metrics.metrics.cpu.status).toBe('unavailable');
    expect(result.metrics.metrics.ram.status).toBe('unavailable');
  });

  it('soft-fails GPU without throwing', async () => {
    const readFileFn = viRead(await fixtureMap());
    const result = await pollMetrics(createEmptyMetrics('linux'), initialCollectorState(), {
      platform: 'linux',
      readFile: readFileFn,
      readGpu: async () => null,
    });

    expect(result.metrics.metrics.gpu.status).toBe('unavailable');
  });
});

function viRead(map: Map<string, string>) {
  return async (path: string) => {
    const content = map.get(path);
    if (content === undefined) throw new Error(`missing ${path}`);
    return content;
  };
}
