import { defineConfig } from 'vitest/config';

/**
 * OpenTUI's renderer needs Node's FFI, which is behind a flag and only exists
 * from 26.4. Passing the flag to the worker here means the renderer tests run
 * wherever they can, and skip themselves — see `detectRuntime()` — wherever
 * they cannot, rather than the whole suite failing to start.
 */
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
const ffi = major > 26 || (major === 26 && minor >= 4);

export default defineConfig({
  // The renderer tests are written in TSX, so esbuild needs the same JSX
  // settings tsc uses.
  esbuild: { jsx: 'automatic', jsxImportSource: '@opentui/react' },
  test: {
    include: ['**/src/**/*.test.ts', '**/src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    ...(ffi
      ? { pool: 'forks' as const, poolOptions: { forks: { execArgv: ['--experimental-ffi'] } } }
      : {}),
  },
});
