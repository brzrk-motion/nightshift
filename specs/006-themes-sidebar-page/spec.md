# Feature Specification: Themes Sidebar Page

**Feature Branch**: `006-themes-sidebar-page`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Let's create a new page the same way we did for dashboards but for themes. Themes should be able to be created, made active and new themes should be created from a basic theme editor UI. Themes should be simple with just a few colors and the UI should be intutive, with color pickers, etc if possible. Themes created should also be saved locally the same way dashboards and vibes are."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse and activate themes from the shell (Priority: P1)

A user opens Nightshift and navigates to a new **Themes** item in the sidebar. They see every theme Nightshift knows about — built-in and user-created — in a table with an active indicator. They select one and choose **Activate** (or press Enter) to apply it immediately across the shell, dashboards, and widgets.

**Why this priority**: Without list + activate, the new nav destination delivers no value; the workspace must reflect the user's choice immediately.

**Independent Test**: Open Nightshift → Themes screen → select a theme → Activate → confirm header, nav rail, and Home canvas colors change without restart.

**Acceptance Scenarios**:

1. **Given** Nightshift is running with built-in themes (`midnight`, `ember`, `daylight`), **When** the user opens the Themes screen, **Then** they see a list of themes including name and which one is currently active (●).
2. **Given** the user selects a theme in the list, **When** they activate it, **Then** the entire shell re-renders with that palette without restarting the app.
3. **Given** the user activates a theme, **When** they quit and restart Nightshift, **Then** the same theme is restored from `config.json`.

---

### User Story 2 - Create and edit custom themes with a simple color editor (Priority: P1)

A user on the Themes screen chooses **Add**, enters a unique kebab-case name, picks **dark** or **light** appearance, and adjusts a small set of palette colors using hex fields with live swatch previews. They save. Nightshift writes a theme YAML file and registers the theme. The new theme appears in the list and in vibe/dashboard theme pickers.

**Why this priority**: Creating themes is the core new capability; persistence and catalog sync are required for it to stick.

**Independent Test**: Add theme `forest` with custom accent → confirm `themes/forest.yaml` exists → confirm it appears on Themes list and in Vibe/Dashboard editor theme dropdowns → activate it → colors change.

**Acceptance Scenarios**:

1. **Given** the user is on the Themes list, **When** they choose Add and save a valid name with at least the required colors, **Then** a YAML file is written under the config themes directory and the list refreshes.
2. **Given** a newly created theme, **When** the user opens the Vibes or Dashboards editor, **Then** the theme appears in the theme picker alongside built-ins.
3. **Given** the user edits an existing user theme's colors, **When** they save, **Then** the YAML on disk updates; if that theme is currently active, the live palette updates immediately.

---

### User Story 3 - Manage user themes (Priority: P2)

A user duplicates an existing theme as a starting point, or deletes a user theme they no longer need. Built-in themes cannot be deleted; user files may override built-in names following the same merge rule as dashboards and vibes.

**Why this priority**: Parity with Dashboards/Vibes UX; secondary to create + activate.

**Independent Test**: Duplicate `ember` → save as `ember-warm` → delete `ember-warm` → file removed, catalog updated.

**Acceptance Scenarios**:

1. **Given** a user theme in the list, **When** the user duplicates it, **Then** a create form opens prefilled except for name, and save produces a new file.
2. **Given** a pure built-in theme with no user file, **When** the user attempts delete, **Then** the action is refused with a clear message.
3. **Given** a user theme file, **When** the user confirms delete, **Then** the file is removed, `theme.activate.*` commands refresh, and pickers update.

---

### Edge Cases

- What happens when the user creates a theme whose name collides with a built-in? — Treat as override (same merge rule as dashboards/vibes); confirm before overwriting on create.
- What happens when the active theme is deleted? — Fall back to `config.json` default or `midnight`; shell must not crash.
- What happens when YAML on disk fails to parse? — Soft-fail with warning toast; broken file omitted from catalog (existing load behavior).
- What happens when a color field is invalid hex? — Editor validation blocks save with a toast; no partial file write.
- What happens when the terminal is too narrow? — Themes list/editor use the same responsive conventions as Dashboards/Vibes (toolbar, scroll, keyboardCapture on TextInput).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A new sidebar screen **Themes** MUST appear in the nav rail using the same list + in-screen editor UX patterns as the Dashboards and Vibes screens (table, full-width action bar, Add/Edit/Activate/Duplicate/Delete).
- **FR-002**: The Themes screen MUST read catalog state from `nightshift.themes` and MUST NOT import theme parse/save routines or touch the filesystem directly.
- **FR-003**: Users MUST be able to create a new theme with name (`/^[a-z][a-z0-9-]*$/`), `appearance` (`dark` | `light`), and the full `ThemeColors` palette; save MUST persist via a host command to `themes/<name>.yaml`.
- **FR-004**: Users MUST be able to activate a theme from the list, applying it immediately via the existing theme engine and persisting the choice to `config.json` `theme`.
- **FR-005**: Saving, deleting, and catalog refresh MUST go through new hidden host commands (`theme.save`, `theme.delete`) mirroring `dashboard.save` / `vibe.save`.
- **FR-006**: Every theme in the catalog (built-in and user) MUST appear in vibe editor, dashboard editor, and command palette theme pickers (`runtime.themes.list()` refreshed after mutations).
- **FR-007**: The theme editor MUST expose all `ThemeColors` fields with hex text inputs, inline swatch previews, and grouped labels (Background, Text, Accents, Status); keyboard navigation MUST respect `keyboardCapture`.
- **FR-008**: Built-in themes MUST NOT be deletable without a user file; deleting a user file MUST re-register the built-in if one exists.
- **FR-009**: Renaming a theme name on create is allowed; on edit the name field is locked (same as vibes/dashboards).
- **FR-010**: The Settings screen theme list MUST be removed or reduced to a link/hint pointing users to the Themes screen (avoid duplicate activation UX).

### Key Entities _(include if feature involves data)_

- **ThemeSpec**: Canonical on-disk theme model (name, appearance, colors) — aligned with `Theme` in `@nightshift/ui`.
- **ThemeCatalogRow**: Row in `nightshift.themes` — name, title/display, source (`built-in` | `user`), active (matches current theme), appearance, colors payload for edit round-trip.
- **ThemeDraft**: UI-only editor state for create/edit (name, appearance, color hex strings per field).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can create a named custom theme and see it applied within two actions (save → Activate).
- **SC-002**: 100% of user-created themes appear in vibe and dashboard theme pickers after save without restart.
- **SC-003**: Theme list and editor match Dashboards/Vibes interaction patterns (same toolbar affordances and keyboard shortcuts documented in help).
- **SC-004**: Invalid save/delete operations surface toast errors and leave no partial/corrupt files.
- **SC-005**: Deleting the active theme leaves Nightshift showing a valid fallback theme.

## Assumptions

- Theme palette scope is the existing `ThemeColors` interface (11 hex colors + appearance) — no fonts, spacing, or per-component tokens in v1.
- Terminal "color pickers" are hex `TextInput` fields with adjacent swatch previews and optional preset shortcuts — not a graphical HSV wheel (OpenTUI limitation).
- New themes start from a **Duplicate from midnight** or **blank-from-midnight** default on Add; user can change all colors before save.
- Nav order after Home/Dashboards: Dashboards, Vibes, **Themes**, Apps, Entities, Automations, Settings (Themes placed after Vibes, before Apps — mirrors content-type grouping).
- `themesDir` is added to `NightshiftPaths` as `<configDir>/themes/`, created on first save like dashboards/vibes dirs.
- Activating a theme updates `config.json` `theme` via settings store (same persistence model as changing default dashboard is deferred for dashboards — here activation SHOULD persist because themes are global preferences).
