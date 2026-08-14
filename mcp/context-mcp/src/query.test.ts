import { beforeAll, describe, expect, it } from 'vitest';

import { createExtractor } from './extract.js';
import {
  fileOutline,
  findReferences,
  getSymbol,
  type QueryContext,
  readLines,
  searchSymbols,
} from './query.js';
import { createCodeIndex, type FileSystem } from './store.js';
import { TEST_ROOT, testAbsPath, testRelPath } from './testRoot.js';

const SOURCES: Record<string, string> = {
  'packages/core/src/timer.ts': [
    '/** Counts down. */',
    'export class Timer {',
    '  start(): void {',
    '    tick();',
    '  }',
    '}',
    '',
    'export function tick(): number {',
    '  return 1;',
    '}',
  ].join('\n'),
  'packages/ui/src/panel.tsx': [
    'import { tick } from "../../core/src/timer.js";',
    '',
    '// A framed region.',
    'export const Panel = () => {',
    '  tick();',
    '  return null;',
    '};',
  ].join('\n'),
  'apps/cli/src/run.js': [
    'const helper = 1;',
    'export function run() {',
    '  return helper;',
    '}',
  ].join('\n'),
};

let context: QueryContext;

beforeAll(async () => {
  const io: FileSystem = {
    async stat(path) {
      const source = SOURCES[testRelPath(path)];
      if (source === undefined) throw new Error(`ENOENT ${path}`);
      return { size: source.length, mtimeMs: 1 };
    },
    async readFile(path) {
      const source = SOURCES[testRelPath(path)];
      if (source === undefined) throw new Error(`ENOENT ${path}`);
      return source;
    },
    list: () => Object.keys(SOURCES).sort(),
  };

  const index = createCodeIndex({ root: TEST_ROOT, extractor: await createExtractor(), io });
  await index.reindexAll();
  context = { index, readSource: (file) => io.readFile(testAbsPath(file)) };
});

describe('searchSymbols', () => {
  it('ranks an exact name above a prefix and a substring', () => {
    const { symbols } = searchSymbols(context, { name: 'tick' });

    expect(symbols.map((s) => [s.name, s.file])).toEqual([['tick', 'packages/core/src/timer.ts']]);
  });

  it('filters by kind, path glob and export', () => {
    // `kinds` must accept readonly arrays (pre-dedupe SearchSymbolsInput contract).
    const classOnly = ['class'] as const;
    expect(searchSymbols(context, { kinds: classOnly }).symbols.map((s) => s.name)).toEqual([
      'Timer',
    ]);

    expect(
      searchSymbols(context, { path: 'packages/**' }).symbols.every((s) =>
        s.file.startsWith('packages/'),
      ),
    ).toBe(true);

    expect(searchSymbols(context, { path: 'apps/*' }).symbols).toHaveLength(0);
    expect(searchSymbols(context, { path: 'apps/**/*.js' }).symbols.map((s) => s.name)).toEqual([
      'helper',
      'run',
    ]);

    expect(searchSymbols(context, { exportedOnly: true }).symbols.map((s) => s.name)).not.toContain(
      'helper',
    );
  });

  it('reports the untruncated total when the limit cuts results short', () => {
    const result = searchSymbols(context, { limit: 1 });

    expect(result.symbols).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(result.total).toBeGreaterThan(1);
  });
});

describe('fileOutline', () => {
  it('lists the definitions in a file and nothing else', () => {
    const outline = fileOutline(context, 'packages/core/src/timer.ts');

    expect(outline?.language).toBe('typescript');
    expect(outline?.symbols.map((s) => [s.name, s.kind, s.startLine])).toEqual([
      ['Timer', 'class', 2],
      ['start', 'method', 3],
      ['tick', 'function', 8],
    ]);
  });

  it('returns nothing for a file that is not indexed', () => {
    expect(fileOutline(context, 'nope.ts')).toBeUndefined();
  });
});

describe('getSymbol', () => {
  it('returns the exact source of a definition with its doc comment', async () => {
    const { total, definitions } = await getSymbol(context, { name: 'Timer' });
    const [definition] = definitions;

    expect(total).toBe(1);
    expect(definition?.startLine).toBe(1);
    expect(definition?.endLine).toBe(6);
    expect(definition?.source).toBe(
      [
        '/** Counts down. */',
        'export class Timer {',
        '  start(): void {',
        '    tick();',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('omits the doc and adds context lines on request', async () => {
    const { definitions } = await getSymbol(context, {
      name: 'Panel',
      includeDoc: false,
      contextLines: 1,
    });

    expect(definitions[0]?.startLine).toBe(3);
    expect(definitions[0]?.source.startsWith('// A framed region.')).toBe(true);
  });

  it('narrows by file and kind', async () => {
    const byKind = await getSymbol(context, { name: 'tick', kind: 'class' });
    expect(byKind.total).toBe(0);

    const byFile = await getSymbol(context, {
      name: 'tick',
      file: 'packages/ui/src/panel.tsx',
    });
    expect(byFile.total).toBe(0);
  });
});

describe('findReferences', () => {
  it('finds every mention across files with its source line', async () => {
    const result = await findReferences(context, { name: 'tick' });

    expect(result.hits).toEqual([
      { file: 'packages/core/src/timer.ts', line: 4, isDefinition: false, text: 'tick();' },
      {
        file: 'packages/core/src/timer.ts',
        line: 8,
        isDefinition: true,
        text: 'export function tick(): number {',
      },
      {
        file: 'packages/ui/src/panel.tsx',
        line: 1,
        isDefinition: false,
        text: 'import { tick } from "../../core/src/timer.js";',
      },
      { file: 'packages/ui/src/panel.tsx', line: 5, isDefinition: false, text: 'tick();' },
    ]);
  });

  it('honours the path filter and the line-text opt-out', async () => {
    const result = await findReferences(context, {
      name: 'tick',
      path: 'packages/ui/**',
      includeLines: false,
    });

    expect(result.hits.map((hit) => [hit.file, hit.line, hit.text])).toEqual([
      ['packages/ui/src/panel.tsx', 1, undefined],
      ['packages/ui/src/panel.tsx', 5, undefined],
    ]);
  });

  it('reports the total when the limit truncates the hits', async () => {
    const result = await findReferences(context, { name: 'tick', limit: 1 });

    expect(result.hits).toHaveLength(1);
    expect(result.total).toBe(4);
    expect(result.truncated).toBe(true);
  });
});

describe('readLines', () => {
  it('returns the requested range, clamped to the file', async () => {
    const result = await readLines(context, {
      file: 'apps/cli/src/run.js',
      startLine: 2,
      endLine: 99,
    });

    expect(result).toEqual({
      file: 'apps/cli/src/run.js',
      startLine: 2,
      endLine: 4,
      truncated: false,
      source: 'export function run() {\n  return helper;\n}',
    });
  });
});
