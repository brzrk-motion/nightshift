import { describe, expect, it } from 'vitest';

import { type Extractor } from './extract.js';
import { createCodeIndex, type FileSystem } from './store.js';
import { TEST_ROOT, testRelPath } from './testRoot.js';

interface Fake {
  io: FileSystem;
  extractor: Extractor;
  write(file: string, source: string, mtimeMs?: number): void;
  unlink(file: string): void;
  parses: string[];
}

function fake({ throwOn }: { throwOn?: string } = {}): Fake {
  const files = new Map<string, { source: string; mtimeMs: number }>();
  const parses: string[] = [];

  return {
    parses,
    write(file, source, mtimeMs = 1) {
      files.set(file, { source, mtimeMs });
    },
    unlink(file) {
      files.delete(file);
    },
    io: {
      async stat(path) {
        const entry = files.get(testRelPath(path));
        if (!entry) throw new Error(`ENOENT ${path}`);
        return { size: entry.source.length, mtimeMs: entry.mtimeMs };
      },
      async readFile(path) {
        const entry = files.get(testRelPath(path));
        if (!entry) throw new Error(`ENOENT ${path}`);
        return entry.source;
      },
      list: () => [...files.keys()].sort(),
    },
    extractor: {
      extract(file, _language, source) {
        parses.push(file);
        if (throwOn && file === throwOn) throw new Error('parser exploded');
        return {
          symbols: source
            .split('\n')
            .filter((line) => line.startsWith('def '))
            .map((line, position) => ({
              file,
              name: line.slice(4),
              kind: 'function' as const,
              exported: true,
              startLine: position + 1,
              endLine: position + 1,
              signature: line,
            })),
          references: new Map([['thing', [1]]]),
        };
      },
    },
  };
}

describe('createCodeIndex', () => {
  it('indexes every listed file and reports totals', async () => {
    const f = fake();
    f.write('src/a.ts', 'def one');
    f.write('src/b.tsx', 'def two\ndef three');
    const index = createCodeIndex({ root: TEST_ROOT, extractor: f.extractor, io: f.io });

    const summary = await index.reindexAll();

    expect(summary).toEqual({ indexed: 2, removed: 0, failed: 0 });
    expect(index.stats()).toMatchObject({
      files: 2,
      symbols: 3,
      failed: 0,
      languages: { typescript: 1, tsx: 1 },
    });
  });

  it('skips the parse when size and mtime are unchanged', async () => {
    const f = fake();
    f.write('src/a.ts', 'def one', 10);
    const index = createCodeIndex({ root: TEST_ROOT, extractor: f.extractor, io: f.io });

    await index.update('src/a.ts');
    await index.update('src/a.ts');
    expect(f.parses).toEqual(['src/a.ts']);

    f.write('src/a.ts', 'def two', 11);
    await index.update('src/a.ts');
    expect(f.parses).toEqual(['src/a.ts', 'src/a.ts']);
    expect(index.entry('src/a.ts')?.symbols[0]?.name).toBe('two');
  });

  it('drops the entry when the file is deleted', async () => {
    const f = fake();
    f.write('src/a.ts', 'def one');
    const index = createCodeIndex({ root: TEST_ROOT, extractor: f.extractor, io: f.io });
    await index.update('src/a.ts');

    f.unlink('src/a.ts');
    expect(await index.update('src/a.ts')).toBeUndefined();
    expect(index.entry('src/a.ts')).toBeUndefined();
    expect(index.stats().files).toBe(0);
  });

  it('removes entries for files that vanished between full reindexes', async () => {
    const f = fake();
    f.write('src/a.ts', 'def one');
    f.write('src/b.ts', 'def two');
    const index = createCodeIndex({ root: TEST_ROOT, extractor: f.extractor, io: f.io });
    await index.reindexAll();

    f.unlink('src/b.ts');
    expect(await index.reindexAll()).toEqual({ indexed: 1, removed: 1, failed: 0 });
    expect(index.files().map((entry) => entry.file)).toEqual(['src/a.ts']);
  });

  it('keeps a failing file as a recorded failure instead of throwing', async () => {
    const f = fake({ throwOn: 'src/bad.ts' });
    f.write('src/bad.ts', 'def one');
    f.write('src/good.ts', 'def two');
    const index = createCodeIndex({ root: TEST_ROOT, extractor: f.extractor, io: f.io });

    const summary = await index.reindexAll();

    expect(summary).toEqual({ indexed: 2, removed: 0, failed: 1 });
    expect(index.entry('src/bad.ts')?.error).toBe('parser exploded');
    expect(index.entry('src/good.ts')?.symbols).toHaveLength(1);
  });

  it('ignores files that are too large, unsupported, or outside the root', async () => {
    const f = fake();
    f.write('src/big.ts', 'x'.repeat(200));
    f.write('README.md', 'text');
    const index = createCodeIndex({
      root: TEST_ROOT,
      extractor: f.extractor,
      io: f.io,
      maxFileBytes: 100,
    });

    expect(await index.update('src/big.ts')).toBeUndefined();
    expect(await index.update('README.md')).toBeUndefined();
    expect(await index.update('/elsewhere/a.ts')).toBeUndefined();
    expect(index.stats().files).toBe(0);
  });
});
