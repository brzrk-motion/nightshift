import { Language, type Node, Parser, Query } from 'web-tree-sitter';

import { grammarPath, LANGUAGE_IDS } from './languages.js';
import { definitionQuery, referenceQuery } from './queries.js';
import { type LanguageId, type SymbolKind, type SymbolRecord } from './types.js';

export interface ExtractResult {
  symbols: SymbolRecord[];
  references: Map<string, number[]>;
}

export interface Extractor {
  extract(file: string, language: LanguageId, source: string): ExtractResult;
}

interface Grammar {
  parser: Parser;
  definitions: Query;
  references: Query;
}

const SIGNATURE_LIMIT = 240;

/**
 * Two patterns can match the same declaration — `const f = () => {}` is both a
 * function and a variable — so identical ranges collapse to the higher rank.
 */
const KIND_RANK: Readonly<Record<SymbolKind, number>> = {
  method: 2,
  function: 2,
  class: 2,
  interface: 2,
  type: 2,
  enum: 2,
  variable: 1,
};

const CONTAINER_TYPES = new Set([
  'class_declaration',
  'abstract_class_declaration',
  'class',
  'interface_declaration',
  'enum_declaration',
]);

/** Statement wrappers a declaration hides inside; climbed to find its comment and `export`. */
const WRAPPER_TYPES = new Set(['export_statement', 'lexical_declaration', 'variable_declaration']);

/**
 * Loads every grammar once and returns a synchronous extractor. Parsing stays
 * synchronous so the index and its tests never have to await a single file.
 */
export async function createExtractor(): Promise<Extractor> {
  await Parser.init();

  const grammars = new Map<LanguageId, Grammar>();
  for (const id of LANGUAGE_IDS) {
    const language = await Language.load(grammarPath(id));
    const parser = new Parser();
    parser.setLanguage(language);
    grammars.set(id, {
      parser,
      definitions: new Query(language, definitionQuery(id)),
      references: new Query(language, referenceQuery(id)),
    });
  }

  return {
    extract(file, language, source) {
      const grammar = grammars.get(language);
      if (!grammar) return { symbols: [], references: new Map() };

      const tree = grammar.parser.parse(source);
      if (!tree) return { symbols: [], references: new Map() };
      try {
        return {
          symbols: collectSymbols(grammar, tree.rootNode, file, source),
          references: collectReferences(grammar, tree.rootNode),
        };
      } finally {
        // Trees hold WebAssembly memory that the GC does not reclaim.
        tree.delete();
      }
    },
  };
}

function collectSymbols(
  grammar: Grammar,
  root: Node,
  file: string,
  source: string,
): SymbolRecord[] {
  const byRange = new Map<string, SymbolRecord>();

  for (const match of grammar.definitions.matches(root)) {
    let nameNode: Node | undefined;
    let definitionNode: Node | undefined;
    let kind: SymbolKind | undefined;

    for (const capture of match.captures) {
      if (capture.name === 'name') nameNode = capture.node;
      else if (capture.name.startsWith('definition.')) {
        definitionNode = capture.node;
        kind = capture.name.slice('definition.'.length) as SymbolKind;
      }
    }
    if (!nameNode || !definitionNode || !kind) continue;

    const name = nameNode.text;
    if (!name) continue;

    const startLine = definitionNode.startPosition.row + 1;
    const endLine = definitionNode.endPosition.row + 1;
    const container = containerOf(definitionNode);
    const doc = docOf(definitionNode);
    const record: SymbolRecord = {
      file,
      name,
      kind,
      exported: isExported(definitionNode),
      startLine,
      endLine,
      signature: signatureOf(definitionNode, source),
      ...(container === undefined ? {} : { container }),
      ...(doc === undefined ? {} : { doc }),
    };

    const key = `${name}|${startLine}|${endLine}`;
    const existing = byRange.get(key);
    if (!existing || KIND_RANK[kind] > KIND_RANK[existing.kind]) byRange.set(key, record);
  }

  return [...byRange.values()].sort(
    (a, b) => a.startLine - b.startLine || a.name.localeCompare(b.name),
  );
}

function collectReferences(grammar: Grammar, root: Node): Map<string, number[]> {
  const lines = new Map<string, Set<number>>();

  for (const capture of grammar.references.captures(root)) {
    const name = capture.node.text;
    if (!name) continue;
    let seen = lines.get(name);
    if (!seen) lines.set(name, (seen = new Set()));
    seen.add(capture.node.startPosition.row + 1);
  }

  const references = new Map<string, number[]>();
  for (const [name, seen] of lines)
    references.set(
      name,
      [...seen].sort((a, b) => a - b),
    );
  return references;
}

/** The nearest enclosing class, interface or enum name. */
function containerOf(node: Node): string | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!CONTAINER_TYPES.has(parent.type)) continue;
    const name = parent.childForFieldName('name');
    if (name?.text) return name.text;
  }
  return undefined;
}

function isExported(node: Node): boolean {
  for (let current: Node | null = node; current; current = current.parent) {
    if (current.type === 'export_statement') return true;
    if (!WRAPPER_TYPES.has(current.type) && current !== node) break;
  }
  return false;
}

/** Climbs out of `const`/`export` wrappers so a signature reads as written. */
function outermost(node: Node): Node {
  let current = node;
  while (current.parent && WRAPPER_TYPES.has(current.parent.type)) current = current.parent;
  return current;
}

/**
 * The declaration up to the start of its body — enough for the agent to judge
 * relevance without pulling the whole definition.
 */
function signatureOf(node: Node, source: string): string {
  const outer = outermost(node);
  const end = bodyStart(node) ?? endOfLine(source, outer.startIndex);
  const text = source.slice(outer.startIndex, Math.max(end, outer.startIndex)).trim();
  const collapsed = text.replace(/\s+/g, ' ');
  return collapsed.length > SIGNATURE_LIMIT ? `${collapsed.slice(0, SIGNATURE_LIMIT)}…` : collapsed;
}

function bodyStart(node: Node): number | undefined {
  const body = node.childForFieldName('body');
  if (body) return body.startIndex;
  const value = node.childForFieldName('value');
  const valueBody = value?.childForFieldName('body');
  return valueBody ? valueBody.startIndex : undefined;
}

function endOfLine(source: string, from: number): number {
  const newline = source.indexOf('\n', from);
  return newline === -1 ? source.length : newline;
}

/** The contiguous comment block sitting directly above the declaration. */
function docOf(node: Node): string | undefined {
  const outer = outermost(node);
  const lines: string[] = [];
  let expectedRow = outer.startPosition.row - 1;

  for (let prev = outer.previousSibling; prev; prev = prev.previousSibling) {
    if (prev.type !== 'comment' || prev.endPosition.row !== expectedRow) break;
    lines.unshift(prev.text);
    expectedRow = prev.startPosition.row - 1;
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}
