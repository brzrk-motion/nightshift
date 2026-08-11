import { beforeAll, describe, expect, it } from 'vitest';

import { createExtractor, type Extractor } from './extract.js';

let extractor: Extractor;

beforeAll(async () => {
  extractor = await createExtractor();
});

describe('extract', () => {
  it('finds TypeScript declarations with their kind, range and export flag', () => {
    const source = [
      '/** Adds two numbers. */',
      'export function add(a: number, b: number): number {',
      '  return a + b;',
      '}',
      '',
      'interface Shape {',
      '  area(): number;',
      '}',
      '',
      'type Id = string;',
      '',
      'enum Colour {',
      '  Red,',
      '}',
      '',
      'const LIMIT = 10;',
      '',
      'export const scale = (n: number) => n * LIMIT;',
    ].join('\n');

    const { symbols } = extractor.extract('src/a.ts', 'typescript', source);
    const summary = symbols.map((s) => [s.name, s.kind, s.exported, s.startLine, s.endLine]);

    expect(summary).toEqual([
      ['add', 'function', true, 2, 4],
      ['Shape', 'interface', false, 6, 8],
      ['area', 'method', false, 7, 7],
      ['Id', 'type', false, 10, 10],
      ['Colour', 'enum', false, 12, 14],
      ['LIMIT', 'variable', false, 16, 16],
      ['scale', 'function', true, 18, 18],
    ]);
  });

  it('captures the signature and the comment block above a declaration', () => {
    const source = [
      '// First line.',
      '// Second line.',
      'export async function load(path: string): Promise<string> {',
      '  return path;',
      '}',
    ].join('\n');

    const [symbol] = extractor.extract('src/a.ts', 'typescript', source).symbols;

    expect(symbol?.signature).toBe('export async function load(path: string): Promise<string>');
    expect(symbol?.doc).toBe('// First line.\n// Second line.');
  });

  it('records the enclosing class as the container of a method', () => {
    const source = [
      'export class Timer {',
      '  start(): void {}',
      '  private tick = () => {};',
      '}',
    ].join('\n');

    const { symbols } = extractor.extract('src/a.ts', 'typescript', source);

    expect(symbols.map((s) => [s.name, s.kind, s.container])).toEqual([
      ['Timer', 'class', undefined],
      ['start', 'method', 'Timer'],
      ['tick', 'method', 'Timer'],
    ]);
  });

  it('prefers the function kind over the variable kind for the same range', () => {
    const { symbols } = extractor.extract(
      'src/a.ts',
      'typescript',
      'const handler = function () {};',
    );

    expect(symbols).toHaveLength(1);
    expect(symbols[0]?.kind).toBe('function');
  });

  it('parses TSX components and JavaScript classes', () => {
    const tsx = extractor.extract('src/w.tsx', 'tsx', 'export const Badge = () => <box>hi</box>;');
    expect(tsx.symbols.map((s) => s.name)).toEqual(['Badge']);

    const js = extractor.extract('src/w.js', 'javascript', 'class Store {\n  get() {}\n}');
    expect(js.symbols.map((s) => [s.name, s.kind])).toEqual([
      ['Store', 'class'],
      ['get', 'method'],
    ]);
  });

  it('reports what it can from a file with a syntax error', () => {
    const { symbols } = extractor.extract(
      'src/a.ts',
      'typescript',
      'export function ok() {}\nfunction broken(',
    );

    expect(symbols.map((s) => s.name)).toContain('ok');
  });

  it('indexes identifier references but not text in comments or strings', () => {
    const source = [
      'const target = 1;',
      '// target in a comment',
      'const label = "target in a string";',
      'export function use() {',
      '  return target;',
      '}',
    ].join('\n');

    const { references } = extractor.extract('src/a.ts', 'typescript', source);

    expect(references.get('target')).toEqual([1, 5]);
  });
});
