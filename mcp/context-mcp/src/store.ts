import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type Extractor } from './extract.js';
import { isIndexable, listFiles, type ListFilesOptions, toRelative } from './files.js';
import { languageForPath } from './languages.js';
import { type FileEntry, type IndexStats } from './types.js';

/** The 512 KB ceiling keeps a vendored bundle from dominating the index. */
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;

export interface CodeIndexOptions {
  root: string;
  extractor: Extractor;
  maxFileBytes?: number;
  /** Injectable file access, so tests can drive the index without touching disk. */
  io?: FileSystem;
  listFiles?: ListFilesOptions;
}

export interface FileSystem {
  stat(path: string): Promise<{ size: number; mtimeMs: number }>;
  readFile(path: string): Promise<string>;
  list(root: string, options?: ListFilesOptions): string[];
}

export interface ReindexSummary {
  indexed: number;
  removed: number;
  failed: number;
}

export interface CodeIndex {
  readonly root: string;
  /** Indexes every file under the root, dropping entries whose file is gone. */
  reindexAll(): Promise<ReindexSummary>;
  /**
   * Reparses one file, skipping the parse when size and mtime are unchanged.
   * Returns `undefined` when the file is gone or is not indexable.
   */
  update(path: string): Promise<FileEntry | undefined>;
  remove(path: string): boolean;
  entry(path: string): FileEntry | undefined;
  files(): FileEntry[];
  stats(): IndexStats;
}

const nodeFileSystem: FileSystem = {
  async stat(path) {
    const stats = await stat(path);
    return { size: stats.size, mtimeMs: stats.mtimeMs };
  },
  readFile: (path) => readFile(path, 'utf8'),
  list: (root, options) => listFiles(root, options),
};

export function createCodeIndex(options: CodeIndexOptions): CodeIndex {
  const root = resolve(options.root);
  const io = options.io ?? nodeFileSystem;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const entries = new Map<string, FileEntry>();
  let updatedAt: number | null = null;

  async function update(path: string): Promise<FileEntry | undefined> {
    const file = toRelative(root, path);
    if (file === undefined || !isIndexable(file)) return undefined;

    const language = languageForPath(file);
    if (!language) return undefined;

    const absolute = resolve(root, file);
    let size: number;
    let mtimeMs: number;
    try {
      ({ size, mtimeMs } = await io.stat(absolute));
    } catch {
      entries.delete(file);
      return undefined;
    }

    if (size > maxFileBytes) {
      entries.delete(file);
      return undefined;
    }

    const previous = entries.get(file);
    if (previous && previous.size === size && previous.mtimeMs === mtimeMs && !previous.error) {
      return previous;
    }

    // A file that cannot be read or parsed is recorded as a failure and kept,
    // so one bad file never costs the rest of the index.
    let entry: FileEntry;
    try {
      const source = await io.readFile(absolute);
      const { symbols, references } = options.extractor.extract(file, language, source);
      entry = { file, language, size, mtimeMs, symbols, references };
    } catch (error) {
      entry = {
        file,
        language,
        size,
        mtimeMs,
        symbols: [],
        references: new Map(),
        error: error instanceof Error ? error.message : String(error),
      };
    }

    entries.set(file, entry);
    updatedAt = Date.now();
    return entry;
  }

  return {
    root,

    async reindexAll() {
      const found = io.list(root, options.listFiles);
      const summary: ReindexSummary = { indexed: 0, removed: 0, failed: 0 };

      for (const file of found) {
        const entry = await update(file);
        if (!entry) continue;
        summary.indexed += 1;
        if (entry.error) summary.failed += 1;
      }

      const keep = new Set(found);
      for (const file of [...entries.keys()]) {
        if (keep.has(file)) continue;
        entries.delete(file);
        summary.removed += 1;
      }

      updatedAt = Date.now();
      return summary;
    },

    update,

    remove(path) {
      const file = toRelative(root, path);
      if (file === undefined) return false;
      const removed = entries.delete(file);
      if (removed) updatedAt = Date.now();
      return removed;
    },

    entry(path) {
      const file = toRelative(root, path);
      return file === undefined ? undefined : entries.get(file);
    },

    files() {
      return [...entries.values()].sort((a, b) => a.file.localeCompare(b.file));
    },

    stats() {
      const languages: Record<string, number> = {};
      let symbols = 0;
      let failed = 0;

      for (const entry of entries.values()) {
        languages[entry.language] = (languages[entry.language] ?? 0) + 1;
        symbols += entry.symbols.length;
        if (entry.error) failed += 1;
      }

      return { root, files: entries.size, symbols, failed, languages, updatedAt };
    },
  };
}
