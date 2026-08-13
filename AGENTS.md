# AGENTS.md

Guidance for coding agents (and humans) contributing to Nightshift. Read this
before making changes — it explains how the pieces fit together so you don't
have to reverse-engineer the architecture from the diff.

For product-level behavior (commands, config format, dashboard/vibe YAML,
keybindings) see `README.md` — this file is about how the _code_ is put
together and how to extend it correctly.

## What Nightshift is

A terminal-first, plugin-driven "workspace for deep focus," built on OpenTUI
(React rendered to the terminal). The design principles in `README.md` are
load-bearing, not aspirational — keep them in mind for every change:

- Everything is a plugin.
- Dashboards consume widgets.
- Vibes orchestrate actions.
- Entities provide shared state.
- Automations react to events.
- The public SDK (`@nightshift/sdk`) is the only plugin interface.
- Nightshift manages the environment around the work — not the work itself.

## Monorepo layout

pnpm workspaces + Turborepo. Workspace globs (`pnpm-workspace.yaml`):
`apps/*`, `mcp/*`, `packages/*`, `plugins/*`.

```
nightshift.mjs         Build-and-launch script for local development
mcp-up.sh/.mjs         Build-and-launch script for the MCP servers in mcp/
apps/cli               The nightshift command line interface (entry point)
packages/core          Runtime primitives: errors, versions, events, disposables
packages/entities      Shared observable state — the contract for plugin state
packages/sdk           The public interface plugins are written against
packages/ui            Application shell, component library and themes
packages/dashboard     Dashboard model, layout parser, widget registry, editor
packages/vibes         The vibe engine
packages/automations   Triggers, conditions and actions
packages/services      Config, logging, settings and the plugin runtime/host
mcp/context-mcp        Agent tooling: a tree-sitter code index served over MCP
plugins/clock          The time and date, with 12/24-hour and date format settings
plugins/focus          The focus timer — the reference plugin
plugins/habit          Rolling 7-day habit tracker
plugins/home-assistant Home Assistant scenes (list, activate, vibe bindings)
plugins/spotify        Spotify Connect control (playlists, podcasts, transport)
plugins/todo           A todo list backed by a plain todo.md file
plugins/weather        Current conditions + forecast via Open-Meteo
```

Every package is `@nightshift/<name>` (plugins are `@nightshift/plugin-<name>`),
ESM-only (`"type": "module"`), built with `tsc` to `dist/`, and depends on
sibling packages via `workspace:*`. **Dependency direction matters** — see the
diagram below. Don't add an import that runs against the grain of it (e.g.
`packages/entities` importing from `packages/ui`).

```
core ← entities ← automations ← sdk ← dashboard ─┐
  ↑        ↑           ↑          ↑               │
  └────────┴───────────┴── ui ────┴── services ───┴── cli
```

Concretely:

- `core` depends on nothing else in the repo.
- `entities` depends on `core`.
- `automations` depends on `core`, `entities`.
- `ui` depends on `core`, `entities`, `@opentui/*`, `react`.
- `sdk` depends on `core`, `entities`, `automations`, `ui` (re-exports pieces
  of all three — see below).
- `dashboard` depends on `sdk`, `automations`, `ui`, `entities`, `core`, `yaml`.
- `vibes` depends on `core`, `entities`, `yaml`.
- `services` depends on `core`, `entities`, `automations`, `sdk`.
- `apps/cli` depends on everything above, plus `commander`.
- `plugins/focus` and `plugins/todo` depend only on `@nightshift/sdk` at
  runtime (matching what a third-party plugin is allowed to depend on);
  `@nightshift/entities` and `@nightshift/ui` appear only as
  `devDependencies`, for types in tests. The same applies to `plugins/weather`
  and `plugins/clock` (which additionally declare the `network` capability
  and use `context.fetch` — weather to geocode+forecast, clock to geocode a
  location into a timezone when the machine's own can't be detected).

`mcp/*` sits outside that diagram on purpose. It is developer tooling for the
agents working on this repository, not part of the application: nothing in
`apps/` or `packages/` may import from it, its packages are `private: true` (so
Changesets and `release` skip them), and it is free to depend on whatever it
needs — `@modelcontextprotocol/*`, `web-tree-sitter` — without widening what a
plugin author is allowed to reach for. **`context-mcp`** is the one server
today — see [Agent tooling (MCP)](#agent-tooling-mcp) below
and `mcp/context-mcp/README.md` for flags and layout.

Two rules that are easy to break there: **an MCP server over stdio must never
write to stdout** (stdout is the JSON-RPC channel — log to stderr only, e.g. the
inline helpers in `mcp/context-mcp/src/bin.ts`), and `mcp-up` finds servers by scanning `mcp/*/package.json` for
an `mcp` block plus a `bin` entry, so a new server needs no launcher changes but
does need both fields.

## Toolchain and commands

- **pnpm 11+**, **Node 22+** (Node 26.4+ or Bun to actually open a dashboard —
  OpenTUI needs FFI). TypeScript, strict mode, `NodeNext` modules — see
  `tsconfig.base.json`. Every package extends it and sets `rootDir`/`outDir`.
- **Turborepo** drives the task graph (`turbo.json`): `build` depends on
  `^build` (dependencies build first, cached by content hash).
- **Vitest** per package (`vitest run --passWithNoTests`), co-located
  `*.test.ts(x)` files, not a separate `test/` tree.
- **ESLint** (flat config, `eslint.config.js`) + **Prettier**. Notably:
  `no-console` is an error everywhere _except_ `apps/cli/**` — the CLI is the
  one place allowed to talk to the terminal directly. Don't add `console.*`
  to a package; use the `PluginLogger`/`Logger` that's threaded through
  instead.
- **Changesets** for versioning — run `pnpm changeset` alongside any
  user-visible change (all `@nightshift/*` packages are version-locked
  together via the `fixed` group in `.changeset/config.json`).

Top-level scripts (run from repo root):

```bash
pnpm install
pnpm start [args]     # ./nightshift.mjs — builds @nightshift/cli and deps, then runs it
pnpm build            # turbo run build, dependency order, cached
pnpm test             # turbo run test
pnpm lint             # turbo run lint
pnpm typecheck        # turbo run typecheck (tsc --noEmit, tests included)
pnpm check            # format:check + lint + typecheck + test (pre-commit hook)
pnpm format           # prettier --write .
pnpm mcp:up [args]    # ./mcp-up.mjs — builds and runs the MCP servers (--check smoke-tests them)
```

`pnpm start` is what you want while iterating on the CLI or a bundled plugin —
it rebuilds only what changed and launches on a clean terminal (build output
is swallowed unless it fails). `pnpm --filter <pkg> test` / `build` /
`typecheck` scopes to one package when you don't need the whole graph.

### Before you commit

Do not commit until `pnpm check` is green. It runs Prettier (`format:check`),
ESLint, TypeScript (`typecheck`), and Vitest — the same gates CI uses. Husky
runs it as a pre-commit hook; a failing hook means the commit did not land.
Fix whatever failed and try again:

- Format: `pnpm format` (rewrites files), then re-run `pnpm check`
- Lint / typecheck / tests: fix the reported errors; do not skip or weaken
  the rules

`HUSKY=0 git commit` bypasses the hook and is not a substitute for a passing
check. Scoped `pnpm --filter <pkg> …` is fine while iterating; the commit
hook still runs the full graph.

## Agent tooling (MCP)

Four MCP servers are wired in `.cursor/mcp.json`. Use the right one for the
job — they answer different questions:

| Server               | Question it answers                                        | Auth                           |
| -------------------- | ---------------------------------------------------------- | ------------------------------ |
| `nightshift-context` | Where is X defined in _this repo_? Who references it?      | None (run `pnpm mcp:up` first) |
| `context7`           | How does library Y work? What's the current API for Z?     | Optional `CONTEXT7_API_KEY`    |
| `deepwiki`           | How is upstream repo Y structured? What does its wiki say? | None                           |
| `semgrep`            | Does this code have security issues?                       | None (core scanning)           |

**Decision guide:** Nightshift internals → `nightshift-context`. Dependency
APIs and examples → `context7`. Upstream repo architecture (OpenTUI, MCP SDK,
tree-sitter) → `deepwiki`. Security review of generated or changed code →
`semgrep`.

### `nightshift-context` — this repository

`mcp/context-mcp` (`@nightshift/context-mcp`) is a tree-sitter code index
served over MCP. **Use it before reading whole files or running broad greps**
when you need to find where something is defined, what a file exports, or who
references an identifier — it returns precise slices (signatures, doc comments,
line ranges) instead of dumping entire sources.

### Starting it

```bash
pnpm mcp:up              # build every mcp/* server and run them over HTTP
pnpm mcp:up --check      # smoke-test: build, start, poll /health, exit
```

`mcp-up` discovers servers from each `mcp/*/package.json` `mcp` block (context
uses port `7411`) and serves streamable HTTP at `http://127.0.0.1:7411/mcp`.
This repo's `.cursor/mcp.json` already points Cursor at that URL — start
`pnpm mcp:up` in a terminal before a long session so the tools are available.
Editors that spawn MCP servers directly can use stdio instead (see
`mcp/context-mcp/README.md`).

The index builds once at startup and stays current via a debounced file watcher.
After a bulk change such as a branch switch, call the `reindex` tool with no
arguments (or restart the server).

### Tools — when to use which

| Tool              | Reach for it when…                                                                  |
| ----------------- | ----------------------------------------------------------------------------------- |
| `index_status`    | A query returns nothing unexpected — check root, counts, languages, parse failures. |
| `search_symbols`  | You know a name/kind/path glob and want definitions without opening files.          |
| `get_symbol`      | You know what to fetch and want the exact source (optionally with doc/context).     |
| `file_outline`    | You need the shape of a file (all defs + signatures, no bodies) before diving in.   |
| `find_references` | You need every syntax-tree mention of an identifier (not comments/strings).         |
| `read_lines`      | Another tool gave you line numbers and you only need that inclusive range.          |
| `reindex`         | The watcher missed a bulk change, or a new file is not indexed yet.                 |

Suggested flow: `search_symbols` → `get_symbol` or `file_outline` → `read_lines`
for surrounding context → `find_references` when tracing call sites. Prefer
`search_symbols` over text search for "where is X defined?"; prefer `get_symbol`
over reading a whole file when you only need one definition.

`find_references` is identifier-level and not type-aware — unrelated members
sharing a name both appear. It never matches names inside comments or strings.

### What is indexed

TypeScript, TSX, and JavaScript (`.ts`, `.mts`, `.cts`, `.tsx`, `.js`, `.mjs`,
`.cjs`, `.jsx`). Discovery uses `git ls-files` (honours `.gitignore`); outside
a git tree it walks the directory. Always skipped: `node_modules`, `dist`,
`build`, `coverage`, `.turbo`, `.next`, `.cache`, and files over 512 KB. A file
that fails to parse is recorded and skipped — it never stops the rest of the
index from building (same failure philosophy as the plugin host).

Implementation layout and CLI flags (`--root`, `--no-watch`, `--quiet`, …) are
in `mcp/context-mcp/README.md`. When changing the server itself, keep logging on
stderr — stdout is the JSON-RPC channel under stdio.

### `context7` — library documentation

[Context7](https://context7.com) is a hosted MCP server that returns **current
documentation for third-party libraries** — React, OpenTUI, Vitest, Zod, the
MCP SDK, tree-sitter, and so on. **Use it whenever you need API details,
setup steps, or code examples for a dependency** instead of relying on training
data or grepping `node_modules`. Do not use it to navigate Nightshift's own
code; that is what `nightshift-context` is for.

It is already configured in `.cursor/mcp.json` (remote endpoint at
`https://mcp.context7.com/mcp`). An optional `CONTEXT7_API_KEY` in `.env`
(see `.env.example`) raises rate limits; the server works without a key.

Suggested flow:

1. **`resolve-library-id`** — pass the library name and your full question;
   pick the best match (prefer official packages and version-specific IDs when
   the user named a version).
2. **`query-docs`** — pass the chosen library ID and your specific question;
   use the returned docs and examples in your answer.

Reach for Context7 when writing or changing code that calls an external API
(`@opentui/*`, `@modelcontextprotocol/*`, `web-tree-sitter`, Commander, …),
when a version mismatch matters, or when you are unsure whether a pattern still
applies in the current release. Prefer Nightshift's own `AGENTS.md`, `README.md`,
and `nightshift-context` for how _this_ repo is structured.

### `deepwiki` — upstream repository docs

[DeepWiki](https://mcp.deepwiki.com) is a free hosted MCP server (no auth) at
`https://mcp.deepwiki.com/mcp` that answers questions about **public GitHub
repositories** — OpenTUI, the MCP SDK, tree-sitter, Vitest, and other
dependencies Nightshift builds on. Use it when you need architecture-level
context or a wiki-style overview of an upstream repo, especially before diving
into its source. It complements Context7: Context7 returns version-specific
API docs; DeepWiki returns repo-level structure and narrative docs. Do not use
it for Nightshift's own code.

Repository parameters use `owner/repo` form (e.g. `sst/opentui`,
`modelcontextprotocol/typescript-sdk`).

| Tool                  | Reach for it when…                                           |
| --------------------- | ------------------------------------------------------------ |
| `read_wiki_structure` | You want the table of contents / topic list for a repo.      |
| `read_wiki_contents`  | You know the topic and want the full wiki page.              |
| `ask_question`        | You have a natural-language question about how a repo works. |

Suggested flow: `read_wiki_structure` → `read_wiki_contents` or
`ask_question`. Prefer `ask_question` for exploratory questions; prefer
`read_wiki_contents` when you already know the topic name.

### `semgrep` — security scanning

[Semgrep](https://semgrep.dev) provides a hosted MCP server (no auth for core
scanning) at `https://mcp.semgrep.ai/mcp`. **Use it when reviewing changes that
touch security-sensitive surfaces** — plugin permissions, `context.fetch`,
storage, shell capability declarations, YAML/config parsing, or anything that
handles user-controlled input. The hosted endpoint is experimental; for
proprietary code you can run `uvx semgrep-mcp` locally instead.

| Tool                            | Reach for it when…                                                |
| ------------------------------- | ----------------------------------------------------------------- |
| `security_check`                | Quick scan of code snippets for common vulnerabilities.           |
| `semgrep_scan`                  | Scan with a specific Semgrep config or rule set.                  |
| `semgrep_scan_with_custom_rule` | You need a one-off rule for a pattern you are checking.           |
| `get_abstract_syntax_tree`      | You need the AST to reason about structure before scanning.       |
| `supported_languages`           | You want to confirm Semgrep covers the language you are scanning. |

Suggested flow: after generating or editing security-sensitive code, run
`security_check` on the diff or new snippets before considering the change
done. `semgrep_findings` (cloud dashboard results) requires a `SEMGREP_APP_TOKEN`
and is optional — not configured in this repo.

## The runtime contract (`@nightshift/core`, `@nightshift/entities`)

- `core` provides `NightshiftError` (typed error code + optional `cause`/
  `hint`), a monomorphic `EventBus<T>`, `Disposable`/`Unsubscribe` types and a
  disposable bag (`createDisposableBag`), and `NIGHTSHIFT_API_VERSION` — the
  SDK contract version plugins are checked against (`isCompatible` in the
  SDK, enforced by the plugin host).
- `entities` is the one piece of state that's shared across the whole app: a
  keyed, observable store (`EntityStore`) of small JSON blobs (`register`,
  `get`, `set`, `update`, `remove`, `subscribe`). Nothing about dashboards,
  widgets or plugins is hard-wired into it — `packages/ui` and the shell
  screens (Vibes/Apps/Automations, see README's "The shell") read from three
  conventionally-named entities the CLI publishes at startup
  (`nightshift.vibe`, `nightshift.plugins`, `nightshift.automations`) instead
  of depending on the vibe engine, plugin host or automation engine directly.
  If you add a new cross-cutting piece of state the shell needs to display,
  follow that pattern rather than adding a new package dependency.

## The plugin architecture

### The SDK is the only import

A plugin's only allowed import from Nightshift is `@nightshift/sdk`
(`packages/sdk/src/index.ts`). That module does two things:

1. **Defines the runtime contract**: `definePlugin()`, `PluginManifest`,
   `PluginContext`, `Capability`, `CAPABILITIES`, `isCompatible()`.
2. **Re-exports the drawing half**: the whole `@nightshift/ui` component
   library (`Card`, `Panel`, `Table`, `BarChart`, `Sparkline`, `Toolbar`,
   `Icon`, ... ) plus hooks (`useEntity`, `useEntities`, `useCommands`,
   `useTheme`, `useToasts`) and types from `@nightshift/entities` /
   `@nightshift/automations` needed to write a widget or an automation.

If you're adding something a plugin should be able to use, it goes through
`packages/sdk/src/index.ts` — either as a new export re-exported from `ui`/
`entities`/`automations`, or as a new field on `PluginContext`. A plugin must
never reach past the SDK into `@nightshift/services`, `@nightshift/dashboard`,
etc. directly; those are host internals.

### Anatomy of a plugin

```ts
import { definePlugin, Card, useEntity } from '@nightshift/sdk';

export default definePlugin({
  id: 'weather',            // kebab-case, validated by definePlugin
  name: 'Weather',
  version: '1.0.0',
  capabilities: ['entities:write', 'widgets:register', 'automations:register'],
  setup(context) {
    context.registerEntity('weather.now', { temperature: 11 });
    context.registerWidget({
      type: 'weather.now',
      title: 'Weather',
      entities: ['weather.now'],
      render: () => {
        const entity = useEntity<{ temperature: number }>('weather.now');
        return <Card value={`${entity?.state.temperature ?? '—'}°`} />;
      },
    });
    context.registerAutomation({ /* trigger/condition/action, see README */ });
  },
  teardown() {
    // optional; called on unload/shutdown
  },
});
```

`definePlugin()` validates `id` (must match `/^[a-z][a-z0-9-]*$/`) and `name`
at import time, and defaults `apiVersion` to the current
`NIGHTSHIFT_API_VERSION` — a plugin shouldn't set `apiVersion` itself unless
it's deliberately targeting an older contract.

`setup(context)` is called once at load; everything a plugin can do goes
through `context`:

| `context` member               | Requires capability                                                       |
| ------------------------------ | ------------------------------------------------------------------------- |
| `context.entities.*`           | `entities:read` / `entities:write`                                        |
| `context.registerEntity()`     | `entities:write`                                                          |
| `context.registerWidget()`     | `widgets:register`                                                        |
| `context.registerCommand()`    | `commands:register`                                                       |
| `context.registerAutomation()` | `automations:register`                                                    |
| `context.storage.*`            | `storage`                                                                 |
| `context.fetch(url, init?)`    | `network` (HTTPS; HTTP only to loopback/private IPs; 15s default timeout) |
| `context.own(disposable)`      | (always available — ties cleanup to plugin lifetime)                      |
| `context.log.*`                | (always available)                                                        |

`network` and `shell` are declarable capabilities (`CAPABILITIES` in the SDK)
that the host checks at load time. `context.fetch` is the gated network surface:
it asserts `network` on every call and allows HTTPS anywhere plus HTTP only to
loopback/RFC1918 private IPs (for local Home Assistant). Other cleartext URLs
are refused. `shell` remains
declarable only — nothing on `PluginContext` grants shell access yet; don't add
that without checking with a maintainer first.

### Capabilities and permissions

Declared in `packages/sdk/src/index.ts` (`CAPABILITIES`), enforced in
`packages/services/src/plugins/permissions.ts`:

- Auto-granted on load: `entities:read`, `entities:write`, `widgets:register`,
  `commands:register`, `automations:register`, `storage` — these only touch
  Nightshift's own in-process state.
- Require an explicit grant in `config.json`'s `pluginPermissions`:
  `network`, `shell` — anything that reaches outside the process.

A plugin that asks for something ungranted is refused at load time
(`PERMISSION_DENIED`) with the exact `config.json` line to add, printed in
the error's `hint`. Don't try to work around this from inside a plugin —
fix the plugin's declared `capabilities`, or grant it in config.

`context.storage` (per-plugin JSON, one opaque file under the data directory —
see `packages/services/src/plugins/storage.ts`) is the right place for state
nothing but the plugin should ever read. It is not the only option: a plugin
whose whole point _is_ a plain, user-editable file — `plugins/todo` is the
example, which owns a real `todo.md` in the user's home directory — manages
that file directly with `node:fs`, gated by the same `storage` capability.
There's no separate "filesystem" capability; `storage` covers both.

### The plugin host and discovery

`packages/services/src/plugins/`:

- `discovery.ts` — `discoverPlugins()` decides _what_ to load, without
  importing anything: entries from `config.json`'s `plugins` array (bare
  package names resolved by Node, path-like entries resolved relative to
  `cwd`), then anything found by scanning the config directory's `plugins/`
  folder (a subdirectory with a `package.json`, or a loose `.js`/`.mjs`
  file). Config entries win on id collision.
- `host.ts` — `createPluginHost()` does the importing: reads the module,
  extracts the default export (or a named `plugin` export) via
  `definePlugin()`'s result, checks `isCompatible()`, checks permissions via
  `permissions.ts`, builds the scoped `PluginContext` (wrapping the shared
  `EntityStore` so capability checks apply per-call), runs `setup()`, and
  keeps every command/widget/entity/automation the plugin registered so they
  can all be torn down together on `unload()`.
- **A plugin that fails at any step (import, compatibility, permissions,
  `setup()` throwing) is caught, reported via `PluginFailure`, and skipped —
  it must never stop the rest of Nightshift from starting.** Preserve this
  property in any change to `host.ts`: wrap new failure modes the same way,
  don't let them propagate.
- `permissions.ts` — the grant policy described above.
- `resolve.ts` — turns a plugin specifier into something `import()` can load,
  trying the config directory before falling back to the application.
- `storage.ts` — the per-plugin key/value storage behind `context.storage`.

### Widget registration (dashboard side)

`packages/dashboard/src/registry.ts`'s `WidgetRegistry` is the lookup a
dashboard file's `type:` resolves against. `registerPlugin(pluginId, widgets)`
is how a loaded plugin's `PluginWidget[]` (from the host) become drawable
`WidgetDefinition`s; a widget with no `render` is skipped rather than
registered (dashboards fall back to a labelled placeholder for a `type`
nothing has registered — a broken/incomplete widget never breaks the whole
dashboard, same philosophy as the plugin host). Built-in widgets
(`core.note`, `core.entities`, `core.commands`, in
`packages/dashboard/src/widgets.tsx`) are registered the same way, just
without a `source` plugin id.

### Global keyboard shortcuts vs. a focused widget input

OpenTUI does **not** make a focused `<input>` swallow keystrokes the way a
browser would: every `useKeyboard()` listener fires on every keypress
regardless of what has native focus, so a plugin widget composing text (the
todo plugin's Add/Edit fields, say) would otherwise also trigger `e` for
dashboard edit mode, digit keys for nav, `q` to quit, and so on — a plugin
widget cannot itself prevent this, since the global handlers run in
`packages/ui`/`packages/dashboard`, not in the widget.

The fix lives in `@nightshift/ui`'s `keyboardCapture.ts`: `AppRuntime` carries
a `keyboardCapture` (ref-counted `acquire()`/`isCaptured()`). `TextInput`
(`components/controls.tsx`) acquires it for as long as its own `focused` prop
is true and releases it on blur/unmount; `AppShell`'s and `DashboardApp`'s
`useKeyboard` handlers check `runtime.keyboardCapture.isCaptured()` first and
bail if so. This is automatic for any plugin using the SDK's `TextInput` with
`focused` — nothing a plugin author has to opt into. If you add a new global,
no-modifier `useKeyboard` handler anywhere, give it the same guard, or it will
re-open this exact bug for whatever the next text-entering widget is.

## Adding a new plugin

1. Scaffold a new workspace member under `plugins/<name>/`, matching
   `plugins/focus`'s shape:
   ```
   plugins/<name>/
     package.json       # name: @nightshift/plugin-<name>, deps: @nightshift/sdk only
     tsconfig.json       # extends ../../tsconfig.base.json
     src/
       index.ts          # default-exports definePlugin({...})
       *.ts, *.tsx        # state/logic, split out like focus's timer.ts (types, reducers, entity id)
       widgets.tsx        # render functions for any widgets it registers
       *.test.ts(x)       # co-located vitest specs
   ```
   Copy `plugins/focus/package.json` and adjust the name/description; keep
   `@nightshift/sdk` as the only runtime `dependencies` entry (put
   `@nightshift/entities`/`@nightshift/ui` in `devDependencies` only if tests
   need their types, as focus does).
2. Register it with the workspace: `pnpm-workspace.yaml` already globs
   `plugins/*`, so `pnpm install` picks it up once the directory exists.
3. Write `setup(context)`: register any entities the plugin owns, register
   commands, register widgets (built with SDK-exported components/hooks —
   never import `@opentui/*` or `react` primitives beyond what the SDK
   re-exports unless you have a concrete reason to reach past it), register
   automations, and use `context.own()` for anything with a lifetime (timers,
   subscriptions) so `teardown` doesn't have to duplicate that bookkeeping.
4. To ship it bundled with the CLI (as `focus` is), add it as a dependency of
   `apps/cli` and wire it into the default `plugins` list the same way
   `@nightshift/plugin-focus` is; for anything else, it's discovered via
   `config.json`'s `plugins` array or by dropping it in the user's
   `plugins/` config directory — no core code changes required.
5. Add a changeset (`pnpm changeset`) if the change is user-visible.

## Adding a new app/package (not a plugin)

Only do this for something that isn't plugin-shaped — a new host package the
CLI depends on directly (like `services` or `dashboard`), not something a
third party could ship. Most new functionality should be a plugin instead.

1. Create `apps/<name>/` or `packages/<name>/` with a `package.json` mirroring
   an existing one: `"type": "module"`, `main`/`types` pointing at `dist/`,
   an `exports` map, `sideEffects: false` for pure packages, and the standard
   `build`/`typecheck`/`lint`/`test`/`clean` scripts (`tsc -p tsconfig.json`,
   `tsc -p tsconfig.typecheck.json`, `eslint src`,
   `vitest run --passWithNoTests`, `rm -rf dist *.tsbuildinfo`).
2. Add `tsconfig.json` extending `../../tsconfig.base.json` with `rootDir`/
   `outDir` set, and (if the package is typechecked separately from its
   build, as most are) a `tsconfig.typecheck.json`.
3. Declare `workspace:*` dependencies only in the direction the diagram above
   allows — check before adding an import that a lower-level package doesn't
   need to know about a higher-level one.
4. `pnpm install` to link it into the workspace, then `pnpm build`/`pnpm test`
   from the root to confirm Turborepo picks it up.

## Conventions worth following

- **No `console.*` outside `apps/cli/**`** (ESLint-enforced) — thread a
  `Logger`/`PluginLogger` through instead.
- **`type`-only imports** are enforced (`consistent-type-imports`,
  `fixStyle: inline-type-imports`) — write `import { type Foo, bar } from ...`
  rather than a separate `import type` statement.
- **Errors** go through `NightshiftError(code, message, { cause?, hint? })`
  from `@nightshift/core`, not a bare `Error` — the `code` is machine-checked
  in tests and surfaced to users, and `hint` is where you tell them how to
  fix it (see the permission-denied and incompatible-plugin errors in
  `host.ts` for the pattern).
- **Never let one bad input break startup.** This shows up repeatedly:
  a broken plugin is skipped, not fatal; a dashboard referencing an
  unregistered widget type gets a placeholder; a vibe step that fails is a
  warning. Match this failure philosophy in new code rather than throwing
  and letting it propagate to a crash.
- **Tests are co-located** (`Foo.ts` + `Foo.test.ts` in the same directory),
  not in a parallel `test/` tree — follow that when adding files.
- **Unknown config keys are ignored, not rejected** — `config.json` and
  dashboard/vibe YAML are forward-compatible by convention; don't add strict
  "unknown key" rejection without checking this is intended to change.
- Run `pnpm check` and fix every failure before considering a change done
  (and before committing — the pre-commit hook runs the same command).
  Turborepo caches make the full run cheap when only one package changed.
  `--filter`-scoped lint/typecheck/test is fine while iterating.
