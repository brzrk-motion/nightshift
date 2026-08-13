# Nightshift

A programmable workspace for deep focus — terminal-first, plugin-driven,
configured in files you own.

> **Status: Phase 9.** `nightshift` opens a full-screen shell — a header, a
> left nav rail, and a persistent status bar around the dashboard canvas —
> plugins load through the public SDK and contribute widgets, commands and
> automations, the entity store drives the screen, vibes orchestrate the
> workspace by name, and the bundled pomodoro, todo, habit, home-assistant, and weather
> plugins ship with the CLI. A dashboard is config all the way down — three ship by
> default, and `home` includes weather, pomodoro, todo, habit, and Home Assistant widgets.
> Dashboards can be edited in place, saved back to disk and reloaded without a restart.
> Packaging binaries and a release workflow are what's left of the MVP
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
| `nightshift doctor`            | Checks the environment, terminal capabilities, config, vibes, dashboards and plugins.                                                |

Inside a dashboard:

| Key             | What it does                 |
| --------------- | ---------------------------- |
| `ctrl+p` or `:` | Open the command palette     |
| `?`             | Show the keyboard shortcuts  |
| `ctrl+k`        | Switch to the next dashboard |
| `ctrl+r`        | Refresh every widget         |
| `e`             | Edit this dashboard          |
| `q` or `ctrl+c` | Quit                         |

Everything the palette offers is a command, and every command can be bound to a
key or triggered by a vibe — including the ones plugins contribute.

`e` (or `dashboard.edit.toggle` from the palette) is available whenever a
dashboard actually renders interactively — not under `--json` or `--check`,
where nothing is open to edit. While editing:

| Key         | What it does                              |
| ----------- | ----------------------------------------- |
| `tab`       | Select the next widget (`shift+tab` back) |
| `←→` / `↑↓` | Move the selected widget                  |
| `shift+←→`  | Resize the selected widget's span         |
| `shift+↑↓`  | Resize its row's height                   |
| `a`         | Add a widget, from a searchable picker    |
| `w`         | Swap the selected widget for another type |
| `d`         | Remove the selected widget                |
| `ctrl+s`    | Save                                      |
| `r`         | Reset to the last saved version           |
| `esc`       | Cancel and discard changes                |

A widget can also be selected with a click. Changing widget _settings_ —
editing an existing widget's title or options in place — is not built; swap
it out and back in through the picker to change what it's configured with.

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
  "version": 6,
  "defaultDashboard": "home",
  "defaultVibe": null,
  "theme": "midnight",
  "logLevel": "info",
  "plugins": [
    "@nightshift/plugin-clock",
    "@nightshift/plugin-habit",
    "@nightshift/plugin-home-assistant",
    "@nightshift/plugin-pomodoro",
    "@nightshift/plugin-spotify",
    "@nightshift/plugin-todo",
    "@nightshift/plugin-weather"
  ],
  "pluginPermissions": {
    "weather": ["network"],
    "spotify": ["network"],
    "clock": ["network"],
    "home-assistant": ["network"]
  },
  "onboarded": false
}
```

`onboarded` tracks whether the one-time welcome modal has been shown; opening
a dashboard once flips it to `true` and writes it back.

Unknown keys are ignored rather than rejected, so an older Nightshift can still
read a file written by a newer one.

Themes: `midnight` (the default), `ember`, `daylight`.

## Dashboards

A dashboard is a YAML file in `dashboards/`, named after its file — nothing
about its layout is hard-coded into the application shell, including the
three Nightshift ships with. Rows stack down the screen and widgets sit
across them; `span` and `height` are relative weights, not cell counts, so
the same file works at any terminal size. On a narrow terminal a row's
widgets restack rather than being squeezed.

```yaml
version: 1
title: Home
theme: midnight
refresh: 30 # seconds; omit or use 0 for no automatic refresh
rows:
  - widgets:
      - type: clock.now
      - type: core.note
        title: Reminder
        span: 2
        minWidth: 30 # falls to its own row below this many columns
        options:
          text: Ship the thing.
        when: # only drawn while this holds against the entity store
          type: equals
          entity: pomodoro.session
          key: status
          value: running
  - height: 2
    widgets: [core.entities, core.commands]
```

A widget may be written as a bare `type` when it needs nothing else, and a row
as a bare list of widgets when it needs no height. `version` defaults to the
current schema and is validated against it, so a file written by a newer
Nightshift is refused with an explicit message rather than misread.

Nightshift ships three built-in widgets — `core.note`, `core.entities` and
`core.commands` — and everything else, clock included, comes from plugins. A
widget type nothing has registered draws a labelled placeholder rather than
failing the dashboard.

Three dashboards ship by default — `home`, `minimal` and `nightshift`.
`minimal` and `nightshift` stick to the three built-ins, so they always
render with no plugins installed; `home` also draws on every plugin
Nightshift bundles by default (clock, pomodoro, todo, weather). A user file of
the same name replaces the built-in rather than sitting alongside it. The
`dashboard.reload` command —
from the palette, a keybinding, or a vibe's `onActivate` — re-reads
`dashboards/` without restarting.

### Editing a dashboard

Press `e` inside a dashboard to edit it in place — select a widget, move or
resize it, add one from a searchable picker, swap one for a different type,
or remove it — then `ctrl+s` to save, or `esc` to discard. See the key table
above. Saving writes fully-explicit YAML back to `dashboards/<name>.yaml`
through the same parser that reads it, so a hand-edited file and one saved
from edit mode are interchangeable.

The first time Nightshift opens, a one-time welcome modal explains the
palette, the shortcut list and where dashboards live, instead of that living
permanently on the shipped dashboard as a widget; any key dismisses it for
good.

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
dashboard: nightshift
entities:
  pomodoro.session:
    completedPomodorosToday: 0 # merged in, not replaced — only the keys listed change
onActivate:
  - pomodoro.start
onDeactivate:
  - pomodoro.pause
```

Nightshift ships three: `locked-in`, `morning` and `night-shift`. Switching to
a new vibe runs the outgoing one's `onDeactivate` first. A step that fails —
an unknown theme, a command with no such id — is reported as a warning rather
than aborting the rest, the same way a broken plugin does not stop startup.
`locked-in` is the one that opens the `nightshift` dashboard rather than
`home`, so activating it demonstrates a vibe changing the dashboard, the
theme and starting a timer all at once, not just the theme.

From the **Vibes** screen (nav key `2`) you can browse every vibe, activate
one, and create or edit user vibes in a guided form — pick a theme and
dashboard from what Nightshift has registered, search for commands instead of
memorizing ids, and save to `vibes/<name>.yaml` without hand-editing YAML.
Duplicate and delete user-owned vibes from the same screen; built-in vibes
cannot be deleted, but saving under a built-in name creates a user override.

## Automations

An automation reacts to something rather than being invoked by name: a trigger
fires, its conditions are checked, and its actions run.

```ts
{
  name: 'pomodoro.notify-work-complete',
  when: { type: 'entity', entity: 'pomodoro.session', key: 'status' },
  and: [
    { type: 'equals', entity: 'pomodoro.session', key: 'status', value: 'phaseComplete' },
    { type: 'equals', entity: 'pomodoro.session', key: 'phase', value: 'work' },
  ],
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
(see below), which is how the bundled pomodoro plugin notifies you when a work
interval finishes.

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
  capabilities: [
    'entities:write',
    'widgets:register',
    'automations:register',
    'network',
    'storage',
  ],
  setup(context) {
    // Real Open-Meteo fetch goes through context.fetch (needs pluginPermissions).
    context.registerEntity('weather.now', { temperature: 11 });
    context.registerWidget({
      type: 'weather.now',
      title: 'Weather',
      entities: ['weather.locations'],
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

Nightshift ships bundled plugins:

- **clock** — the time and date, in the machine's own timezone when it can be
  detected (`Intl.DateTimeFormat().resolvedOptions().timeZone`, no network
  needed) or a location you set otherwise, geocoded to a timezone the same
  way weather resolves a place to coordinates. Settings (12/24-hour, seconds,
  a date format picked from a few presets, and the timezone) live behind the
  widget's own "Settings" toggle rather than dashboard `options`, and persist
  across restarts. A clock added through the widget picker opens straight
  into that settings panel.
- **pomodoro** — work intervals with short and long breaks (25/5/15 by
  default, long break every four pomodoros). Session widget plus today’s count.
  The reference timer plugin.
- **habit** — a rolling 7-day habit grid (`habit.tracker`) with add/toggle/
  rename/delete, current and longest streaks, and persistence via plugin
  storage. Day-label density adapts to the widget’s width.
- **home-assistant** — connect to a Home Assistant instance (LAN IP or URL +
  long-lived access token), list scenes, activate them from the widget, and
  bind scenes to vibes via `home-assistant.activate-scene` in vibe
  `onActivate` / `onDeactivate`. Token stays in plugin storage, never on the
  shared entity.
- **todo** — a todo list with no backend; a single `todo.md` in your home
  directory is the source of truth (`- [ ]` / `- [x]`), mirrored into
  `todo.items`.
- **weather** — current conditions and a multi-day forecast from Open-Meteo.
  Each widget binds to a location **slot** via dashboard `options.location`
  (zip, city, postal code, or `lat,lon`). Enter a place in the widget, or run
  `weather.configure-location`. Multiple weather widgets can use different
  slots; the shipped `home` dashboard shares `location: home` between now and
  forecast. Frost warnings watch the primary slot mirrored on `weather.now`.
- **spotify** — control the Spotify client on your machine (playlists,
  podcasts, play/pause/skip). Does not stream audio. The `spotify.player`
  widget asks for a Spotify Developer app Client ID and Secret, then Connect
  via browser OAuth. See
  [Spotify apps](https://developer.spotify.com/documentation/web-api/concepts/apps);
  allowlist redirect URI `http://127.0.0.1:43891/callback`. Playback control
  needs Spotify Premium.
- **ambient-noise** — looping named ambient clips (`ambient-noise.player`)
  with play/pause and next/previous. Track changes crossfade; the current
  clip name is shown in the widget. No extra plugin permission.

Defaults grant weather, Spotify, clock, and Home Assistant network access
(the clock only calls out when you set a location — the machine's own
timezone needs none):

```json
{
  "pluginPermissions": {
    "weather": ["network"],
    "spotify": ["network"],
    "clock": ["network"],
    "home-assistant": ["network"]
  }
}
```

Existing configs are migrated on load when the config version bumps (bundled
plugins and their network grants are added automatically).

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

`network` unlocks `context.fetch` (HTTPS anywhere; HTTP only to loopback /
private LAN IPs for local Home Assistant). `shell` is still declare-only.

```json
{
  "pluginPermissions": {
    "weather": ["network"],
    "spotify": ["network"],
    "clock": ["network"],
    "home-assistant": ["network"]
  }
}
```

A plugin that asks for something it has not been granted is refused at load
time, with the line to add printed alongside the refusal. A plugin that fails
for any reason is reported and skipped — Nightshift still starts.

## MCP servers

Nightshift ships MCP servers for the agents that work on it. They are developer
tooling, not part of the application — nothing in `apps/` or `packages/` depends
on them.

```bash
pnpm mcp:up                        # build every server, launch it, print the endpoints
pnpm mcp:up --check                # verify each one starts and answers, then exit
pnpm mcp:up --write-cursor-config  # merge the endpoints into .cursor/mcp.json
pnpm mcp:up --only context --no-build
```

```
SERVER   PORT  ENDPOINT                   STATUS
context  7411  http://127.0.0.1:7411/mcp  ready — 7 tools
```

`mcp-up` discovers servers by scanning `mcp/*/package.json` for an `mcp` block:

```json
"mcp": { "id": "context", "port": 7411 },
"bin": { "nightshift-context-mcp": "./dist/bin.js" }
```

so a new server needs no changes to the launcher. Each is started with `--http`
as a long-lived process, restarted if it crashes, and stopped on Ctrl-C.

The same binaries also speak stdio, which is what an editor spawning them
directly will use — no daemon required:

```json
{
  "mcpServers": {
    "nightshift-context": {
      "command": "node",
      "args": ["mcp/context-mcp/dist/bin.js"]
    }
  }
}
```

### mcp/context-mcp

A tree-sitter index of the repository, kept current as files change. It exists
so an agent can ask for the definition it needs — `search_symbols`,
`get_symbol`, `file_outline`, `find_references`, `read_lines` — instead of
reading whole files to find it. See
[`mcp/context-mcp/README.md`](mcp/context-mcp/README.md).

## Repository layout

```
nightshift.mjs         Build-and-launch script for local development
mcp-up.mjs             Build-and-launch script for the MCP servers
apps/cli               The nightshift command line interface
packages/core          Runtime primitives: errors, versions, shared types
packages/entities      Shared observable state — the contract for plugin state
packages/sdk           The public interface plugins are written against
packages/ui            Application shell, component library and themes
packages/dashboard     Dashboard model, layout parser, widget registry
packages/vibes         The vibe engine
packages/automations   Triggers, conditions and actions
packages/services      Config, logging, settings and the plugin runtime
mcp/context-mcp        A tree-sitter code index served over MCP, for agents
plugins/clock          The time and date, with 12/24-hour and date format settings
plugins/pomodoro       Work intervals with short and long breaks — the reference plugin
plugins/habit          Rolling 7-day habit tracker
plugins/home-assistant Home Assistant scenes (list, activate, vibe bindings)
plugins/todo           A todo list backed by a plain todo.md file
plugins/weather        Current conditions + forecast via Open-Meteo
```

## Development

```bash
pnpm start       # build the CLI and run it
pnpm build       # build every package, in dependency order
pnpm test        # run the test suites
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit, tests included
pnpm check       # format:check + lint + typecheck + test (also the pre-commit hook)
pnpm format      # prettier --write
pnpm mcp:up      # build and run the MCP servers
```

Turborepo drives the task graph, so `pnpm build` builds dependencies first and
caches anything that has not changed. Changesets manages versioning; run
`pnpm changeset` alongside a user-visible change. Husky runs `pnpm check` on
every commit (`HUSKY=0 git commit` skips it).

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
