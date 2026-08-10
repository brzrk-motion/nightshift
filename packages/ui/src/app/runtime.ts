import { NightshiftError } from '@nightshift/core';

/**
 * OpenTUI draws through a native Zig library reached over FFI. Importing it is
 * always safe, but *creating a renderer* is not: it needs a runtime with FFI
 * turned on. Checking for that up front is the difference between a clear
 * message and a stack trace out of a vendored chunk file.
 */
export interface RuntimeSupport {
  runtime: 'bun' | 'node' | 'unknown';
  version: string;
  /** Whether a native renderer can be created here. */
  ffi: boolean;
  /** Why it cannot, when it cannot. */
  reason?: string;
  hint?: string;
}

/** The first Node release whose FFI is new enough for OpenTUI. */
export const MIN_NODE_FFI = { major: 26, minor: 4 } as const;

const RUN_TUI = 'NODE_OPTIONS=--experimental-ffi nightshift';

function nodeSupport(version: string): RuntimeSupport {
  const [major = 0, minor = 0] = version.split('.').map((part) => Number.parseInt(part, 10));
  const base = { runtime: 'node', version } as const;

  if (major < MIN_NODE_FFI.major || (major === MIN_NODE_FFI.major && minor < MIN_NODE_FFI.minor)) {
    return {
      ...base,
      ffi: false,
      reason: `Node ${version} cannot load OpenTUI's native renderer.`,
      hint: `The dashboard needs Node ${MIN_NODE_FFI.major}.${MIN_NODE_FFI.minor} or newer, or Bun. Everything else works on Node 22+.`,
    };
  }

  // `node:ffi` only exists when the flag is on, which makes it a reliable
  // probe — and a cheap one, since it never actually loads the module.
  const enabled = (() => {
    try {
      return process.getBuiltinModule?.('node:ffi') !== undefined;
    } catch {
      return false;
    }
  })();

  return enabled
    ? { ...base, ffi: true }
    : {
        ...base,
        ffi: false,
        reason: 'Node was started without --experimental-ffi.',
        hint: `Start it as \`${RUN_TUI}\`. Every other command works without the flag.`,
      };
}

export function detectRuntime(): RuntimeSupport {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
    const bun = (globalThis as { Bun?: { version?: string } }).Bun;
    return { runtime: 'bun', version: bun?.version ?? 'unknown', ffi: true };
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    return nodeSupport(process.versions.node);
  }

  return {
    runtime: 'unknown',
    version: 'unknown',
    ffi: false,
    reason: 'Nightshift does not recognise this JavaScript runtime.',
    hint: 'Run it on Node 26.4 or newer, or on Bun.',
  };
}

/** Throws a Nightshift error when the terminal UI cannot start here. */
export function assertRenderable(support: RuntimeSupport = detectRuntime()): void {
  if (support.ffi) return;
  throw new NightshiftError(
    'RUNTIME_UNSUPPORTED',
    support.reason ?? 'The terminal renderer is not available in this runtime.',
    support.hint === undefined ? {} : { hint: support.hint },
  );
}
