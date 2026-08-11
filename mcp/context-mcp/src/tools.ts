import { z } from 'zod';

import {
  fileOutline,
  findReferences,
  getSymbol,
  type QueryContext,
  readLines,
  searchSymbols,
} from './query.js';
import { SYMBOL_KINDS } from './types.js';

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

const kindSchema = z.enum(SYMBOL_KINDS);
const pathGlob = z
  .string()
  .describe('Glob over repository-relative paths, e.g. "packages/**/*.ts".');

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
      inputSchema: z.object({
        name: z.string().optional().describe('Case-insensitive match; exact names rank first.'),
        kinds: z.array(kindSchema).optional().describe('Restrict to these kinds of definition.'),
        path: pathGlob.optional(),
        exportedOnly: z.boolean().optional().describe('Only symbols exported from their module.'),
        limit: z.number().int().positive().optional().describe('Defaults to 50.'),
      }),
      run: async (input) => searchSymbols(context, input),
    }),

    defineTool({
      name: 'get_symbol',
      title: 'Get symbol source',
      description:
        'Return the exact source of a definition — the whole function, class or type and nothing else. Use this instead of reading a file when you know the name you need.',
      inputSchema: z.object({
        name: z.string().describe('The symbol name, matched case-insensitively.'),
        file: z
          .string()
          .optional()
          .describe('Disambiguate when the name is defined in several files.'),
        kind: kindSchema.optional(),
        contextLines: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Extra lines above and below. Defaults to 0.'),
        includeDoc: z
          .boolean()
          .optional()
          .describe('Include the comment block above the definition. Defaults to true.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Definitions to return. Defaults to 3.'),
      }),
      run: async (input) => getSymbol(context, input),
    }),

    defineTool({
      name: 'file_outline',
      title: 'File outline',
      description:
        'List every definition in one file with its line range and signature, and no bodies. The cheap way to understand a file before deciding which parts to read.',
      inputSchema: z.object({
        file: z.string().describe('Repository-relative path.'),
      }),
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
      inputSchema: z.object({
        name: z.string().describe('The exact identifier, case-sensitive.'),
        path: pathGlob.optional(),
        includeLines: z
          .boolean()
          .optional()
          .describe('Include the source line of each hit. Defaults to true.'),
        limit: z.number().int().positive().optional().describe('Defaults to 200.'),
      }),
      run: async (input) => findReferences(context, input),
    }),

    defineTool({
      name: 'read_lines',
      title: 'Read lines',
      description:
        'Read an exact, inclusive line range from an indexed file. Use it to follow up on a line number from another tool instead of reading the whole file.',
      inputSchema: z.object({
        file: z.string().describe('Repository-relative path.'),
        startLine: z.number().int().positive().describe('1-based, inclusive.'),
        endLine: z.number().int().positive().describe('1-based, inclusive.'),
      }),
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
      inputSchema: z.object({
        file: z
          .string()
          .optional()
          .describe('Reindex just this path. Omit to reindex the whole tree.'),
      }),
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
