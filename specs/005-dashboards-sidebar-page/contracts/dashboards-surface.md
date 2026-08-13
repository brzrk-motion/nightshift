# Contract: Dashboards host surface

**Feature**: `005-dashboards-sidebar-page`  
**Audience**: Dashboards screen (`packages/ui`), CLI runtime, `DashboardApp`, vibe editor picker  
**Transport**: In-process commands + entity store (no HTTP)

## Entities

| Id                      | Publisher                    | Shape                                               | Consumers                                      |
| ----------------------- | ---------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| `nightshift.dashboard`  | `DashboardApp` / CLI runtime | `{ active: string \| null, title: string \| null }` | Dashboards list active column, optional header |
| `nightshift.dashboards` | CLI runtime                  | `{ dashboards: DashboardCatalogRow[] }`             | DashboardsScreen, VibeEditor picker            |

UI MUST NOT import `@nightshift/dashboard` or read `dashboardsDir` directly.

### DashboardCatalogRow (JSON)

```typescript
{
  name: string;
  title: string;
  source: 'built-in' | 'user';
  active: boolean;
  theme?: string;
  refresh?: number;
  rows?: RowSpec[]; // optional; present for edit/duplicate round-trip
}
```

## Commands

### `dashboard.save` (new; hidden)

| Arg       | Type   | Required | Description                                                  |
| --------- | ------ | -------- | ------------------------------------------------------------ |
| `name`    | string | yes      | `/^[a-z][a-z0-9-]*$/`                                        |
| `title`   | string | no       |                                                              |
| `theme`   | string | no       |                                                              |
| `refresh` | number | no       | Non-negative integer                                         |
| `rows`    | array  | no       | Row specs; if omitted on edit, host loads existing file rows |

**Effect**: Validate via serialize→parse → `saveDashboard(dashboardsDir)` → update in-memory merged list → re-register `dashboard.open.*` → `publishDashboardsCatalog` → if saved dashboard is active, refresh Home canvas → success toast.

**Errors**: `CONFIG_INVALID` / `CONFIG_UNWRITABLE` → command failed → danger toast.

### `dashboard.delete` (new; hidden)

| Arg    | Type   | Required | Description    |
| ------ | ------ | -------- | -------------- |
| `name` | string | yes      | Dashboard name |

**Effect**: If no user file → error "built-in dashboards cannot be deleted". Else delete file → re-merge built-ins → unregister/register open commands → if deleted was active, open fallback → refresh catalog → toast.

### `dashboard.open.<name>` (existing)

Unchanged. Registered per dashboard. Dashboards list **Open** / Enter runs this id. Updates `DashboardApp` active state and `nightshift.dashboard` entity.

## UI flow contract

```text
Nav order: Home | Dashboards | Vibes | Apps | Entities | Automations | Settings

DashboardsScreen view:
  list | create(draft) | edit(draft)

Toolbar (list, full-width bar): Add | Edit | Open | Duplicate | Delete
Editor sections: Identity (name/title) | Look (theme, refresh) | Save/Cancel bar
Save → dashboard.save(draftToSaveArgs(draft))
Cancel → list
Open → dashboard.open.<selected.name>
```

## Shell changes

| Location                    | Change                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `AppShell` dashboard screen | `label: 'Home'` (was `Dashboard`)                                                         |
| `DEFAULT_SCREENS`           | Insert `{ id: 'dashboards', label: 'Dashboards', render: DashboardsScreen }` before Vibes |
| Footer                      | On Home: dynamic dashboard title; on Dashboards: `"Dashboards"`                           |

## Picker data sources (Dashboards editor)

| Field            | Source                                        |
| ---------------- | --------------------------------------------- |
| Theme            | `runtime.themes.list()`                       |
| List rows        | `nightshift.dashboards`                       |
| Active indicator | `row.active` or `nightshift.dashboard.active` |

## File format

Unchanged dashboard YAML. Machine writes via `serializeDashboard`. Blank create uses `BLANK_DASHBOARD` template per [data-model.md](../data-model.md).

## DashboardApp obligations

On `open(name)`:

1. Set internal active state (existing).
2. Update `nightshift.dashboard` entity `{ active: name, title }`.
3. Trigger catalog republish or patch `active` flags on `nightshift.dashboards` rows.

Host may pass `onSwitch` from runtime to centralize entity updates.
