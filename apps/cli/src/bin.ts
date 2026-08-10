#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { detectRuntime, MIN_NODE_FFI } from '@nightshift/ui';
import { run } from './program.js';

/**
 * Nightshift draws through OpenTUI's native renderer, which needs Node's FFI —
 * and FFI is behind a flag that a shebang cannot set. Rather than telling
 * people to remember `--experimental-ffi`, a Node new enough to support it
 * re-launches itself once with the flag on.
 *
 * The guard variable makes that at most one hop, so a runtime that refuses the
 * flag for some other reason falls through to the normal path and its own
 * error message instead of forking forever.
 */
const GUARD = 'NIGHTSHIFT_FFI_REEXEC';

function shouldReexec(): boolean {
  if (process.env[GUARD] === '1') return false;
  const support = detectRuntime();
  if (support.runtime !== 'node' || support.ffi) return false;

  const [major = 0, minor = 0] = support.version
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  return (
    major > MIN_NODE_FFI.major || (major === MIN_NODE_FFI.major && minor >= MIN_NODE_FFI.minor)
  );
}

function reexec(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        '--experimental-ffi',
        // The flag is an implementation detail; its warning is not the user's
        // to act on.
        '--disable-warning=ExperimentalWarning',
        ...process.execArgv,
        ...process.argv.slice(1),
      ],
      {
        stdio: 'inherit',
        env: { ...process.env, [GUARD]: '1' },
      },
    );

    // The child owns the terminal, so signals have to reach it rather than
    // being handled here.
    const forward = (signal: NodeJS.Signals): void => void child.kill(signal);
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);

    child.on('error', () => resolve(1));
    child.on('close', (code, signal) => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      resolve(signal ? 128 + (signal === 'SIGINT' ? 2 : 15) : (code ?? 0));
    });
  });
}

process.exitCode = shouldReexec() ? await reexec() : await run(process.argv);
