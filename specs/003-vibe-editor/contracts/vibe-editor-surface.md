# Contract: Vibe editor host surface

**Feature**: `003-vibe-editor`  
**Audience**: Vibes screen (`packages/ui`), CLI runtime, vibe YAML authors  
**Transport**: In-process commands + entity store (no HTTP)

## Entities

| Id                      | Publisher         | Shape                                               | Consumers                      |
| ----------------------- | ----------------- | --------------------------------------------------- | ------------------------------ |
| `nightshift.vibe`       | CLI runtime       | `{ active: string \| null, title: string \| null }` | Header, catalog `active` flags |
| `nightshift.vibes`      | CLI runtime       | `{ vibes: VibeCatalogRow[] }`                       | VibesScreen list + edit load   |
| `nightshift.dashboards` | CLI runtime (new) | `{ dashboards: { name, title }[] }`                 | VibeEditor dashboard picker    |

UI MUST NOT import `@nightshift/vibes` or read `vibesDir`.

## Commands

### `vibe.save` (exists; keep hidden)

| Arg            | Type   | Required | Description                                     |
| -------------- | ------ | -------- | ----------------------------------------------- |
| `name`         | string | yes      | `/^[a-z][a-z0-9-]*$/`                           |
| `title`        | string | no       |                                                 |
| `description`  | string | no       |                                                 |
| `theme`        | string | no       |                                                 |
| `dashboard`    | string | no       |                                                 |
| `entities`     | object | no       | Opaque map; preserved from catalog when editing |
| `onActivate`   | array  | no       | `{ command, args? }[]`                          |
| `onDeactivate` | array  | no       | `{ command, args? }[]`                          |

**Effect**: Validate via serialize→parse → `saveVibe(vibesDir)` → `engine.register` → ensure `vibe.activate.<name>` → mark source user → `publishVibesCatalog` → success toast.

**Errors**: `CONFIG_INVALID` / `CONFIG_UNWRITABLE` → command `failed` → AppShell danger toast; no partial file from failed validate (validate before write).

### `vibe.delete` (new; hidden)

| Arg    | Type   | Required | Description |
| ------ | ------ | -------- | ----------- |
| `name` | string | yes      | Vibe name   |

**Effect**: If no user file for name → error “built-in vibes cannot be deleted” (or “no user vibe file”). Else delete `vibes/<name>.yaml` → unregister/re-register built-in if any → unregister activate command if vibe gone → refresh catalog → toast.

### `vibe.activate.<name>` (exists)

Unchanged. List Activate / Enter runs this id.

## UI flow contract

```text
VibesScreen view:
  list | create(draft) | edit(draft)

Toolbar (list, full-width bar): Add | Edit | Activate | Duplicate | Delete
Editor sections: Identity | Look (theme/dashboard pickers) | onActivate | onDeactivate | Summary
Save → vibe.save(draftToSaveArgs(draft))
Cancel → list
```

## Picker data sources

| Field     | Source                                                                    |
| --------- | ------------------------------------------------------------------------- |
| Theme     | `runtime.themes.list()` → names                                           |
| Dashboard | `nightshift.dashboards` entity                                            |
| Commands  | `runtime.commands.search(query)` / `list()` excluding `hidden` by default |

## File format

Unchanged from vibe guide / `VibeSpec`. Machine writes canonical YAML via `serializeVibe` (object actions when args present; bare string when not).
