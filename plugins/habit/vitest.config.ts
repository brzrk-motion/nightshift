import { defineConfig } from 'vitest/config';

/**
 * The widget tests drive the real OpenTUI renderer, which needs Node's FFI —
 * see packages/ui/vitest.config.ts for why this is gated the way it is.
 */
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
const ffi = major > 26 || (major === 26 && minor >= 4);

export default defineConfig({
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
