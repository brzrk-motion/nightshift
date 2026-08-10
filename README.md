# Nightshift

A programmable workspace for deep focus — terminal-first, plugin-driven,
configured in files you own.

> **Status: Phase 1 (foundation).** The monorepo, tooling, package layout and
> CLI skeleton are in place. The terminal UI, dashboard engine, vibe engine and
> the focus timer itself land in Phases 2–5.

## Requirements

- Node.js 22 or newer
- pnpm 11 or newer

## Getting started

```bash
pnpm install
pnpm build
pnpm nightshift doctor
```

`pnpm nightshift <args>` runs the built CLI from the repo. To get a real
`nightshift` on your `PATH`, link the package after building:

```bash
pnpm --filter @nightshift/cli exec pnpm link --global
```

## Commands

| Command                       | What it does                                         |
| ----------------------------- | ---------------------------------------------------- |
| `nightshift`                  | Opens the default dashboard.                         |
| `nightshift dashboard [name]` | Opens a dashboard; `--list` shows what is available. |
| `nightshift vibe [name]`      | Activates a vibe; with no name, lists them.          |
| `nightshift doctor`           | Checks the environment, config and plugins.          |

Global flags: `--config-dir <path>`, `--log-level <level>`, `-v/--verbose`,
`--no-color`, `-V/--version`. Most commands also accept `--json`.

## Configuration

Nightshift follows the XDG base directory spec, and `%APPDATA%` on Windows.
`NIGHTSHIFT_CONFIG_DIR` (or `--config-dir`) overrides the root, and when it is
set every file — data and logs included — lives underneath it.

| Path                                      | Contents                     |
| ----------------------------------------- | ---------------------------- |
| `$XDG_CONFIG_HOME/nightshift/config.json` | Settings                     |
| `$XDG_CONFIG_HOME/nightshift/dashboards/` | Dashboard definitions (YAML) |
| `$XDG_CONFIG_HOME/nightshift/vibes/`      | Vibe definitions (YAML)      |
| `$XDG_CONFIG_HOME/nightshift/plugins/`    | Locally installed plugins    |
| `$XDG_STATE_HOME/nightshift/logs/`        | JSON-lines log files         |

```json
{
  "version": 1,
  "defaultDashboard": "home",
  "defaultVibe": null,
  "theme": "midnight",
  "logLevel": "info",
  "plugins": ["@nightshift/plugin-focus"]
}
```

Unknown keys are ignored rather than rejected, so an older Nightshift can still
read a file written by a newer one.

## Repository layout

```
apps/cli               The nightshift command line interface
packages/core          Runtime primitives: errors, versions, shared types
packages/entities      Shared observable state — the contract for plugin state
packages/sdk           The public interface plugins are written against
packages/ui            Terminal component library and themes
packages/dashboard     Dashboard model, layout parser, widget registry
packages/vibes         The vibe engine
packages/automations   Triggers, conditions and actions
packages/services      Config directory, settings and logging
plugins/focus          The focus timer — the reference plugin
```

## Development

```bash
pnpm build       # build every package, in dependency order
pnpm test        # run the test suites
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit, tests included
pnpm format      # prettier --write
```

Turborepo drives the task graph, so `pnpm build` builds dependencies first and
caches anything that has not changed. Changesets manages versioning; run
`pnpm changeset` alongside a user-visible change.

## Design principles

- Everything is a plugin.
- Dashboards consume widgets.
- Vibes orchestrate actions.
- Entities provide shared state.
- Automations react to events.
- The public SDK is the only plugin interface.
- Nightshift manages the environment around the work — not the work itself.

## License

MIT
