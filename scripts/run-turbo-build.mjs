import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** A transient status line on an interactive terminal. */
export function createStatusWriter() {
  const interactive = process.stderr.isTTY === true;
  return function status(text) {
    if (!interactive) return;
    process.stderr.write(text ? `\u001b[2m${text}\u001b[0m\r` : '\r\u001b[2K');
  };
}

/**
 * Runs a command to completion. With `capture`, stdout and stderr are buffered
 * and returned instead of being shown; otherwise the child inherits the
 * terminal.
 */
export function spawnCommand(root, command, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      // Never shell:true — Node concatenates args unescaped (DEP0190) and
      // breaks when node lives under "C:\Program Files\...".
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

/**
 * Builds the given packages with Turbo, staying silent unless it fails.
 * `filters` are turbo `--filter` values (e.g. `@nightshift/cli...`).
 */
export async function runTurboBuild(root, { filters, label }) {
  // Bypass `.bin/turbo(.cmd)` — invoke the JS entry with this node so Windows
  // never needs a shell (and never splits `C:\Program Files\...`).
  const turbo = join(root, 'node_modules', 'turbo', 'bin', 'turbo');
  if (!existsSync(turbo)) {
    process.stderr.write(`${label}: dependencies are missing. Run \`pnpm install\` first.\n`);
    return 1;
  }

  const status = createStatusWriter();
  status('building…');

  const filterArgs = filters.flatMap((filter) => ['--filter', filter]);
  const { code, output } = await spawnCommand(
    root,
    process.execPath,
    [turbo, 'run', 'build', ...filterArgs, '--output-logs=errors-only'],
    { capture: true },
  );

  status('');

  if (code !== 0) {
    process.stderr.write(output);
    process.stderr.write(`\n${label}: build failed; not starting.\n`);
  }

  return code;
}
