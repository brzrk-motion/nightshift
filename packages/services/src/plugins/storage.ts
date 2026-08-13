import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NightshiftError, type Json } from '@nightshift/core';
import type { PluginStorage } from '@nightshift/sdk';

/**
 * Per-plugin key/value storage, one JSON file per plugin under the data
 * directory. Plugins get their own file rather than a shared one so a
 * corrupted write can only ever cost that plugin its state.
 */
export interface PluginStorageOptions {
  /** Directory plugin state files live in. */
  dataDir: string;
  pluginId: string;
}

export function storagePath(dataDir: string, pluginId: string): string {
  return join(dataDir, 'plugins', `${pluginId}.json`);
}

export function createPluginStorage(options: PluginStorageOptions): PluginStorage {
  const file = storagePath(options.dataDir, options.pluginId);
  let cache: Record<string, Json> | undefined;
  // Writes are serialised through this chain so two quick `set` calls cannot
  // interleave and lose one another.
  let queue: Promise<void> = Promise.resolve();

  const read = async (): Promise<Record<string, Json>> => {
    if (cache) return cache;
    try {
      cache = JSON.parse(await readFile(file, 'utf8')) as Record<string, Json>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new NightshiftError('CONFIG_UNREADABLE', `Could not read ${file}.`, {
          cause: error,
          hint: `Delete the file to reset "${options.pluginId}" storage.`,
        });
      }
      cache = {};
    }
    return cache;
  };

  const flush = async (): Promise<void> => {
    const data = cache ?? {};
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  };

  const enqueue = (work: () => Promise<void>): Promise<void> => {
    queue = queue.then(work, work);
    return queue;
  };

  return {
    async get<T extends Json>(key: string): Promise<T | undefined> {
      const data = await read();
      return data[key] as T | undefined;
    },

    async set(key, value) {
      const data = await read();
      data[key] = value;
      await enqueue(flush);
    },

    async delete(key) {
      const data = await read();
      delete data[key];
      await enqueue(flush);
    },
  };
}
