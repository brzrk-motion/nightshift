import { type McpServer } from '@modelcontextprotocol/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { type QueryContext } from './query.js';
import { createContextServer, registerTools } from './server.js';
import { makeTestIndex } from './testFixtures.js';

const SOURCES: Record<string, string> = {
  'src/timer.ts': ['export function tick(): number {', '  return 1;', '}'].join('\n'),
};

type ToolHandler = (input: unknown) => Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}>;

let tools: Map<string, ToolHandler>;
let context: QueryContext;

function captureTools(queryContext: QueryContext): Map<string, ToolHandler> {
  const captured = new Map<string, ToolHandler>();
  const server = {
    registerTool(name: string, _meta: unknown, handler: ToolHandler) {
      captured.set(name, handler);
    },
  } as McpServer;
  registerTools(server, queryContext);
  return captured;
}

beforeAll(async () => {
  context = await makeTestIndex(SOURCES);
  tools = captureTools(context);
});

async function call(name: string, input: unknown = {}): Promise<unknown> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`no such tool: ${name}`);
  const result = await tool(input);
  expect(result.isError).toBeUndefined();
  return JSON.parse(result.content[0]?.text ?? 'null');
}

describe('registerTools', () => {
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
    const server = {
      registerTool(
        name: string,
        meta: { description: string; title: string },
        _handler: ToolHandler,
      ) {
        expect(meta.description.length).toBeGreaterThan(40);
        expect(meta.title).not.toBe('');
        expect(tools.has(name)).toBe(true);
      },
    } as McpServer;
    registerTools(server, context);
  });

  it('explains an unindexed file instead of failing', async () => {
    expect(await call('file_outline', { file: 'src/missing.ts' })).toMatchObject({
      file: 'src/missing.ts',
      error: expect.stringContaining('Not indexed'),
    });
  });

  it('rejects invalid arguments with a readable message', async () => {
    const result = await tools.get('read_lines')?.({ file: 'src/timer.ts', startLine: 0 });

    expect(result?.isError).toBe(true);
    expect(result?.content[0]?.text).toContain('Invalid arguments');
  });

  it('reports when reindex cannot pick up a path', async () => {
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
