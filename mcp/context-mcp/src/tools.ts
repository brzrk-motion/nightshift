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

/**
 * A type alias rather than an interface: the SDK's result type carries an index
 * signature, and only anonymous object types get an implicit one.
 */
export type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean | undefined;
};

/**
 * A tool as data: the schema and the handler travel together, so the MCP
 * wiring in `server.ts` stays a loop and the behaviour is testable without a
 * transport.
 */
export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject;
  handler(input: unknown): Promise<ToolResult>;
}

function defineTool<S extends z.ZodObject>(spec: {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  run(input: z.output<S>): Promise<unknown>;
}): Tool {
  return {
    name: spec.name,
    title: spec.title,
    description: spec.description,
    inputSchema: spec.inputSchema,
    async handler(input) {
      const parsed = spec.inputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return text(`Invalid arguments: ${parsed.error.issues.map((i) => i.message).join('; ')}`, {
          isError: true,
        });
      }
      const result = await spec.run(parsed.data);
      return text(JSON.stringify(result, null, 2));
    },
  };
}

function text(body: string, options: { isError?: boolean } = {}): ToolResult {
  return { content: [{ type: 'text', text: body }], ...options };
}

/** Every tool the context server exposes, in the order they are advertised. */
export function createTools(context: QueryContext): Tool[] {
  return [
    defineTool({
      name: 'index_status',
      title: 'Index status',
      description:
        'Report what the code index currently holds: root, file and symbol counts, languages, and how many files failed to parse. Call this first if a query returns nothing unexpected.',
      inputSchema: z.object({}),
      run: async () => context.index.stats(),
    }),

    defineTool({
      name: 'search_symbols',
      title: 'Search symbols',
      description:
        "Find definitions by name, kind and path without reading any files. Returns each symbol's file, line range, signature and doc comment — enough to decide what to fetch next. Prefer this over a text search when looking for where something is defined.",
      inputSchema: searchSymbolsInputSchema,
      run: async (input) => searchSymbols(context, input),
    }),

    defineTool({
      name: 'get_symbol',
      title: 'Get symbol source',
      description:
        'Return the exact source of a definition — the whole function, class or type and nothing else. Use this instead of reading a file when you know the name you need.',
      inputSchema: getSymbolInputSchema,
      run: async (input) => getSymbol(context, input),
    }),

    defineTool({
      name: 'file_outline',
      title: 'File outline',
      description:
        'List every definition in one file with its line range and signature, and no bodies. The cheap way to understand a file before deciding which parts to read.',
      inputSchema: fileOutlineInputSchema,
      run: async ({ file }) =>
        fileOutline(context, file) ?? {
          file,
          error: 'Not indexed. Check the path, or call reindex if the file is new.',
        },
    }),

    defineTool({
      name: 'find_references',
      title: 'Find references',
      description:
        'Every place an identifier is mentioned, taken from the syntax tree — so matches inside comments and strings are never reported. Identifier-level and not type-aware: unrelated members sharing a name are included.',
      inputSchema: findReferencesInputSchema,
      run: async (input) => findReferences(context, input),
    }),

    defineTool({
      name: 'read_lines',
      title: 'Read lines',
      description:
        'Read an exact, inclusive line range from an indexed file. Use it to follow up on a line number from another tool instead of reading the whole file.',
      inputSchema: readLinesInputSchema,
      run: async (input) =>
        readLines(context, input).catch((error: unknown) => ({
          file: input.file,
          error: error instanceof Error ? error.message : String(error),
        })),
    }),

    defineTool({
      name: 'reindex',
      title: 'Reindex',
      description:
        'Force a refresh. The index follows file changes on its own, so this is only needed after a bulk change such as a branch switch, or to pick up a brand new file immediately.',
      inputSchema: reindexInputSchema,
      run: async ({ file }) => {
        if (file === undefined) return context.index.reindexAll();
        const entry = await context.index.update(file);
        return entry
          ? { file: entry.file, symbols: entry.symbols.length, error: entry.error ?? null }
          : { file, indexed: false, reason: 'Missing, too large, or an unsupported language.' };
      },
    }),
  ];
}
