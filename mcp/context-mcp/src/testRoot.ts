import { join, relative, resolve } from 'node:path';

import { toPosix } from './files.js';

/** Fake repo root that resolves correctly on every platform (`C:\\repo` on Windows). */
export const TEST_ROOT = resolve('/repo');

export function testAbsPath(file: string): string {
  return join(TEST_ROOT, file);
}

/** Maps an absolute path under {@link TEST_ROOT} back to a POSIX repo-relative path. */
export function testRelPath(absolute: string): string {
  const rel = relative(TEST_ROOT, absolute);
  if (rel === '' || rel.startsWith('..')) return absolute;
  return toPosix(rel);
}
