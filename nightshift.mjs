#!/usr/bin/env node
// Builds the CLI and everything it depends on, then starts it.
//
//   ./nightshift.mjs doctor
//   pnpm start doctor
//   pnpm start --no-build vibe --list   # skip the build when nothing changed
//
// A successful build stays silent — its output is buffered and only printed if
// it fails — so the CLI starts on a clean terminal and `--json` output on
// stdout stays pipeable.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTurboBuild, spawnCommand } from './scripts/run-turbo-build.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, 'apps', 'cli', 'dist', 'bin.js');

async function main() {
  const argv = process.argv.slice(2);

  // Consume the wrapper's own flag; everything else belongs to the CLI.
  const skipIndex = argv.indexOf('--no-build');
  const skipBuild = skipIndex !== -1 || process.env['NIGHTSHIFT_SKIP_BUILD'] === '1';
  if (skipIndex !== -1) argv.splice(skipIndex, 1);

  if (skipBuild) {
    if (!existsSync(entry)) {
      process.stderr.write(
        'nightshift: --no-build was given but the CLI has not been built yet.\n' +
          'Run `pnpm start` once, or `pnpm build`.\n',
      );
      return 1;
    }
  } else {
    const code = await runTurboBuild(root, {
      filters: ['@nightshift/cli...'],
      label: 'nightshift',
    });
    if (code !== 0) return code;
  }

  const { code } = await spawnCommand(root, process.execPath, [entry, ...argv]);
  return code;
}

process.exitCode = await main();
