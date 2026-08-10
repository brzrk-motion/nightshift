---
'@nightshift/automations': minor
'@nightshift/dashboard': minor
'@nightshift/plugin-focus': minor
'@nightshift/services': minor
'@nightshift/vibes': minor
'@nightshift/core': minor
'@nightshift/cli': minor
'@nightshift/sdk': minor
'@nightshift/ui': minor
---

Phases 4–6: vibes, automations, a real focus timer, and MVP polish.

- **Vibes** — a YAML format, a loader with the same strict per-path validation
  as dashboards, and an engine that applies a vibe's theme, dashboard, entity
  state and `onActivate` commands, running the outgoing vibe's `onDeactivate`
  first. A step that fails warns rather than aborting the rest. Three vibes
  ship by default: `locked-in`, `morning`, `night-shift`.
- **Automations** — `startup`, `entity`, `vibe` and `interval` triggers,
  `equals`/`above`/`below` conditions, and an action list that keeps running
  after one action fails. Plugins declare automations through
  `context.registerAutomation`, behind a new `automations:register`
  capability (granted automatically, like widgets and commands).
- **`nightshift vibe [name]`** now actually activates a vibe: it opens the
  vibe's dashboard (or the configured default) and applies the vibe on top.
  Every vibe also gets an `Activate <name>` command in the palette, so
  switching vibes mid-session works the same way switching dashboards does.
- **Focus plugin** is a real timer now, not a stub: `focus.start/pause/stop/
reset` drive a pure, fully-tested reducer; a session widget shows the clock,
  a progress bar and controls; a today widget tracks completed sessions,
  persisted across restarts through plugin storage; and a built-in automation
  notifies you when a session finishes.
- `app.notify` is a new hidden command any plugin's automation or command can
  target to show a toast, without reaching into the runtime for it.
- `PluginCommand.run` now accepts the same `args` a vibe's `onActivate` or an
  automation's `then` can pass — needed for `focus.start` to receive
  `{ minutes: 50 }`, and a gap in the original SDK contract.
- `nightshift doctor` gains a `vibes` check (counts built-in and user vibes,
  flags an unresolvable `defaultVibe`) alongside the existing dashboard and
  plugin checks.

Packaging binaries and a release workflow are the one piece of the roadmap not
in this change — everything else in the MVP checklist is wired end-to-end.
