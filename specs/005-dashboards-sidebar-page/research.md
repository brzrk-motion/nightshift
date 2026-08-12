# Research: Dashboards Sidebar Page

**Feature**: `005-dashboards-sidebar-page` | **Date**: 2026-08-12

## Decision: Mirror Vibes screen architecture for Dashboards

**Rationale**: User explicitly requested same UI conventions. `VibesScreen` / `VibesList` / `VibeEditor` / `vibeDraft` already establish list ↔ in-screen editor state machine, toolbar, table columns, modals for delete/override, and command bridge — copy that shape as `DashboardsScreen` / `DashboardsList` / `DashboardEditor` / `dashboardDraft`.

**Alternatives considered**:
- Reuse `DashboardApp` edit mode for creation — edit mode is widget layout; wrong mental model for naming/creating files.
- Single combined dashboard+vibe admin screen — violates nav clarity.

## Decision: Metadata-only editor on Dashboards screen; widget layout stays on Home

**Rationale**: `DashboardApp` already has a full widget editor (`e` on Home). Duplicating row/widget editing in the catalog screen would fork UX and code. Dashboards page edits name, title, theme, refresh — the fields that define the YAML header — while rows are edited on Home or hand-edited in YAML.

**Alternatives considered**:
- Full layout editor in Dashboards screen — large scope; duplicates `DashboardApp`.
- YAML text editor — unfriendly; against vibes precedent.

## Decision: Blank dashboard = minimal valid `DashboardSpec` with one placeholder row

**Rationale**: `parseDashboard` requires non-empty `rows`. A programmatic `BLANK_DASHBOARD(name, title)` constant (e.g. one `core.note` widget with empty/neutral text) satisfies validation and gives Home edit mode a anchor to add widgets.

**Alternatives considered**:
- Relax parse rules for empty rows — breaks existing YAML contract and tests.
- Clone `DEFAULT_DASHBOARD` — not blank; ships widgets user did not ask for.

## Decision: Host commands `dashboard.save` and `dashboard.delete` in CLI runtime

**Rationale**: Same bridge as `vibe.save` / `vibe.delete`. UI never imports `@nightshift/dashboard` parse/save. Commands validate via serialize→parse, write file, merge into in-memory dashboard list, re-register `dashboard.open.*`, refresh `nightshift.dashboards`.

**Alternatives considered**:
- UI calls `saveDashboard` through a React prop from CLI — second channel beside entities.
- Plugin for dashboard CRUD — dashboards are host concepts.

## Decision: Enrich `nightshift.dashboards` catalog; track active via session + entity

**Rationale**: Vibe editor already reads `{ dashboards: { name, title }[] }`. Extend rows to `{ name, title, source, active, theme?, refresh?, rows? }` for list/edit round-trip (rows optional in catalog for metadata-only editor — preserve rows from file on save). Active flag comes from `DashboardApp`'s open dashboard synced to `nightshift.dashboard` entity `{ active, title }` on switch (mirrors `nightshift.vibe`).

**Alternatives considered**:
- Separate `nightshift.dashboard.catalog` entity — unnecessary split.
- Infer active only from React state inside Home — Dashboards screen could not show ● without entity bridge.

## Decision: "Open" / activate runs `dashboard.open.<name>` (session switch)

**Rationale**: `DashboardApp` already registers per-dashboard open commands and maintains `active` state. Dashboards list Enter/Open invokes the same command Home uses — one code path, palette-compatible.

**Alternatives considered**:
- New `dashboard.activate` command — redundant with existing `dashboard.open.*`.
- Only update `config.defaultDashboard` — does not switch Home until restart; fails user expectation.

## Decision: Nav — Home first, Dashboards second (above Vibes)

**Rationale**: User spec: new Dashboards above Vibes; current dashboard item becomes Home. Implement by changing `AppShell` dashboard screen label to `Home` and inserting `DashboardsScreen` as first entry in `DEFAULT_SCREENS`.

**Alternatives considered**:
- Dashboards replaces Home — loses always-visible canvas nav item.

## Decision: Add `deleteDashboard` in `packages/dashboard/src/parse.ts`

**Rationale**: Symmetric with `deleteVibe`. Refuse when no user file (`ENOENT` → `DASHBOARD_NOT_FOUND`). After delete, runtime re-merges built-ins and unregisters stale `dashboard.open.*`.

**Alternatives considered**:
- Delete via raw fs in CLI only — skips validate/merge centralization.

## Decision: Built-in override confirmation on create (same as vibes)

**Rationale**: Saving `home.yaml` overrides built-in `home`. `VibesScreen` already prompts when create collides with built-in source — reuse Modal pattern.

**Alternatives considered**:
- Silent override — surprising data loss risk.

## Decision: Duplicate prefills metadata; save creates new file with cleared name

**Rationale**: Identical to `duplicateDraft` in vibes. Rows copied from catalog payload so duplicate is a real fork.

**Alternatives considered**:
- Duplicate via filesystem copy only — bypasses validation and catalog refresh.
