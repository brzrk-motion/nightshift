import { createRequire } from 'node:module';
import { extname } from 'node:path';

import { type LanguageId } from './types.js';

const require = createRequire(import.meta.url);

/**
 * File extension to grammar. `.jsx` is served by the JavaScript grammar, which
 * already parses JSX; only TypeScript needs the separate `tsx` dialect.
 */
const BY_EXTENSION: Readonly<Record<string, LanguageId>> = {
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
};

export const LANGUAGE_IDS: readonly LanguageId[] = ['typescript', 'tsx', 'javascript'];

/** The grammar for a path, or `undefined` when the file is not indexable. */
export function languageForPath(path: string): LanguageId | undefined {
  return BY_EXTENSION[extname(path).toLowerCase()];
}

/** Absolute path to a grammar's prebuilt WebAssembly module. */
export function grammarPath(language: LanguageId): string {
  return require.resolve(`tree-sitter-wasms/out/tree-sitter-${language}.wasm`);
}
