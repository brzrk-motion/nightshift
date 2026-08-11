/** The kinds of definition the index knows how to recognise. */
export const SYMBOL_KINDS = [
  'function',
  'class',
  'method',
  'interface',
  'type',
  'enum',
  'variable',
] as const;

export type SymbolKind = (typeof SYMBOL_KINDS)[number];

/** A single definition found in a file. Lines are 1-based and inclusive. */
export interface SymbolRecord {
  /** Repository-relative, POSIX-separated path. */
  file: string;
  name: string;
  kind: SymbolKind;
  /** Enclosing class/interface/enum name, when the symbol is nested in one. */
  container?: string;
  exported: boolean;
  startLine: number;
  endLine: number;
  /** The declaration up to (but not including) its body, whitespace collapsed. */
  signature: string;
  /** The comment block immediately above the declaration, if any. */
  doc?: string;
}

/**
 * Every place an identifier is mentioned in a file, keyed by identifier and
 * holding sorted 1-based line numbers. Built from the syntax tree, so text
 * inside comments and string literals never appears here.
 */
export type ReferenceMap = ReadonlyMap<string, readonly number[]>;

/** What the index holds for one file. */
export interface FileEntry {
  file: string;
  language: LanguageId;
  size: number;
  mtimeMs: number;
  symbols: readonly SymbolRecord[];
  references: ReferenceMap;
  /** Set when the file could not be read or parsed; the entry is kept anyway. */
  error?: string;
}

export type LanguageId = 'typescript' | 'tsx' | 'javascript';

export interface IndexStats {
  root: string;
  files: number;
  symbols: number;
  failed: number;
  languages: Record<string, number>;
  /** Epoch milliseconds of the last completed index write, or null before the first. */
  updatedAt: number | null;
}
