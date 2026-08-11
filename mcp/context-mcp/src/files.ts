import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { languageForPath } from './languages.js';

/** Never walked, and never indexed even when a `.gitignore` would allow them. */
export const IGNORED_DIRECTORIES: readonly string[] = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
  '.cache',
];

const ignored = new Set(IGNORED_DIRECTORIES);

/** Whether a path is one this index can parse and is not in an ignored directory. */
export function isIndexable(relativePath: string): boolean {
  if (languageForPath(relativePath) === undefined) return false;
  return !toPosix(relativePath)
    .split('/')
    .some((segment) => ignored.has(segment));
}

/** A repository-relative, POSIX-separated path, or `undefined` if outside the root. */
export function toRelative(root: string, path: string): string | undefined {
  const rel = relative(resolve(root), resolve(root, path));
  if (rel === '' || rel.startsWith('..') || rel.startsWith(`..${sep}`)) return undefined;
  return toPosix(rel);
}

export function toPosix(path: string): string {
  return path.split(sep).join('/');
}

export interface ListFilesOptions {
  /**
   * Lists tracked and untracked-but-not-ignored files, or returns `null` when
   * the root is not a git working tree. Injectable so tests can pin either path.
   */
  gitFiles?: (root: string) => string[] | null;
}

/**
 * Every indexable file under `root`. Git does the ignore-file interpretation
 * when it can — that is one process instead of a bespoke `.gitignore` parser —
 * and a plain directory walk covers the non-repository case.
 */
export function listFiles(root: string, options: ListFilesOptions = {}): string[] {
  const list = options.gitFiles ?? gitFiles;
  const candidates = list(root) ?? walk(root);
  return candidates.filter(isIndexable).sort();
}

function gitFiles(root: string): string[] | null {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return output.split('\0').filter((line) => line.length > 0);
  } catch {
    return null;
  }
}

function walk(root: string): string[] {
  const found: string[] = [];

  const visit = (directory: string): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        const rel = toRelative(root, absolute);
        if (rel !== undefined) found.push(rel);
      }
    }
  };

  visit(resolve(root));
  return found;
}
