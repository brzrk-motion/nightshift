# Data Model: Dashboards Sidebar Page

**Feature**: `005-dashboards-sidebar-page` | **Date**: 2026-08-12

## Overview

Canonical durable model remains `DashboardSpec` on disk. The Dashboards screen edits a `DashboardDraft` (metadata-focused), converts to save args, and the host validates via serialize→parse. Catalog and active snapshot are entity projections for the shell. Widget rows are preserved on save when editing metadata only.

## Entities

### DashboardSpec (file + renderer) — existing

| Field     | Type        | Rules                                              |
| --------- | ----------- | -------------------------------------------------- |
| `name`    | string      | Non-empty; filename stem `<name>.yaml`             |
| `title`   | string?     | Display name                                       |
| `theme`   | string?     | Optional theme override                            |
| `refresh` | number?     | Seconds; `0` disables                              |
| `version` | number?     | Schema version                                     |
| `rows`    | `RowSpec[]` | Non-empty (parse rule); preserved on metadata save |

### DashboardCatalogRow (`nightshift.dashboards.dashboards[]`) — extended

| Field     | Type                   | Rules                                              |
| --------- | ---------------------- | -------------------------------------------------- |
| `name`    | string                 | Unique in merged catalog                           |
| `title`   | string                 | `title ?? name`                                    |
| `source`  | `'built-in' \| 'user'` | `user` if file exists in dashboards dir for name   |
| `active`  | boolean                | `name === nightshift.dashboard.active`             |
| `theme`   | string?                | For edit round-trip; may be `''`                   |
| `refresh` | number?                | Optional                                           |
| `rows`    | array?                 | Full payload for duplicate/edit preserve-rows save |

### DashboardDraft (UI-only)

| Field     | Type         | Rules                                                    |
| --------- | ------------ | -------------------------------------------------------- |
| `name`    | string       | Editable only on create; `/^[a-z][a-z0-9-]*$/`           |
| `title`   | string       | Display title; empty → omit on save                      |
| `theme`   | string       | Empty → omit on save                                     |
| `refresh` | string       | Empty → omit; else positive integer                      |
| `rows`    | `RowSpec[]?` | Copied from catalog on edit/duplicate; preserved on save |

### Active snapshot (`nightshift.dashboard`) — new

| Field    | Type           | Rules                                 |
| -------- | -------------- | ------------------------------------- |
| `active` | string \| null | Currently open dashboard name on Home |
| `title`  | string \| null | Display title of active dashboard     |

Publisher: `DashboardApp` on switch (via runtime callback or direct entity set from host). Consumer: Dashboards list ● column, optional header hints.

### BLANK_DASHBOARD template (code constant)

| Field     | Value                                                           |
| --------- | --------------------------------------------------------------- |
| `name`    | from draft                                                      |
| `title`   | from draft or name                                              |
| `version` | `DASHBOARD_SCHEMA_VERSION`                                      |
| `rows`    | `[{ widgets: [{ type: 'core.note', options: { text: '' } }] }]` |

## Validation rules

1. Create name: non-empty, kebab-case regex; unique preferred (save may override built-in with confirm).
2. `draftToSaveArgs`: parse refresh as non-negative integer or error.
3. Host `dashboard.save`: round-trip `parseDashboard(serializeDashboard(...))` before write; merge rows from draft or existing file.
4. `dashboard.delete`: only if user file exists for name; if deleting active dashboard, switch to fallback (`config.defaultDashboard` if still available, else first catalog entry).
5. Built-in delete refused when no user file.

## State transitions

```text
[list] --Add--> [create draft] --Save ok--> [list + catalog refresh + dashboard.open.* refresh]
[list] --Edit--> [edit draft] --Save ok--> [list + catalog refresh; Home updates if active]
[list] --Open/Enter--> dashboard.open.<name> --> [Home shows dashboard; active entity updated]
[list] --Duplicate--> [create draft prefilled]
[list] --Delete user--> confirm --> [list + file gone + open commands refresh]
[create|edit] --Cancel/Esc--> [list] (discard)
```

## Persistence mapping

| Layer    | Location                                                 | Contents                                    |
| -------- | -------------------------------------------------------- | ------------------------------------------- |
| File     | `dashboards/<name>.yaml`                                 | Serialized DashboardSpec                    |
| Memory   | `runtime.dashboards` / `DashboardApp` state              | Merged built-in + user specs                |
| Entity   | `nightshift.dashboards`                                  | Catalog rows                                |
| Entity   | `nightshift.dashboard`                                   | `{ active, title }` session snapshot        |
| Config   | `config.json` `defaultDashboard`                         | Startup default (unchanged in v1 open flow) |
| Commands | `dashboard.save`, `dashboard.delete`, `dashboard.open.*` | Mutations / navigation                      |

## Integration with Vibe editor

`VibeEditor` dashboard picker continues to read `nightshift.dashboards.dashboards[]` — only `name` and `title` required for display. Catalog refresh after `dashboard.save` / `dashboard.delete` keeps picker in sync without restart.
