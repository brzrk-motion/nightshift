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

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, 'apps', 'cli', 'dist', 'bin.js');
const windows = process.platform === 'win32';
const interactive = process.stderr.isTTY === true;

/**
 * Runs a command to completion. With `capture`, stdout and stderr are buffered
 * and returned instead of being shown; otherwise the child inherits the
 * terminal, which is what the CLI itself needs.
 */
function exec(command, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      // Spawning a .cmd shim on Windows requires a shell.
      shell: windows,
    });

    let output = '';
    if (capture) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));
    }

    const forward = (signal) => child.kill(signal);
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);

    child.on('error', reject);
    child.on('close', (code, signal) => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      resolve({
        // Match the shell convention so Ctrl-C reports as 130.
        code: signal ? 128 + (signal === 'SIGINT' ? 2 : 15) : (code ?? 0),
        output,
      });
    });
  });
}

/** A transient status line, on an interactive terminal only. */
function status(text) {
  if (!interactive) return;
  process.stderr.write(text ? `\u001b[2m${text}\u001b[0m` : '\r\u001b[2K');
}

async function build() {
  const turbo = join(root, 'node_modules', '.bin', windows ? 'turbo.cmd' : 'turbo');
  if (!existsSync(turbo)) {
    process.stderr.write('nightshift: dependencies are missing. Run `pnpm install` first.\n');
    return 1;
  }

  status('building…');
  // `@nightshift/cli...` means the CLI plus everything it depends on.
  const { code, output } = await exec(
    turbo,
    ['run', 'build', '--filter=@nightshift/cli...', '--output-logs=errors-only'],
    { capture: true },
  );
  status('');

  if (code !== 0) {
    process.stderr.write(output);
    process.stderr.write('\nnightshift: build failed; not starting.\n');
  }
  return code;
}

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
    const code = await build();
    if (code !== 0) return code;
  }

  const { code } = await exec(process.execPath, [entry, ...argv]);
  return code;
}

process.exitCode = await main();
