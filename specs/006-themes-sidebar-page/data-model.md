# Data Model: Themes Sidebar Page

**Feature**: `006-themes-sidebar-page` | **Date**: 2026-08-12

## Overview

Canonical durable model is `ThemeSpec` on disk (aligned with `Theme` in `@nightshift/ui`). The Themes screen edits a `ThemeDraft` (all colors as hex strings + appearance), converts to save args, and the host validates via serialize→parse. Catalog is an entity projection for the shell. Built-in themes (`midnight`, `ember`, `daylight`) ship in code; user files merge by name.

## Entities

### ThemeSpec (file + engine) — aligned with `Theme`

| Field        | Type                | Rules                                                            |
| ------------ | ------------------- | ---------------------------------------------------------------- |
| `name`       | string              | Non-empty kebab-case; filename stem `<name>.yaml`                |
| `appearance` | `'dark' \| 'light'` | Required                                                         |
| `colors`     | `ThemeColors`       | All 11 keys required on save; each value `#rrggbb` lowercase hex |

#### ThemeColors keys (fixed set)

| Key               | Role                      |
| ----------------- | ------------------------- |
| `background`      | App canvas                |
| `surface`         | Panels, cards             |
| `border`          | Primary borders           |
| `borderMuted`     | Dividers, inactive chrome |
| `text`            | Primary text              |
| `muted`           | Secondary text            |
| `accent`          | Active/selected           |
| `accentSecondary` | Brand chrome              |
| `success`         | Positive status           |
| `warning`         | Caution status            |
| `danger`          | Error/destructive         |

### ThemeCatalogRow (`nightshift.themes.themes[]`) — new

| Field        | Type                   | Rules                                        |
| ------------ | ---------------------- | -------------------------------------------- |
| `name`       | string                 | Unique in merged catalog                     |
| `source`     | `'built-in' \| 'user'` | `user` if file exists in themes dir for name |
| `active`     | boolean                | `name === app.themes.current.name`           |
| `appearance` | `'dark' \| 'light'`    |                                              |
| `colors`     | `ThemeColors`          | Full palette for edit round-trip             |

### ThemeDraft (UI-only)

| Field        | Type                            | Rules                                                         |
| ------------ | ------------------------------- | ------------------------------------------------------------- |
| `name`       | string                          | Editable only on create; `/^[a-z][a-z0-9-]*$/`                |
| `appearance` | `'dark' \| 'light'`             | SelectField                                                   |
| `colors`     | `Record<ThemeColorKey, string>` | Each value validated as hex on save; editor shows live swatch |

### Active snapshot

Active theme is derived from `app.themes.current` and mirrored in catalog `active` flags. No separate `nightshift.theme` entity in v1 (unlike `nightshift.dashboard`) — global theme is not per-dashboard session state; `config.json` `theme` is the durable default.

## Validation rules

1. Create name: non-empty, kebab-case regex; unique preferred (save may override built-in with confirm).
2. `draftToSaveArgs`: every color key present and matching `/^#[0-9a-f]{6}$/` or throw human-readable Error.
3. Host `theme.save`: round-trip `parseTheme(serializeTheme(...))` before write; `engine.register(spec)`.
4. `theme.delete`: only if user file exists for name; if deleting active theme, activate fallback (`config.theme` if registered, else `midnight`) and persist config.
5. Built-in delete refused when no user file.

## State transitions

```text
[list] --Add--> [create draft from midnight] --Save ok--> [list + catalog refresh + theme.activate.* refresh]
[list] --Edit--> [edit draft] --Save ok--> [list + engine register; if active, live palette updates]
[list] --Activate/Enter--> theme.activate.<name> --> [engine activate + config persist + catalog active flags]
[list] --Duplicate--> [create draft prefilled]
[list] --Delete user--> confirm --> [list + file gone + activate commands refresh]
[create|edit] --Cancel/Esc--> [list] (discard)
```

## Persistence mapping

| Layer    | Location                                         | Contents                      |
| -------- | ------------------------------------------------ | ----------------------------- |
| File     | `themes/<name>.yaml`                             | Serialized ThemeSpec          |
| Memory   | `app.themes` registry                            | Merged built-in + user themes |
| Entity   | `nightshift.themes`                              | Catalog rows                  |
| Config   | `config.json` `theme`                            | Last activated theme name     |
| Commands | `theme.save`, `theme.delete`, `theme.activate.*` | Mutations / activation        |

## Integration with pickers

`VibeEditor` and `DashboardEditor` theme dropdowns read `runtime.themes.list()` — refreshed when `theme.save` / `theme.delete` re-register themes. Catalog entity refresh keeps Themes list ● column in sync.

## DEFAULT_THEME_TEMPLATE (code constant)

Seeds new drafts — copy of `MIDNIGHT_THEME` with `name: ''` in draft only; on save name comes from draft.
