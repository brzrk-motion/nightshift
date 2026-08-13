# @nightshift/context-mcp

An MCP server that indexes a repository with [tree-sitter](https://tree-sitter.github.io/)
and answers precise questions about it, so an agent can ask for the definition
it needs instead of reading whole files to find it.

The index is built once at startup and then kept current: every write to a
supported file reparses that file and nothing else.

## Running it

```bash
pnpm mcp:up                      # from the repository root: build + run every MCP server
node dist/bin.js                 # stdio, for a client that spawns the server itself
node dist/bin.js --http --port 7411
```

| Option          | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| `--root <path>` | Repository to index. Defaults to the git root above `cwd`. |
| `--http`        | Serve streamable HTTP instead of stdio.                    |
| `--port <n>`    | HTTP port. Defaults to `7411`.                             |
| `--host <host>` | HTTP host. Defaults to `127.0.0.1`.                        |
| `--no-watch`    | Index once; do not follow file changes.                    |
| `--quiet`       | Suppress the stderr log.                                   |

Under `--http` the MCP endpoint is `/mcp` and `GET /health` returns the current
index statistics — that is what `mcp-up` polls. Logs always go to stderr,
because under stdio stdout carries the JSON-RPC frames.

## Tools

| Tool              | Use it to                                                                      |
| ----------------- | ------------------------------------------------------------------------------ |
| `index_status`    | See the root, file and symbol counts, languages, and parse failures.           |
| `search_symbols`  | Locate definitions by name, kind, path glob or export, with signature and doc. |
| `get_symbol`      | Get the exact source of one definition, optionally with its doc and context.   |
| `file_outline`    | List every definition in a file, with no bodies.                               |
| `find_references` | Find every mention of an identifier, with the source line of each hit.         |
| `read_lines`      | Read an exact inclusive line range.                                            |
| `reindex`         | Force a refresh of one file or the whole tree.                                 |

`find_references` reads the syntax tree, so a name inside a comment or a string
is never reported — but it is identifier-level, not type-aware: two unrelated
members sharing a name both appear.

## What gets indexed

TypeScript, TSX and JavaScript (`.ts`, `.mts`, `.cts`, `.tsx`, `.js`, `.mjs`,
`.cjs`, `.jsx`). Grammars ship as WebAssembly via `tree-sitter-wasms`, so there
is no native build step.

File discovery runs `git ls-files --cached --others --exclude-standard`, which
means `.gitignore` is honoured for free; outside a git working tree it falls
back to a directory walk. `node_modules`, `dist`, `build`, `coverage`, `.turbo`,
`.next` and `.cache` are always skipped, and files over 512 KB are ignored.

A file that cannot be read or parsed is recorded as a failure and kept in the
index; it never stops the rest of it from being built.

## Layout

```
src/languages.ts  Extension → grammar, and grammar wasm resolution
src/queries.ts    The tree-sitter queries, inline so tsc alone produces a runnable dist/
src/extract.ts    Parse a source string into symbols and identifier references
src/files.ts      Which files to index
src/store.ts      The in-memory index, with size/mtime-based skipping
src/watcher.ts    Debounced incremental reindex on change
src/query.ts      The query surface — pure functions over the index
src/tools.ts      The MCP tools, as data (schema + handler)
src/server.ts     Registers the tools on an McpServer
src/bin.ts        The executable: stdio or HTTP
```

The watcher only reacts to files it can index. After a bulk change such as a
branch switch, call `reindex` with no arguments.
