---
'@nightshift/automations': minor
'@nightshift/dashboard': minor
'@nightshift/entities': minor
'@nightshift/services': minor
'@nightshift/plugin-focus': minor
'@nightshift/vibes': minor
'@nightshift/core': minor
'@nightshift/cli': minor
'@nightshift/sdk': minor
'@nightshift/ui': minor
---

Phase 2 and 3: the core runtime and the dashboard engine.

`nightshift` now opens a real terminal dashboard. OpenTUI drives the screen
through the React renderer, the entity store pushes state into widgets, and
plugins load through the public SDK and contribute widgets and commands to it.

- **Core** — a typed event bus and a disposable bag, the primitives the rest of
  the runtime is built on.
- **Entities** — the store is implemented: a registry, merge-or-replace writes,
  per-entity and global subscriptions, and an event bus that reports the kind
  of each change. Every write hands out a new frozen entity, so the UI can
  compare snapshots by identity.
- **Application shell** — OpenTUI bootstrapping, a theme engine with three
  built-in themes, a responsive layout solver, a keybinding parser and matcher,
  a command registry with fuzzy search, a command palette, a help overlay,
  toasts, and mouse support.
- **Plugin runtime** — discovery from configuration and from the config
  directory, loading with contract and permission checks, lifecycle hooks,
  per-plugin storage, and full rollback when a plugin fails. One bad plugin is
  reported and skipped rather than stopping startup.
- **Permission model** — plugins get the capabilities that touch Nightshift's
  own state on install; `network` and `shell` wait for a grant in
  `pluginPermissions`.
- **Dashboard engine** — a YAML format with strict, path-naming validation, a
  widget registry plugins contribute to, a renderer that reshapes rows for the
  terminal it is given, widget refresh, and dashboard switching through the
  palette. Four built-in widgets ship so a fresh install has something to show.
- **Component library** — Card, Panel, Button, Toggle, ProgressBar, Tabs,
  TextInput, Table, List, StatusBadge, Sparkline, LineChart, BarChart, Modal
  and Toasts, all themed and re-exported from the SDK for plugin authors.

Opening a dashboard needs Node 26.4 or newer, or Bun, because OpenTUI's native
renderer is reached over FFI. The CLI re-launches itself with the flag when it
needs to, and `nightshift doctor` reports where you stand. Every other command
still runs on Node 22.
