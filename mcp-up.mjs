#!/usr/bin/env node
// Builds and runs every MCP server in mcp/.
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
import { createStatusWriter, runTurboBuild } from './scripts/run-turbo-build.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const interactive = process.stderr.isTTY === true;
const status = createStatusWriter();

const HOST = '127.0.0.1';
const BASE_PORT = 7411;
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_INTERVAL_MS = 200;

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

function label(server) {
  return interactive ? `\u001b[2m[${server.id}]\u001b[0m` : `[${server.id}]`;
}

/** Builds the given packages with Turbo, staying silent unless it fails. */
async function build(servers) {
  const code = await runTurboBuild(root, {
    filters: servers.map((server) => `${server.package}...`),
    label: 'mcp-up',
  });
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

function isChildAlive(state) {
  const child = state.child;
  return Boolean(child && child.exitCode === null && child.signalCode === null);
}

/**
 * Spawns one server. Unexpected exits set `failed` so startup can fail cleanly;
 * `onUnexpectedExit` is for long-lived mode (stop siblings, then exit).
 */
function startServer(server, onUnexpectedExit) {
  const child = spawnServer(server);
  const state = { server, child, stopped: false, failed: false };
  child.on('exit', (code, signal) => {
    if (state.stopped) return;
    state.failed = true;
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    process.stderr.write(`${label(server)} exited (${reason})\n`);
    onUnexpectedExit?.(state);
  });
  return state;
}

async function stopAll(states) {
  await Promise.all(
    states.map(
      (state) =>
        new Promise((done) => {
          state.stopped = true;
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
    if (state.failed || !isChildAlive(state)) return { ok: false, detail: 'failed to start' };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        const detail = await response.json();
        // Port may already be owned by something else; our child then dies on bind.
        if (state.failed || !isChildAlive(state)) {
          return { ok: false, detail: 'failed to start' };
        }
        if (detail?.status === 'ok') return { ok: true, detail };
      }
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) return { ok: false, detail: 'timed out waiting for /health' };
    await new Promise((resume) => setTimeout(resume, HEALTH_INTERVAL_MS));
  }
}

/** One real MCP exchange, so --check proves the protocol works and not just the port. */
async function listTools(server) {
  const response = await fetch(`http://${HOST}:${server.port}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'mcp-up', version: '1.0.0' },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`initialize returned ${response.status}`);

  const tools = await fetch(`http://${HOST}:${server.port}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = parseRpc(await tools.text());
  const names = payload?.result?.tools?.map((tool) => tool.name) ?? [];
  if (names.length === 0) throw new Error('tools/list returned no tools');
  return names;
}

/** Reads a JSON-RPC reply from either a JSON body or a single SSE frame. */
function parseRpc(body) {
  const line = body
    .split('\n')
    .map((entry) => (entry.startsWith('data: ') ? entry.slice(6) : entry))
    .find((entry) => entry.trim().startsWith('{'));
  return line ? JSON.parse(line) : null;
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
  let live = false;
  let exiting = false;
  const onUnexpectedExit = () => {
    // During startup, waitForHealth/main see `failed` and stopAll themselves.
    if (!live || exiting) return;
    exiting = true;
    void stopAll(states).then(() => process.exit(1));
  };
  for (const server of servers) states.push(startServer(server, onUnexpectedExit));

  const shutdown = () => {
    if (exiting) return;
    exiting = true;
    void stopAll(states).then(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  status('waiting for servers…');
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  const results = [];
  for (const state of states) {
    const health = await waitForHealth(state, deadline);
    let tools = [];
    let detail = health.ok ? 'ready' : String(health.detail);

    if (health.ok && !state.failed) {
      try {
        tools = await listTools(state.server);
      } catch (error) {
        detail = `unhealthy: ${error.message}`;
      }
    }
    if (state.failed) detail = 'failed to start';

    results.push({
      id: state.server.id,
      port: state.server.port,
      url: `http://${HOST}:${state.server.port}/mcp`,
      ok: health.ok && !state.failed && tools.length > 0,
      status: detail,
      tools,
      index: health.ok && !state.failed ? health.detail?.index : undefined,
    });
  }
  status('');

  const healthy = results.filter((result) => result.ok);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ servers: results }, null, 2)}\n`);
  } else {
    printTable(
      results.map((result) => [
        result.id,
        result.port,
        result.url,
        result.ok ? `${result.status} — ${result.tools.length} tools` : result.status,
      ]),
    );
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

  live = true;
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
