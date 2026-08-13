#!/usr/bin/env node
// The Nightshift context MCP server.
//
//   nightshift-context-mcp                     # stdio, for an MCP client to spawn
//   nightshift-context-mcp --http --port 7411  # long-lived HTTP daemon (mcp-up)
//   nightshift-context-mcp --root /path/to/repo

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

import {
  createMcpHandler,
  localhostAllowedOrigins,
  validateOriginHeader,
} from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { localhostHostValidation, toNodeHandler } from '@modelcontextprotocol/node';

import { createExtractor } from './extract.js';
import { type QueryContext } from './query.js';
import { createContextServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { createCodeIndex } from './store.js';
import { watchIndex } from './watcher.js';

const USAGE = `${SERVER_NAME} ${SERVER_VERSION}

Usage: nightshift-context-mcp [options]

  --root <path>   Repository to index (default: the git root above the cwd)
  --http          Serve streamable HTTP instead of stdio
  --port <n>      HTTP port (default: 7411)
  --host <host>   HTTP host (default: 127.0.0.1)
  --no-watch      Index once and do not follow file changes
  --quiet         Suppress info-level log output on stderr
  --help          Show this message
`;

interface Options {
  root: string;
  http: boolean;
  port: number;
  host: string;
  watch: boolean;
  quiet: boolean;
}

export function parseArgs(argv: readonly string[]): Options | 'help' {
  const options: Options = {
    root: '',
    http: false,
    port: 7411,
    host: '127.0.0.1',
    watch: true,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => argv[(index += 1)] ?? '';
    switch (arg) {
      case '--help':
      case '-h':
        return 'help';
      case '--root':
        options.root = next();
        break;
      case '--http':
        options.http = true;
        break;
      case '--port':
        options.port = Number.parseInt(next(), 10);
        break;
      case '--host':
        options.host = next();
        break;
      case '--no-watch':
        options.watch = false;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      default:
        // Unknown flags are ignored, matching the rest of Nightshift's config handling.
        break;
    }
  }

  if (!Number.isInteger(options.port) || options.port <= 0) options.port = 7411;
  return options;
}

/** The git root above `from`, or `from` itself when it is not a working tree. */
export function repositoryRoot(from: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: from,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return resolve(from);
  }
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }

  const root = parsed.root === '' ? repositoryRoot(process.cwd()) : resolve(parsed.root);

  // Stderr only — under stdio transport stdout carries JSON-RPC frames.
  const logInfo = (message: string): void => {
    if (parsed.quiet) return;
    process.stderr.write(`${new Date().toISOString()} info ${SERVER_NAME}: ${message}\n`);
  };
  const logWarn = (message: string): void => {
    process.stderr.write(`${new Date().toISOString()} warn ${SERVER_NAME}: ${message}\n`);
  };

  const index = createCodeIndex({ root, extractor: await createExtractor() });
  const context: QueryContext = {
    index,
    readSource: (file) => readFile(resolve(root, file), 'utf8'),
  };

  const started = Date.now();
  const summary = await index.reindexAll();
  logInfo(
    `indexed ${summary.indexed} files (${index.stats().symbols} symbols, ${summary.failed} failed) ` +
      `in ${Date.now() - started}ms from ${root}`,
  );

  const watcher = parsed.watch
    ? watchIndex({
        index,
        onError: (error) => logWarn(`watch: ${error.message}`),
        onFlush: (files) => logInfo(`reindexed ${files.length} changed file(s)`),
      })
    : undefined;

  const stop = async (): Promise<void> => {
    watcher?.close();
  };

  if (!parsed.http) {
    const handle = serveStdio(() => createContextServer(context), {
      onerror: (error) => logWarn(`stdio: ${error.message}`),
    });
    logInfo('serving on stdio');
    await onSignal();
    await handle.close();
    await stop();
    return 0;
  }

  const handler = createMcpHandler(() => createContextServer(context), {
    onerror: (error) => logWarn(`http: ${error.message}`),
  });
  const respond = toNodeHandler(handler, {
    onerror: (error) => logWarn(`http: ${error.message}`),
  });
  const validateHost = localhostHostValidation();

  /** Desktop MCP clients (Cursor, VS Code) send non-http Origin values. */
  function isAllowedOrigin(origin: string | undefined): boolean {
    if (origin === undefined) return true;
    if (
      origin === 'null' ||
      origin.startsWith('vscode-file://') ||
      origin.startsWith('cursor://')
    ) {
      return true;
    }
    return validateOriginHeader(origin, localhostAllowedOrigins()).ok;
  }

  const server = createServer((request, response) => {
    if (!validateHost(request, response)) return;
    if (!isAllowedOrigin(request.headers.origin)) {
      response.writeHead(403, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32_000, message: 'Origin not allowed' },
          id: null,
        }),
      );
      return;
    }

    const url = new URL(request.url ?? '/', `http://${parsed.host}:${parsed.port}`);
    if (url.pathname === '/health') {
      const body = JSON.stringify({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        status: 'ok',
        index: index.stats(),
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(body);
      return;
    }

    if (url.pathname !== '/mcp') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Not found. The MCP endpoint is /mcp.' }));
      return;
    }

    // Node types `method` and `url` as optional (they are only unset on the
    // client side); the adapter's duck type requires both. Restating the values
    // it already has narrows the type without a cast.
    void respond(
      Object.assign(request, { method: request.method ?? 'POST', url: request.url ?? '/mcp' }),
      response,
    );
  });

  await new Promise<void>((ready, fail) => {
    server.once('error', fail);
    server.listen(parsed.port, parsed.host, ready);
  });
  logInfo(`serving on http://${parsed.host}:${parsed.port}/mcp`);

  await onSignal();
  await new Promise<void>((closed) => server.close(() => closed()));
  await handler.close();
  await stop();
  return 0;
}

function onSignal(): Promise<void> {
  return new Promise((done) => {
    const finish = (): void => {
      process.off('SIGINT', finish);
      process.off('SIGTERM', finish);
      done();
    };
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
  });
}

process.exitCode = await main();
