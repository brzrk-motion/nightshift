import { describe, expect, it } from 'vitest';

import { type CodeIndex } from './store.js';
import { type Timers, type WatchEvent, watchIndex } from './watcher.js';

const ROOT = '/repo';

/** A manual clock: nothing fires until the test says so. */
function manualTimers(): Timers & { run(): void; scheduled(): number } {
  let queue: (() => void)[] = [];
  return {
    setTimeout(handler) {
      queue.push(handler);
      return handler;
    },
    clearTimeout(handle) {
      queue = queue.filter((entry) => entry !== handle);
    },
    run() {
      const due = queue;
      queue = [];
      for (const handler of due) handler();
    },
    scheduled: () => queue.length,
  };
}

function stubIndex(missing: readonly string[] = []): CodeIndex & {
  updated: string[];
  removed: string[];
} {
  const updated: string[] = [];
  const removed: string[] = [];
  return {
    root: ROOT,
    updated,
    removed,
    async update(path) {
      updated.push(path);
      return missing.includes(path) ? undefined : ({ file: path } as never);
    },
    remove(path) {
      removed.push(path);
      return true;
    },
    reindexAll: async () => ({ indexed: 0, removed: 0, failed: 0 }),
    entry: () => undefined,
    files: () => [],
    stats: () => ({
      root: ROOT,
      files: 0,
      symbols: 0,
      failed: 0,
      languages: {},
      updatedAt: null,
    }),
  };
}

describe('watchIndex', () => {
  it('coalesces repeated writes into a single reindex per file', async () => {
    const index = stubIndex();
    const timers = manualTimers();
    let emit: (event: WatchEvent) => void = () => {};
    const flushed: string[][] = [];

    const watcher = watchIndex({
      index,
      timers,
      watch: (_root, onEvent) => {
        emit = onEvent;
        return { close: () => {} };
      },
      onFlush: (files) => flushed.push([...files]),
    });

    emit({ filename: 'src/a.ts' });
    emit({ filename: 'src/a.ts' });
    emit({ filename: 'src/b.ts' });
    expect(timers.scheduled()).toBe(1);

    timers.run();
    await watcher.idle();

    expect(index.updated).toEqual(['src/a.ts', 'src/b.ts']);
    expect(flushed).toEqual([['src/a.ts', 'src/b.ts']]);
    watcher.close();
  });

  it('ignores events for files it cannot index', async () => {
    const index = stubIndex();
    const timers = manualTimers();
    let emit: (event: WatchEvent) => void = () => {};

    watchIndex({
      index,
      timers,
      watch: (_root, onEvent) => {
        emit = onEvent;
        return { close: () => {} };
      },
    });

    emit({ filename: 'README.md' });
    emit({ filename: 'node_modules/x/index.js' });
    emit({ filename: null });

    expect(timers.scheduled()).toBe(0);
    expect(index.updated).toEqual([]);
  });

  it('drops the index entry when a watched file disappears', async () => {
    const index = stubIndex(['src/gone.ts']);
    const timers = manualTimers();
    let emit: (event: WatchEvent) => void = () => {};

    const watcher = watchIndex({
      index,
      timers,
      watch: (_root, onEvent) => {
        emit = onEvent;
        return { close: () => {} };
      },
    });

    emit({ filename: 'src/gone.ts' });
    timers.run();
    await watcher.idle();

    expect(index.removed).toEqual(['src/gone.ts']);
  });

  it('reports an update failure without losing the rest of the batch', async () => {
    const index = stubIndex();
    const failing = {
      ...index,
      async update(path: string) {
        if (path === 'src/a.ts') throw new Error('read failed');
        return index.update(path);
      },
    } as CodeIndex;
    const timers = manualTimers();
    const errors: Error[] = [];
    let emit: (event: WatchEvent) => void = () => {};

    const watcher = watchIndex({
      index: failing,
      timers,
      onError: (error) => errors.push(error),
      watch: (_root, onEvent) => {
        emit = onEvent;
        return { close: () => {} };
      },
    });

    emit({ filename: 'src/a.ts' });
    emit({ filename: 'src/b.ts' });
    timers.run();
    await watcher.idle();

    expect(errors.map((error) => error.message)).toEqual(['read failed']);
    expect(index.updated).toEqual(['src/b.ts']);
    watcher.close();
  });

  it('stops scheduling work after close', () => {
    const index = stubIndex();
    const timers = manualTimers();
    let emit: (event: WatchEvent) => void = () => {};
    let closedWatcher = false;

    const watcher = watchIndex({
      index,
      timers,
      watch: (_root, onEvent) => {
        emit = onEvent;
        return {
          close: () => {
            closedWatcher = true;
          },
        };
      },
    });

    watcher.close();
    emit({ filename: 'src/a.ts' });

    expect(closedWatcher).toBe(true);
    expect(timers.scheduled()).toBe(0);
  });
});
