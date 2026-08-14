import { beforeAll, describe, expect, it } from 'vitest';

import { createExtractor } from './extract.js';
import { type QueryContext } from './query.js';
import { createContextServer } from './server.js';
import { createCodeIndex, type FileSystem } from './store.js';
import { createTools, type Tool } from './tools.js';
import { TEST_ROOT, testAbsPath, testRelPath } from './testRoot.js';

const SOURCES: Record<string, string> = {
  'src/timer.ts': ['export function tick(): number {', '  return 1;', '}'].join('\n'),
};

let tools: Map<string, Tool>;
let context: QueryContext;

beforeAll(async () => {
  const io: FileSystem = {
    async stat(path) {
      const source = SOURCES[testRelPath(path)];
      if (source === undefined) throw new Error('ENOENT');
      return { size: source.length, mtimeMs: 1 };
    },
    async readFile(path) {
      const source = SOURCES[testRelPath(path)];
      if (source === undefined) throw new Error('ENOENT');
      return source;
    },
    list: () => Object.keys(SOURCES),
  };

  const index = createCodeIndex({ root: TEST_ROOT, extractor: await createExtractor(), io });
  await index.reindexAll();
  context = { index, readSource: (file) => io.readFile(testAbsPath(file)) };
  tools = new Map(createTools(context).map((tool) => [tool.name, tool]));
});

async function call(name: string, input: unknown = {}): Promise<unknown> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`no such tool: ${name}`);
  const result = await tool.handler(input);
  expect(result.isError).toBeUndefined();
  return JSON.parse(result.content[0]?.text ?? 'null');
}

describe('createTools', () => {
  it('exposes exactly the documented tool set', () => {
    expect([...tools.keys()]).toEqual([
      'index_status',
      'search_symbols',
      'get_symbol',
      'file_outline',
      'find_references',
      'read_lines',
      'reindex',
    ]);
  });

  it('every tool has a description the agent can choose from', () => {
    for (const tool of tools.values()) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.title).not.toBe('');
    }
  });

  it('explains an unindexed file instead of failing', async () => {
    // Tool-layer only: query.fileOutline returns undefined; the adapter maps that
    // to a structured error payload agents can act on.
    expect(await call('file_outline', { file: 'src/missing.ts' })).toMatchObject({
      file: 'src/missing.ts',
      error: expect.stringContaining('Not indexed'),
    });
  });

  it('rejects invalid arguments with a readable message', async () => {
    const result = await tools.get('read_lines')?.handler({ file: 'src/timer.ts', startLine: 0 });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain('Invalid arguments');
  });

  it('reports when reindex cannot pick up a path', async () => {
    // Tool-layer only: index.update returns undefined; the adapter shapes the miss.
    expect(await call('reindex', { file: 'src/nope.ts' })).toMatchObject({ indexed: false });
  });
});

describe('createContextServer', () => {
  it('registers every tool on an MCP server', () => {
    expect(() => createContextServer(context)).not.toThrow();
    // Registering the same name twice throws, so a second build proves the
    // registration loop is not leaking state between instances.
    expect(() => createContextServer(context)).not.toThrow();
  });
});
