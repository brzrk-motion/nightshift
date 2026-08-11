import { describe, expect, it } from 'vitest';

import { isIndexable, listFiles, toPosix, toRelative } from './files.js';

describe('isIndexable', () => {
  it('accepts the supported extensions', () => {
    for (const file of ['a.ts', 'a.mts', 'a.cts', 'a.tsx', 'a.js', 'a.mjs', 'a.cjs', 'a.jsx']) {
      expect(isIndexable(file)).toBe(true);
    }
  });

  it('rejects unsupported extensions and ignored directories', () => {
    expect(isIndexable('README.md')).toBe(false);
    expect(isIndexable('a.py')).toBe(false);
    expect(isIndexable('packages/core/dist/index.js')).toBe(false);
    expect(isIndexable('node_modules/x/index.js')).toBe(false);
  });
});

describe('toRelative', () => {
  it('normalises paths inside the root and refuses paths outside it', () => {
    expect(toRelative('/repo', '/repo/src/a.ts')).toBe('src/a.ts');
    expect(toRelative('/repo', 'src/a.ts')).toBe('src/a.ts');
    expect(toRelative('/repo', '/repo')).toBeUndefined();
    expect(toRelative('/repo', '/elsewhere/a.ts')).toBeUndefined();
  });
});

describe('listFiles', () => {
  it('filters and sorts what git reports', () => {
    const files = listFiles('/repo', {
      gitFiles: () => ['src/b.ts', 'README.md', 'src/a.tsx', 'dist/a.js'],
    });

    expect(files).toEqual(['src/a.tsx', 'src/b.ts']);
  });

  it('walks the directory when the root is not a git working tree', () => {
    // This package's own source is the fixture: real files, fixed contents.
    const files = listFiles(toPosix(new URL('..', import.meta.url).pathname), {
      gitFiles: () => null,
    });

    expect(files).toContain('src/files.ts');
    expect(files.some((file) => file.startsWith('node_modules/'))).toBe(false);
  });
});
