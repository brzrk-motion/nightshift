# Data Model: User-Friendly Vibe Editor

**Feature**: `003-vibe-editor` | **Date**: 2026-08-11

## Overview

Canonical durable model remains `VibeSpec` on disk. The UI edits a `VibeDraft`, converts to save args, and the host validates via serialize→parse. Catalog and optional dashboard list are entity projections for the shell.

## Entities

### VibeSpec (file + engine) — existing

| Field          | Type            | Rules                                                          |
| -------------- | --------------- | -------------------------------------------------------------- |
| `name`         | string          | `/^[a-z][a-z0-9-]*$/`; equals filename stem                    |
| `title`        | string?         | Display name                                                   |
| `description`  | string?         |                                                                |
| `theme`        | string?         | Must exist at activate time (warning if not)                   |
| `dashboard`    | string?         | Opens `dashboard.open.<name>`                                  |
| `entities`     | map?            | Entity id → partial state; preserved on save when UI unchanged |
| `onActivate`   | `VibeAction[]`? | Ordered                                                        |
| `onDeactivate` | `VibeAction[]`? | Ordered                                                        |

### VibeAction

| Field     | Type                    | Rules                |
| --------- | ----------------------- | -------------------- |
| `command` | string                  | Non-empty command id |
| `args`    | `Record<string, Json>`? | Object if present    |

### VibeCatalogRow (`nightshift.vibes.vibes[]`)

| Field                                      | Type                   | Rules                            |
| ------------------------------------------ | ---------------------- | -------------------------------- |
| `name`                                     | string                 |                                  |
| `title`                                    | string                 | title ?? name                    |
| `description`                              | string                 | may be `''`                      |
| `theme`                                    | string                 | may be `''`                      |
| `dashboard`                                | string                 | may be `''`                      |
| `source`                                   | `'built-in' \| 'user'` | user if file override exists     |
| `active`                                   | boolean                | vs `nightshift.vibe.active`      |
| `entities` / `onActivate` / `onDeactivate` | optional               | Full payload for edit round-trip |

### VibeDraft (UI-only)

| Field                                        | Type            | Rules                                                                 |
| -------------------------------------------- | --------------- | --------------------------------------------------------------------- |
| `name`                                       | string          | Editable only on create                                               |
| `title`, `description`, `theme`, `dashboard` | string          | Empty = omit on save                                                  |
| `onActivate`, `onDeactivate`                 | `ActionDraft[]` | `command` + `args` string (JSON or empty)                             |
| `entities`                                   | map?            | Copied from catalog on edit; opaque to UI until entities editor ships |

### ActionDraft

| Field     | Type   | Rules                     |
| --------- | ------ | ------------------------- |
| `command` | string |                           |
| `args`    | string | Empty or JSON object text |

### DashboardCatalogRow (`nightshift.dashboards.dashboards[]`) — new

| Field   | Type   | Rules         |
| ------- | ------ | ------------- |
| `name`  | string |               |
| `title` | string | title ?? name |

## Validation rules

1. Create name: non-empty, matches vibe name regex; unique preferred (save may overwrite user file of same name).
2. `draftToSaveArgs`: skip blank command rows; parse args JSON as object or error.
3. Host `vibe.save`: round-trip `parseVibe(serializeVibe(...))` before write.
4. `vibe.delete`: only if user file exists for name; then refresh engine (re-add built-in if applicable) + catalog.
5. Preserve `entities` when present on draft.

## State transitions

```text
[list] --Add--> [create draft] --Save ok--> [list + catalog refresh]
[list] --Edit--> [edit draft] --Save ok--> [list + catalog refresh]
[list] --Duplicate--> [create draft prefilled]
[list] --Delete user--> confirm --> [list + file gone]
[create|edit] --Cancel/Esc--> [list] (discard)
```

## Persistence mapping

| Layer    | Location                                      | Contents              |
| -------- | --------------------------------------------- | --------------------- |
| File     | `vibes/<name>.yaml`                           | Serialized VibeSpec   |
| Engine   | in-memory map                                 | Registered vibes      |
| Entity   | `nightshift.vibes`                            | Catalog rows          |
| Entity   | `nightshift.vibe`                             | `{ active, title }`   |
| Entity   | `nightshift.dashboards`                       | Dashboard picker rows |
| Commands | `vibe.save`, `vibe.delete`, `vibe.activate.*` | Mutations / activate  |
