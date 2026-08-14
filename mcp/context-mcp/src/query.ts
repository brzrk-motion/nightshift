import { z } from 'zod';

import { type CodeIndex } from './store.js';
import { SYMBOL_KINDS, type LanguageId, type SymbolRecord } from './types.js';

export interface QueryContext {
  index: CodeIndex;
  /** Reads a repository-relative file. Injected so queries stay testable. */
  readSource(file: string): Promise<string>;
}

export const DEFAULT_SYMBOL_LIMIT = 50;
export const DEFAULT_REFERENCE_LIMIT = 200;
export const MAX_SLICE_LINES = 400;

const kindSchema = z.enum(SYMBOL_KINDS);
const pathGlob = z
  .string()
  .describe('Glob over repository-relative paths, e.g. "packages/**/*.ts".');

export const searchSymbolsInputSchema = z.object({
  name: z.string().optional().describe('Case-insensitive match; exact names rank first.'),
  kinds: z.array(kindSchema).optional().describe('Restrict to these kinds of definition.'),
  path: pathGlob.optional(),
  exportedOnly: z.boolean().optional().describe('Only symbols exported from their module.'),
  limit: z.number().int().positive().optional().describe('Defaults to 50.'),
});
export type SearchSymbolsInput = z.infer<typeof searchSymbolsInputSchema>;

export interface SearchSymbolsResult {
  total: number;
  truncated: boolean;
  symbols: readonly SymbolRecord[];
}

/**
 * Ranks exact names above prefixes above substrings, so the symbol the agent
 * actually asked for is not buried under incidental matches.
 */
export function searchSymbols(
  context: QueryContext,
  input: SearchSymbolsInput,
): SearchSymbolsResult {
  const limit = clampLimit(input.limit, DEFAULT_SYMBOL_LIMIT);
  const needle = input.name?.toLowerCase();
  const kinds = input.kinds && input.kinds.length > 0 ? new Set(input.kinds) : undefined;
  const matchesPath = pathMatcher(input.path);

  const scored: { rank: number; symbol: SymbolRecord }[] = [];
  for (const entry of context.index.files()) {
    if (!matchesPath(entry.file)) continue;
    for (const symbol of entry.symbols) {
      if (kinds && !kinds.has(symbol.kind)) continue;
      if (input.exportedOnly && !symbol.exported) continue;
      const rank = needle === undefined ? 0 : rankName(symbol.name.toLowerCase(), needle);
      if (rank === null) continue;
      scored.push({ rank, symbol });
    }
  }

  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.symbol.file.localeCompare(b.symbol.file) ||
      a.symbol.startLine - b.symbol.startLine,
  );

  return {
    total: scored.length,
    truncated: scored.length > limit,
    symbols: scored.slice(0, limit).map((hit) => hit.symbol),
  };
}

/** 0 exact, 1 prefix, 2 substring, `null` for no match. */
function rankName(name: string, needle: string): number | null {
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  return name.includes(needle) ? 2 : null;
}

export interface FileOutlineResult {
  file: string;
  language: LanguageId;
  symbols: readonly SymbolRecord[];
  error?: string;
}

/** Every definition in one file, without any bodies. */
export function fileOutline(context: QueryContext, file: string): FileOutlineResult | undefined {
  const entry = context.index.entry(file);
  if (!entry) return undefined;
  return {
    file: entry.file,
    language: entry.language,
    symbols: entry.symbols,
    ...(entry.error === undefined ? {} : { error: entry.error }),
  };
}

export const getSymbolInputSchema = z.object({
  name: z.string().describe('The symbol name, matched case-insensitively.'),
  file: z.string().optional().describe('Disambiguate when the name is defined in several files.'),
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
  limit: z.number().int().positive().optional().describe('Definitions to return. Defaults to 3.'),
});
export type GetSymbolInput = z.infer<typeof getSymbolInputSchema>;

export interface SymbolSource extends ReadLinesResult {
  symbol: SymbolRecord;
}

export interface GetSymbolResult {
  total: number;
  definitions: readonly SymbolSource[];
}

/** The exact source of a definition — the whole point of the index. */
export async function getSymbol(
  context: QueryContext,
  input: GetSymbolInput,
): Promise<GetSymbolResult> {
  const limit = clampLimit(input.limit, 3);
  const wanted = input.name.toLowerCase();
  const matches: SymbolRecord[] = [];

  for (const entry of context.index.files()) {
    if (input.file !== undefined && entry.file !== input.file) continue;
    for (const symbol of entry.symbols) {
      if (symbol.name.toLowerCase() !== wanted) continue;
      if (input.kind !== undefined && symbol.kind !== input.kind) continue;
      matches.push(symbol);
    }
  }

  const definitions: SymbolSource[] = [];
  for (const symbol of matches.slice(0, limit)) {
    const contextLines = Math.max(0, input.contextLines ?? 0);
    const docLines = input.includeDoc === false ? 0 : countLines(symbol.doc);
    const startLine = Math.max(1, symbol.startLine - docLines - contextLines);
    const endLine = symbol.endLine + contextLines;
    definitions.push({ symbol, ...(await slice(context, symbol.file, startLine, endLine)) });
  }

  return { total: matches.length, definitions };
}

export interface ReferenceHit {
  file: string;
  line: number;
  /** True when this line is where the name is defined. */
  isDefinition: boolean;
  text?: string;
}

export const findReferencesInputSchema = z.object({
  name: z.string().describe('The exact identifier, case-sensitive.'),
  path: pathGlob.optional(),
  includeLines: z
    .boolean()
    .optional()
    .describe('Include the source line of each hit. Defaults to true.'),
  limit: z.number().int().positive().optional().describe('Defaults to 200.'),
});
export type FindReferencesInput = z.infer<typeof findReferencesInputSchema>;

export interface FindReferencesResult {
  name: string;
  total: number;
  truncated: boolean;
  hits: readonly ReferenceHit[];
}

/**
 * Every mention of an identifier across the index. This is identifier-level and
 * not type-aware — two unrelated members with the same name are both reported —
 * but because it comes from the syntax tree, matches in comments and strings
 * never are.
 */
export async function findReferences(
  context: QueryContext,
  input: FindReferencesInput,
): Promise<FindReferencesResult> {
  const limit = clampLimit(input.limit, DEFAULT_REFERENCE_LIMIT);
  const matchesPath = pathMatcher(input.path);
  const hits: ReferenceHit[] = [];

  for (const entry of context.index.files()) {
    if (!matchesPath(entry.file)) continue;
    const lines = entry.references.get(input.name);
    if (!lines || lines.length === 0) continue;

    const definitionLines = new Set(
      entry.symbols.filter((symbol) => symbol.name === input.name).map((s) => s.startLine),
    );
    for (const line of lines) {
      hits.push({ file: entry.file, line, isDefinition: definitionLines.has(line) });
    }
  }

  const total = hits.length;
  const shown = hits.slice(0, limit);

  if (input.includeLines !== false) {
    const byFile = new Map<string, ReferenceHit[]>();
    for (const hit of shown) {
      const group = byFile.get(hit.file);
      if (group) group.push(hit);
      else byFile.set(hit.file, [hit]);
    }
    for (const [file, group] of byFile) {
      let sourceLines: string[];
      try {
        sourceLines = (await context.readSource(file)).split('\n');
      } catch {
        continue;
      }
      for (const hit of group) {
        const text = sourceLines[hit.line - 1];
        if (text !== undefined) hit.text = text.trim();
      }
    }
  }

  return { name: input.name, total, truncated: total > limit, hits: shown };
}

export const readLinesInputSchema = z.object({
  file: z.string().describe('Repository-relative path.'),
  startLine: z.number().int().positive().describe('1-based, inclusive.'),
  endLine: z.number().int().positive().describe('1-based, inclusive.'),
});
export type ReadLinesInput = z.infer<typeof readLinesInputSchema>;

export const fileOutlineInputSchema = z.object({
  file: z.string().describe('Repository-relative path.'),
});

export const reindexInputSchema = z.object({
  file: z.string().optional().describe('Reindex just this path. Omit to reindex the whole tree.'),
});

export interface ReadLinesResult {
  file: string;
  startLine: number;
  endLine: number;
  truncated: boolean;
  source: string;
}

/** A precise line range, so a whole file never has to be pulled for a few lines. */
export async function readLines(
  context: QueryContext,
  input: ReadLinesInput,
): Promise<ReadLinesResult> {
  const start = Math.max(1, Math.trunc(input.startLine));
  const end = Math.max(start, Math.trunc(input.endLine));
  return slice(context, input.file, start, end);
}

async function slice(
  context: QueryContext,
  file: string,
  startLine: number,
  endLine: number,
): Promise<ReadLinesResult> {
  const lines = (await context.readSource(file)).split('\n');
  const start = Math.min(Math.max(1, startLine), Math.max(1, lines.length));
  const requestedEnd = Math.min(endLine, lines.length);
  const cappedEnd = Math.min(requestedEnd, start + MAX_SLICE_LINES - 1);

  return {
    file,
    startLine: start,
    endLine: cappedEnd,
    truncated: cappedEnd < requestedEnd,
    source: lines.slice(start - 1, cappedEnd).join('\n'),
  };
}

function countLines(text: string | undefined): number {
  return text === undefined ? 0 : text.split('\n').length;
}

function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(1, Math.trunc(limit)), 1000);
}

/** Matches every path when no glob is given. `**` crosses directories, `*` does not. */
function pathMatcher(glob: string | undefined): (file: string) => boolean {
  if (glob === undefined || glob === '') return () => true;

  let pattern = '';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*') {
      if (glob[index + 1] === '*') {
        pattern += '.*';
        index += 1;
      } else {
        pattern += '[^/]*';
      }
    } else if (character === '?') {
      pattern += '[^/]';
    } else {
      pattern += character?.replace(/[.+^${}()|[\]\\]/g, '\\$&') ?? '';
    }
  }

  const regex = new RegExp(`^${pattern}$`);
  return (file) => regex.test(file);
}
