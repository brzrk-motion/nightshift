#!/usr/bin/env node
// Builds and runs every MCP server in mcp/, then supervises them.
//
//   pnpm mcp:up                      # build, launch, print the endpoint table
//   pnpm mcp:up --check              # build, verify each server answers, exit
//   pnpm mcp:up --write-cursor-config
//   pnpm mcp:up --only context --no-build
//
// A server is anything under mcp/ whose package.json carries an "mcp" block:
//
//   "mcp": { "id": "context", "port": 7411 }
//
// and a "bin" entry pointing at its built entry point. Each is started with
// --http so one long-lived process can serve many clients; the same binaries
// also speak stdio, which is what an editor spawning them directly will use.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const interactive = process.stderr.isTTY === true;

const HOST = '127.0.0.1';
const BASE_PORT = 7411;
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_INTERVAL_MS = 200;
/** A child that dies this soon after starting is treated as a failure to start. */
const CRASH_WINDOW_MS = 5_000;
const MAX_RESTARTS = 3;

const MIN_NODE_MAJOR = 22;

const USAGE = `Usage: pnpm mcp:up [options]

  --check                Verify every server starts and answers, then exit
  --only <id>            Run just one server (repeatable)
  --no-build             Skip the build; use whatever is in dist/
  --write-cursor-config  Write .cursor/mcp.json from the endpoints, then exit
  --json                 Print the endpoint table as JSON
  --help                 Show this message
`;

function parseArgs(argv) {
  const options = { check: false, build: true, only: [], writeCursorConfig: false, json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--help':
      case '-h':
        return 'help';
      case '--check':
        options.check = true;
        break;
      case '--no-build':
        options.build = false;
        break;
      case '--only':
        options.only.push(argv[(index += 1)] ?? '');
        break;
      case '--write-cursor-config':
        options.writeCursorConfig = true;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        process.stderr.write(`mcp-up: unknown option ${arg}\n\n${USAGE}`);
        return null;
    }
  }

  return options;
}

/** Every MCP server declared under mcp/, in a stable order. */
function discover() {
  const directory = join(root, 'mcp');
  if (!existsSync(directory)) return [];

  const servers = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = join(directory, entry.name, 'package.json');
    if (!existsSync(manifestPath)) continue;

    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      process.stderr.write(
        `mcp-up: ${entry.name}/package.json is not valid JSON: ${error.message}\n`,
      );
      continue;
    }
    if (!manifest.mcp) continue;

    const bin =
      typeof manifest.bin === 'string' ? manifest.bin : Object.values(manifest.bin ?? {})[0];
    if (!bin) {
      process.stderr.write(
        `mcp-up: ${manifest.name} declares "mcp" but has no "bin" entry; skipping.\n`,
      );
      continue;
    }

    servers.push({
      id: manifest.mcp.id ?? entry.name,
      package: manifest.name,
      port: Number(manifest.mcp.port) || BASE_PORT + servers.length,
      entry: join(directory, entry.name, bin),
    });
  }

  return servers.sort((a, b) => a.id.localeCompare(b.id));
}

function status(text) {
  if (!interactive) return;
  process.stderr.write(text ? `\u001b[2m${text}\u001b[0m\r` : '\r\u001b[2K');
}

function label(server) {
  return interactive ? `\u001b[2m[${server.id}]\u001b[0m` : `[${server.id}]`;
}

/** Builds the given packages with Turbo, staying silent unless it fails. */
async function build(servers) {
  // Bypass `.bin/turbo(.cmd)` — invoke the JS entry with this node so Windows
  // never needs a shell (and never splits `C:\Program Files\...`).
  const turbo = join(root, 'node_modules', 'turbo', 'bin', 'turbo');
  if (!existsSync(turbo)) {
    process.stderr.write('mcp-up: dependencies are missing. Run `pnpm install` first.\n');
    return false;
  }

  status('building…');
  const filters = servers.flatMap((server) => ['--filter', `${server.package}...`]);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [turbo, 'run', 'build', ...filters, '--output-logs=errors-only'],
      {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (exit) => {
      if (exit !== 0) process.stderr.write(output);
      resolve(exit ?? 0);
    });
  });
  status('');

  if (code !== 0) process.stderr.write('mcp-up: build failed; not starting.\n');
  return code === 0;
}

/** Forwards a child's output line by line, tagged with the server id. */
function forward(server, stream, target) {
  stream.setEncoding('utf8');
  let buffered = '';
  stream.on('data', (chunk) => {
    buffered += chunk;
    let newline = buffered.indexOf('\n');
    while (newline !== -1) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.trim() !== '') target.write(`${label(server)} ${line}\n`);
      newline = buffered.indexOf('\n');
    }
  });
}

function spawnServer(server) {
  const child = spawn(
    process.execPath,
    [server.entry, '--http', '--port', String(server.port), '--host', HOST, '--root', root],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  forward(server, child.stdout, process.stderr);
  forward(server, child.stderr, process.stderr);
  return child;
}

/** True when something is already serving /health on this port. */
async function probeExisting(server) {
  try {
    const response = await fetch(`http://${HOST}:${server.port}/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.status === 'ok' ? body : null;
  } catch {
    return null;
  }
}

/**
 * Starts a child unless the port is already occupied by a healthy server.
 * Returns `{ external: true }` when reusing an existing listener.
 */
async function startServer(server) {
  const existing = await probeExisting(server);
  if (existing) {
    process.stderr.write(`${label(server)} already listening on port ${server.port}; reusing it\n`);
    return { server, child: null, restarts: 0, stopped: false, failed: false, external: true };
  }
  return supervise(server);
}

/**
 * Keeps one server running. A crash is restarted with a short backoff until it
 * has failed to stay up MAX_RESTARTS times, so a broken server reports itself
 * instead of spinning forever.
 */
function supervise(server) {
  const state = { server, child: null, restarts: 0, stopped: false, failed: false };

  const start = () => {
    const startedAt = Date.now();
    state.child = spawnServer(server);
    state.child.on('exit', (code, signal) => {
      if (state.stopped) return;
      const lived = Date.now() - startedAt;
      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      if (lived < CRASH_WINDOW_MS) state.restarts += 1;
      else state.restarts = 0;

      if (state.restarts > MAX_RESTARTS) {
        state.failed = true;
        process.stderr.write(
          `${label(server)} gave up after ${MAX_RESTARTS} restarts (${reason})\n`,
        );
        return;
      }
      process.stderr.write(`${label(server)} exited (${reason}); restarting\n`);
      setTimeout(start, 250 * state.restarts).unref?.();
    });
  };

  start();
  return state;
}

async function stopAll(states) {
  await Promise.all(
    states.map(
      (state) =>
        new Promise((done) => {
          state.stopped = true;
          if (state.external) return done();
          const child = state.child;
          if (!child || child.exitCode !== null || child.signalCode !== null) return done();
          const force = setTimeout(() => child.kill('SIGKILL'), 3_000);
          child.once('exit', () => {
            clearTimeout(force);
            done();
          });
          child.kill('SIGTERM');
        }),
    ),
  );
}

async function waitForHealth(state, deadline) {
  const url = `http://${HOST}:${state.server.port}/health`;
  for (;;) {
    if (state.failed) return { ok: false, detail: 'failed to start' };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return { ok: true, detail: await response.json() };
    } catch {
      // Not listening yet — unless we spawned into a port something else owns.
      if (state.child && !state.external) {
        const existing = await probeExisting(state.server);
        if (existing) {
          process.stderr.write(
            `${label(state.server)} port ${state.server.port} is in use; reusing the listener already there\n`,
          );
          state.external = true;
          state.child?.kill('SIGTERM');
          state.child = null;
          return { ok: true, detail: existing };
        }
      }
    }
    if (Date.now() > deadline) return { ok: false, detail: 'timed out waiting for /health' };
    await new Promise((resume) => setTimeout(resume, HEALTH_INTERVAL_MS));
  }
}

function printTable(rows) {
  const widths = ['SERVER', 'PORT', 'ENDPOINT', 'STATUS'].map((header, column) =>
    Math.max(header.length, ...rows.map((row) => String(row[column]).length)),
  );
  const line = (cells) =>
    cells
      .map((cell, column) => String(cell).padEnd(widths[column]))
      .join('  ')
      .trimEnd();

  process.stderr.write(`\n${line(['SERVER', 'PORT', 'ENDPOINT', 'STATUS'])}\n`);
  for (const row of rows) process.stderr.write(`${line(row)}\n`);
  process.stderr.write('\n');
}

/** Merges the running endpoints into .cursor/mcp.json, leaving other servers alone. */
function writeCursorConfig(servers) {
  const directory = join(root, '.cursor');
  const file = join(directory, 'mcp.json');

  let config = {};
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      process.stderr.write(
        `mcp-up: .cursor/mcp.json is not valid JSON (${error.message}); leaving it alone.\n`,
      );
      return;
    }
  }

  config.mcpServers ??= {};
  for (const server of servers) {
    config.mcpServers[`nightshift-${server.id}`] = { url: `http://${HOST}:${server.port}/mcp` };
  }

  mkdirSync(directory, { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  process.stderr.write(`mcp-up: wrote ${servers.length} endpoint(s) to .cursor/mcp.json\n`);
}

function checkNode() {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (major >= MIN_NODE_MAJOR) return true;
  process.stderr.write(
    `mcp-up: Node ${MIN_NODE_MAJOR}+ required (found v${process.versions.node}).\n`,
  );
  return false;
}

async function main() {
  if (!checkNode()) return 1;

  const options = parseArgs(process.argv.slice(2));
  if (options === null) return 1;
  if (options === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }

  let servers = discover();
  if (options.only.length > 0) {
    servers = servers.filter((server) => options.only.includes(server.id));
  }
  if (servers.length === 0) {
    process.stderr.write('mcp-up: no MCP servers found under mcp/.\n');
    return 1;
  }

  if (options.build && !(await build(servers))) return 1;

  const missing = servers.filter((server) => !existsSync(server.entry));
  if (missing.length > 0) {
    process.stderr.write(
      `mcp-up: not built yet: ${missing.map((server) => server.id).join(', ')}. ` +
        'Run without --no-build.\n',
    );
    return 1;
  }

  const states = [];
  for (const server of servers) states.push(await startServer(server));
  const shutdown = () => {
    void stopAll(states).then(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  status('waiting for servers…');
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  const results = [];
  for (const state of states) {
    const health = await waitForHealth(state, deadline);

    results.push({
      id: state.server.id,
      port: state.server.port,
      url: `http://${HOST}:${state.server.port}/mcp`,
      ok: health.ok,
      status: health.ok ? 'ready' : String(health.detail),
      index: health.ok ? health.detail?.index : undefined,
    });
  }
  status('');

  const healthy = results.filter((result) => result.ok);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ servers: results }, null, 2)}\n`);
  } else {
    printTable(results.map((result) => [result.id, result.port, result.url, result.status]));
  }

  if (options.writeCursorConfig && healthy.length > 0) {
    writeCursorConfig(servers.filter((server) => healthy.some((row) => row.id === server.id)));
  }

  const exitAfter = options.check || options.writeCursorConfig;
  if (exitAfter) {
    await stopAll(states);
    return healthy.length === results.length ? 0 : 1;
  }

  if (healthy.length !== results.length) {
    await stopAll(states);
    return 1;
  }

  process.stderr.write('mcp-up: running. Press Ctrl-C to stop.\n');
  await new Promise(() => {});
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`mcp-up: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
