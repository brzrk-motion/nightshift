# Nightshift

A programmable workspace for deep focus — terminal-first, plugin-driven,
configured in files you own.

> **Status: Phase 7.** `nightshift` opens a full-screen shell — a header, a
> left nav rail, and a persistent status bar around the dashboard canvas —
> plugins load through the public SDK and contribute widgets, commands and
> automations, the entity store drives the screen, vibes orchestrate the
> workspace by name, and the bundled focus plugin is a real timer. Rebuilding
> the shipped dashboard's own content and a visual editor are Phases 8–9;
> packaging binaries and a release workflow are what's left of the MVP
> checklist.

## Requirements

- Node.js 22 or newer for everything except the dashboard
- **Node.js 26.4 or newer, or Bun, to open a dashboard** — OpenTUI draws through
  a native library reached over FFI, which older Node releases cannot load.
  `nightshift` re-launches itself with `--experimental-ffi` when it needs to, so
  there is no flag to remember; `nightshift doctor` tells you where you stand.
- pnpm 11 or newer

## Getting started

```bash
pnpm install
pnpm start doctor
```

`pnpm start` runs `./nightshift.mjs`, which builds the CLI and everything it
depends on and then launches it, forwarding all arguments. A successful build
prints nothing, so the CLI starts on a clean terminal; a failing one prints the
compiler errors and refuses to start. Add `--no-build` to skip the build when
nothing has changed:

```bash
pnpm start doctor
pnpm start vibe --list
pnpm start --no-build dashboard
./nightshift.mjs doctor          # same thing, without pnpm
```

`pnpm nightshift <args>` runs the already-built CLI directly, with no build
step. To get a real `nightshift` on your `PATH`, link the package after
building:

```bash
pnpm build
pnpm --filter @nightshift/cli exec pnpm link --global
```

## Commands

| Command                        | What it does                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `nightshift`                   | Opens the default dashboard.                                                                                                         |
| `nightshift dashboard [name]`  | Opens a dashboard; `--list` shows what is available.                                                                                 |
| `nightshift dashboard --check` | Reports what would open, without taking the terminal.                                                                                |
| `nightshift vibe [name]`       | Opens the dashboard with a vibe active; `--list` lists them, `--set-default` persists the choice, `--check` reports without opening. |
| `nightshift doctor`            | Checks the environment, config, vibes, dashboards and plugins.                                                                       |

Inside a dashboard:

| Key             | What it does                 |
| --------------- | ---------------------------- |
| `ctrl+p` or `:` | Open the command palette     |
| `?`             | Show the keyboard shortcuts  |
| `ctrl+k`        | Switch to the next dashboard |
| `ctrl+r`        | Refresh every widget         |
| `q` or `ctrl+c` | Quit                         |

Everything the palette offers is a command, and every command can be bound to a
key or triggered by a vibe — including the ones plugins contribute.

Global flags: `--config-dir <path>`, `--log-level <level>`, `-v/--verbose`,
`--no-color`, `-V/--version`. Most commands also accept `--json`.

## The shell

A persistent header, a left nav rail, and a status bar frame whatever the
canvas is showing. The header names the active screen, shows the running vibe
once one is active (`● locked in`) and the clock; the rail — collapsing to
icons on a narrow terminal — is six destinations, each reachable by mouse
click, by a `1`–`6` digit key, and as a `Go to <name>` command in the palette:

| #   | Destination | Shows                                         |
| --- | ----------- | --------------------------------------------- |
| 1   | Dashboard   | Whatever dashboard is open.                   |
| 2   | Vibes       | Every vibe, and which one (if any) is active. |
| 3   | Apps        | Loaded plugins and how much each contributed. |
| 4   | Entities    | Every entity in the store, live.              |
| 5   | Automations | Registered automations and their triggers.    |
| 6   | Settings    | Installed themes; select one to switch.       |

Vibes, Apps and Automations read from three entities the CLI publishes —
`nightshift.vibe`, `nightshift.plugins`, `nightshift.automations` — so
`packages/ui` never has to depend on the vibe engine, the plugin host or the
automation engine directly. A widget or a screen a plugin builds gets the same
component library the shell itself is built from — `Icon`, `Toolbar`,
`StatRow`, `Metric`, `Timeline` and the rest are all exported from
`@nightshift/sdk` alongside `Card` and `Table`.

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
  "plugins": ["@nightshift/plugin-focus"],
  "pluginPermissions": {}
}
```

Unknown keys are ignored rather than rejected, so an older Nightshift can still
read a file written by a newer one.

Themes: `midnight` (the default), `ember`, `daylight`.

## Dashboards

A dashboard is a YAML file in `dashboards/`, named after its file. Rows stack
down the screen and widgets sit across them; `span` and `height` are relative
weights, not cell counts, so the same file works at any terminal size. On a
narrow terminal a row's widgets restack rather than being squeezed.

```yaml
title: Home
theme: midnight
refresh: 30 # seconds; omit or use 0 for no automatic refresh
rows:
  - widgets:
      - type: core.clock
      - type: core.note
        title: Getting started
        span: 2
        options:
          text: Press ctrl+p for commands.
  - height: 2
    widgets: [core.entities, core.commands]
```

A widget may be written as a bare `type` when it needs nothing else, and a row
as a bare list of widgets when it needs no height.

Nightshift ships four widgets — `core.clock`, `core.note`, `core.entities` and
`core.commands` — and everything else comes from plugins. A widget type nothing
has registered draws a labelled placeholder rather than failing the dashboard.

## Vibes

A vibe is a named state of the workspace: a theme, a dashboard, entity values
to merge in, and commands to run. `nightshift vibe <name>` opens the dashboard
with it already applied; from inside a running dashboard, the palette lists
one `Activate <title>` command per vibe, the same way it does for dashboards.

A vibe file lives in `vibes/`, named after its file, and a user file replaces
a built-in vibe of the same name:

```yaml
title: Locked In
description: Deep work. Timer running, nothing else asking for attention.
theme: midnight
dashboard: focus
entities:
  timer.focus:
    completedToday: 0 # merged in, not replaced — only the keys listed change
onActivate:
  - command: focus.start
    args:
      minutes: 50
onDeactivate:
  - focus.pause
```

Nightshift ships three: `locked-in`, `morning` and `night-shift`. Switching to
a new vibe runs the outgoing one's `onDeactivate` first. A step that fails —
an unknown theme, a command with no such id — is reported as a warning rather
than aborting the rest, the same way a broken plugin does not stop startup.

## Automations

An automation reacts to something rather than being invoked by name: a trigger
fires, its conditions are checked, and its actions run.

```ts
{
  name: 'focus.notify-finished',
  when: { type: 'entity', entity: 'timer.focus', key: 'status' },
  and: [{ type: 'equals', entity: 'timer.focus', key: 'status', value: 'finished' }],
  then: [{ command: 'app.notify', args: { message: 'Session complete.', tone: 'success' } }],
}
```

| Trigger    | Fires                                                 |
| ---------- | ----------------------------------------------------- |
| `startup`  | Once, when the engine starts.                         |
| `entity`   | When an entity changes; add `key` to watch one field. |
| `vibe`     | When a named vibe activates or deactivates.           |
| `interval` | Every `seconds`, once started.                        |

Conditions (`equals`, `above`, `below`) read an entity field at fire time; all
of them must hold for the actions to run. There is no YAML format for
automations yet — a plugin declares them with `context.registerAutomation(...)`
(see below), which is how the bundled focus plugin notifies you when a session
finishes.

## Plugins

A plugin is a module that default-exports `definePlugin(...)`. It is discovered
either from the `plugins` list in `config.json` or by being dropped into
`plugins/` in the config directory, and `@nightshift/sdk` is the only thing it
imports from Nightshift — the runtime contract and the component library both
come from there.

```ts
import { definePlugin, Card, useEntity } from '@nightshift/sdk';

export default definePlugin({
  id: 'weather',
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
    context.registerAutomation({
      name: 'weather.frost-warning',
      when: { type: 'entity', entity: 'weather.now', key: 'temperature' },
      and: [{ type: 'below', entity: 'weather.now', key: 'temperature', value: 0 }],
      then: [{ command: 'app.notify', args: { message: 'Frost tonight.', tone: 'warning' } }],
    });
  },
});
```

A plugin dropped into `plugins/` is imported as-is, so it has to be an installed
package with its dependencies alongside it, or a bundle.

### Capabilities

A plugin declares what it needs and gets only that. Everything that touches
Nightshift's own state is granted on install; the two that reach outside the
process are not, and wait for a line in `config.json`:

| Capability                                                      | Granted       |
| --------------------------------------------------------------- | ------------- |
| `entities:read`, `entities:write`                               | automatically |
| `widgets:register`, `commands:register`, `automations:register` | automatically |
| `storage`                                                       | automatically |
| `network`, `shell`                                              | by you        |

```json
{ "pluginPermissions": { "weather": ["network"] } }
```

A plugin that asks for something it has not been granted is refused at load
time, with the line to add printed alongside the refusal. A plugin that fails
for any reason is reported and skipped — Nightshift still starts.

## Repository layout

```
nightshift.mjs         Build-and-launch script for local development
apps/cli               The nightshift command line interface
packages/core          Runtime primitives: errors, versions, shared types
packages/entities      Shared observable state — the contract for plugin state
packages/sdk           The public interface plugins are written against
packages/ui            Application shell, component library and themes
packages/dashboard     Dashboard model, layout parser, widget registry
packages/vibes         The vibe engine
packages/automations   Triggers, conditions and actions
packages/services      Config, logging, settings and the plugin runtime
plugins/focus          The focus timer — the reference plugin
```

## Development

```bash
pnpm start       # build the CLI and run it
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
