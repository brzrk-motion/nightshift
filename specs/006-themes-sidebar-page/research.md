# Research: Themes Sidebar Page

**Feature**: `006-themes-sidebar-page` | **Date**: 2026-08-12

## Decision: Mirror Dashboards/Vibes screen architecture for Themes

**Rationale**: User explicitly requested the same approach as dashboards. `DashboardsScreen` / `DashboardsList` / `DashboardEditor` / `dashboardDraft` already establish list ↔ in-screen editor state machine, toolbar, table columns, modals for delete/override, and command bridge — copy as `ThemesScreen` / `ThemesList` / `ThemeEditor` / `themeDraft`.

**Alternatives considered**:

- Extend Settings screen with an editor — Settings is for global prefs; theme CRUD deserves its own nav destination and toolbar parity.
- YAML text editor — unfriendly; against vibes/dashboards precedent.

## Decision: Theme file I/O in `packages/ui/src/theme/parse.ts`

**Rationale**: `Theme`, `ThemeColors`, and `createThemeEngine` already live in `@nightshift/ui`. Dashboards use a dedicated package because they include widget registry and `DashboardApp`; themes are palette data consumed by the shell. CLI runtime already imports `@nightshift/ui` for `createAppRuntime`. Keeping parse/save next to types avoids a new package and dependency churn.

**Alternatives considered**:

- New `@nightshift/themes` package — organizational-only library; YAGNI for 11 colors + YAML.
- Parse in `packages/services` — would pull yaml into services and duplicate Theme types or create an upward dependency.

## Decision: YAML on disk under `themes/<name>.yaml`

**Rationale**: Matches dashboards (`dashboards/`) and vibes (`vibes/`) conventions. Human-editable, forward-compatible, merge-over-built-in by name.

**Alternatives considered**:

- JSON in config.json — does not scale; breaks file-per-artifact pattern.
- Store in plugin storage — themes are host-level, not plugin-owned.

**Example shape**:

```yaml
name: forest
appearance: dark
colors:
  background: '#0a120a'
  surface: '#121a12'
  border: '#243824'
  borderMuted: '#1a241a'
  text: '#e6f0e6'
  muted: '#8b9a8b'
  accent: '#5ad19b'
  accentSecondary: '#7aa2ff'
  success: '#5ad19b'
  warning: '#f2c66b'
  danger: '#ff6b81'
```

## Decision: Terminal color editing = hex TextInput + swatch preview (ColorField)

**Rationale**: OpenTUI has no native color picker widget. Existing controls are `TextInput`, `SelectField`, `Chip`. A `ColorField` component pairing a `#rrggbb` input with a filled block character (`██`) using the parsed color as `fg`/`backgroundColor` gives immediate visual feedback and matches user ask for "color pickers, etc if possible" within terminal constraints. Validate with `/^#[0-9a-f]{6}$/` (same as `theme.test.ts`).

**Alternatives considered**:

- External TUI color picker library — new dependency; uncertain OpenTUI integration.
- RGB decimal fields — harder for users; hex is what built-ins already use.
- Preset-only palette (no free hex) — too limiting for "create custom themes".

## Decision: Host commands `theme.save` and `theme.delete` in CLI runtime

**Rationale**: Same bridge as `dashboard.save` / `vibe.save`. UI never imports parse/save. Commands validate via serialize→parse, write file, register in theme engine, re-register `theme.activate.*`, refresh `nightshift.themes`.

**Alternatives considered**:

- UI calls `saveTheme` through a React prop — second channel beside entities.
- Plugin for theme CRUD — themes are host concepts.

## Decision: `nightshift.themes` catalog entity

**Rationale**: Dashboards and vibes publish catalog entities for shell screens. Extend with `{ themes: ThemeCatalogRow[] }` where rows include `source`, `active`, `appearance`, and full `colors` for edit round-trip.

**Alternatives considered**:

- Read `runtime.themes.list()` directly in screen — bypasses source/active metadata and breaks entity-only screen convention documented in `screens/index.ts`.

## Decision: Move `theme.activate.*` registration from AppShell to runtime with refresh

**Rationale**: `AppShell` registers activate commands once on mount from the initial built-in list. User-created themes would never get palette commands without re-registration. Vibes already register `vibe.activate.*` in `runtime.ts` and refresh on save/delete — mirror that. `AppShell` keeps `theme.next` (cycles list) only.

**Alternatives considered**:

- Single `theme.activate` with `{ name }` arg only — breaks palette discoverability and Settings screen pattern.
- Force AppShell remount on catalog change — heavy-handed.

## Decision: Persist `config.json` `theme` on activate

**Rationale**: Today `SettingsScreen` activates themes session-only; `config.theme` is read at startup. Users expect "make active" to stick across restarts (spec FR-004). `theme.activate.*` handler in runtime calls `saveConfig({ ...config, theme: name })` after `app.themes.activate(name)`.

**Alternatives considered**:

- Session-only activate — fails SC-001 restart acceptance scenario.
- Separate "set as default" toggle — extra UX; activate implies default for global themes.

## Decision: New theme defaults from midnight palette

**Rationale**: `MIDNIGHT_THEME` is the engine fallback and most complete reference palette. Add flow seeds `themeDraft` from midnight colors so users tweak rather than invent 11 fields from scratch. Duplicate flow copies selected row.

**Alternatives considered**:

- Empty colors — invalid until every field filled; bad first-run UX.
- Random palette generator — scope creep.

## Decision: Nav placement — Themes after Vibes, before Apps

**Rationale**: Groups "workspace definition" screens (Dashboards, Vibes, Themes) before "runtime inspection" (Apps, Entities, Automations). Settings remains last for misc prefs.

**Alternatives considered**:

- Themes before Vibes — vibes reference themes; catalog order less important than grouping.
- Themes inside Settings — duplicate UX (FR-010).

## Decision: Settings screen slim-down

**Rationale**: FR-010 removes duplicate theme list. Settings keeps terminal dimensions (`StatRow`) and a one-line hint: "Themes → create and activate palettes" (or similar muted text).

**Alternatives considered**:

- Keep both lists — confusing dual activation paths.

## Decision: Built-in override confirmation on create (same as dashboards/vibes)

**Rationale**: Saving `midnight.yaml` overrides built-in. Reuse Modal pattern from `DashboardsScreen` / `VibesScreen`.

**Alternatives considered**:

- Silent override — surprising.

## Decision: Active theme delete fallback

**Rationale**: On delete of active user theme: activate `config.theme` if still valid, else `midnight`; update catalog active flags; persist config if fallback differs.

**Alternatives considered**:

- Leave engine on deleted theme object in memory — broken resolve on restart.
