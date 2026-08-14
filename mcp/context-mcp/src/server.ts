import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import {
  fileOutline,
  fileOutlineInputSchema,
  findReferences,
  findReferencesInputSchema,
  getSymbol,
  getSymbolInputSchema,
  type QueryContext,
  readLines,
  readLinesInputSchema,
  reindexInputSchema,
  searchSymbols,
  searchSymbolsInputSchema,
} from './query.js';

export const SERVER_NAME = 'nightshift-context';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'A tree-sitter index of the repository, kept current as files change.',
  'Ask for the narrowest thing that answers the question: search_symbols to locate a',
  'definition, get_symbol for its exact source, file_outline before reading a file,',
  'find_references to see who uses an identifier, read_lines for a known range.',
  'Reading whole files should be the last resort, not the first move.',
].join(' ');

function text(body: string, options: { isError?: boolean } = {}) {
  return { content: [{ type: 'text' as const, text: body }], ...options };
}

function invalidArgs(error: z.ZodError) {
  return text(`Invalid arguments: ${error.issues.map((issue) => issue.message).join('; ')}`, {
    isError: true,
  });
}

/** Registers every tool the context server exposes, in the order they are advertised. */
export function registerTools(server: McpServer, context: QueryContext): void {
  server.registerTool(
    'index_status',
    {
      title: 'Index status',
      description:
        'Report what the code index currently holds: root, file and symbol counts, languages, and how many files failed to parse. Call this first if a query returns nothing unexpected.',
      inputSchema: z.object({}),
    },
    async (input) => {
      const parsed = z.object({}).safeParse(input ?? {});
      if (!parsed.success) return invalidArgs(parsed.error);
      return text(JSON.stringify(await context.index.stats(), null, 2));
    },
  );

  server.registerTool(
    'search_symbols',
    {
      title: 'Search symbols',
      description:
        "Find definitions by name, kind and path without reading any files. Returns each symbol's file, line range, signature and doc comment — enough to decide what to fetch next. Prefer this over a text search when looking for where something is defined.",
      inputSchema: searchSymbolsInputSchema,
    },
    async (input) => {
      const parsed = searchSymbolsInputSchema.safeParse(input ?? {});
      if (!parsed.success) return invalidArgs(parsed.error);
      return text(JSON.stringify(await searchSymbols(context, parsed.data), null, 2));
    },
  );

  server.registerTool(
    'get_symbol',
    {
      title: 'Get symbol source',
      description:
        'Return the exact source of a definition — the whole function, class or type and nothing else. Use this instead of reading a file when you know the name you need.',
      inputSchema: getSymbolInputSchema,
    },
    async (input) => {
      const parsed = getSymbolInputSchema.safeParse(input ?? {});
      if (!parsed.success) return invalidArgs(parsed.error);
      return text(JSON.stringify(await getSymbol(context, parsed.data), null, 2));
    },
  );

  server.registerTool(
    'file_outline',
    {
      title: 'File outline',
      description:
        'List every definition in one file with its line range and signature, and no bodies. The cheap way to understand a file before deciding which parts to read.',
      inputSchema: fileOutlineInputSchema,
    },
    async (input) => {
      const parsed = fileOutlineInputSchema.safeParse(input ?? {});
      if (!parsed.success) return invalidArgs(parsed.error);
      const { file } = parsed.data;
      const result = fileOutline(context, file) ?? {
        file,
        error: 'Not indexed. Check the path, or call reindex if the file is new.',
      };
      return text(JSON.stringify(result, null, 2));
    },
  );

  server.registerTool(
    'find_references',
    {
      title: 'Find references',
      description:
        'Every place an identifier is mentioned, taken from the syntax tree — so matches inside comments and strings are never reported. Identifier-level and not type-aware: unrelated members sharing a name are included.',
      inputSchema: findReferencesInputSchema,
    },
    async (input) => {
      const parsed = findReferencesInputSchema.safeParse(input ?? {});
      if (!parsed.success) return invalidArgs(parsed.error);
      return text(JSON.stringify(await findReferences(context, parsed.data), null, 2));
    },
  );

  server.registerTool(
    'read_lines',
    {
      title: 'Read lines',
      description:
        'Read an exact, inclusive line range from an indexed file. Use it to follow up on a line number from another tool instead of reading the whole file.',
      inputSchema: readLinesInputSchema,
    },
    async (input) => {
      const parsed = readLinesInputSchema.safeParse(input ?? {});
      if (!parsed.success) return invalidArgs(parsed.error);
      const result = await readLines(context, parsed.data).catch((error: unknown) => ({
        file: parsed.data.file,
        error: error instanceof Error ? error.message : String(error),
      }));
      return text(JSON.stringify(result, null, 2));
    },
  );

  server.registerTool(
    'reindex',
    {
      title: 'Reindex',
      description:
        'Force a refresh. The index follows file changes on its own, so this is only needed after a bulk change such as a branch switch, or to pick up a brand new file immediately.',
      inputSchema: reindexInputSchema,
    },
    async (input) => {
      const parsed = reindexInputSchema.safeParse(input ?? {});
      if (!parsed.success) return invalidArgs(parsed.error);
      const { file } = parsed.data;
      if (file === undefined) {
        return text(JSON.stringify(await context.index.reindexAll(), null, 2));
      }
      const entry = await context.index.update(file);
      const result = entry
        ? { file: entry.file, symbols: entry.symbols.length, error: entry.error ?? null }
        : { file, indexed: false, reason: 'Missing, too large, or an unsupported language.' };
      return text(JSON.stringify(result, null, 2));
    },
  );
}

/**
 * Builds the MCP server. One instance per connection — `serveStdio` and
 * `createMcpHandler` both take this as a factory — while the index behind it is
 * shared and long-lived.
 */
export function createContextServer(context: QueryContext): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  registerTools(server, context);

  return server;
}
