import { watch } from 'node:fs';

import { isIndexable, toRelative } from './files.js';
import { type CodeIndex } from './store.js';

/** A change reported by the platform watcher. */
export interface WatchEvent {
  filename: string | null;
}

export interface Watcher {
  close(): void;
}

export type WatchFactory = (root: string, onEvent: (event: WatchEvent) => void) => Watcher;

export interface Timers {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface WatchIndexOptions {
  index: CodeIndex;
  debounceMs?: number;
  /** Called after each batch with the files that were reindexed or dropped. */
  onFlush?: (files: readonly string[]) => void;
  onError?: (error: Error) => void;
  watch?: WatchFactory;
  timers?: Timers;
}

export interface IndexWatcher extends Watcher {
  /** Resolves once every batch scheduled so far has been applied. */
  idle(): Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 150;

const nodeWatch: WatchFactory = (root, onEvent) => {
  const watcher = watch(root, { recursive: true, persistent: true }, (_event, filename) => {
    onEvent({ filename: typeof filename === 'string' ? filename : null });
  });
  return { close: () => watcher.close() };
};

/**
 * Keeps the index current by reparsing only what changed. Editors write a file
 * several times in quick succession, so paths are coalesced into one batch per
 * debounce window.
 */
export function watchIndex(options: WatchIndexOptions): IndexWatcher {
  const { index } = options;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const timers = options.timers ?? globalThis;
  const create = options.watch ?? nodeWatch;

  const pending = new Set<string>();
  let timer: unknown;
  let chain: Promise<void> = Promise.resolve();
  let closed = false;

  function flush(): void {
    timer = undefined;
    const batch = [...pending];
    pending.clear();
    if (batch.length === 0) return;

    chain = chain.then(async () => {
      for (const file of batch) {
        try {
          // A missing file resolves to no entry; drop whatever the index held.
          if (!(await index.update(file))) index.remove(file);
        } catch (error) {
          options.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
      options.onFlush?.(batch);
    });
  }

  const watcher = create(index.root, ({ filename }) => {
    if (closed || filename === null) return;
    const file = toRelative(index.root, filename);
    if (file === undefined || !isIndexable(file)) return;

    pending.add(file);
    if (timer !== undefined) timers.clearTimeout(timer);
    timer = timers.setTimeout(flush, debounceMs);
  });

  return {
    idle: () => chain,
    close() {
      closed = true;
      if (timer !== undefined) timers.clearTimeout(timer);
      watcher.close();
    },
  };
}
