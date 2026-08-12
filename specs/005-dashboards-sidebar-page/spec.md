# Feature Specification: Dashboards Sidebar Page

**Feature Branch**: `005-dashboards-sidebar-page`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Let's add a new page to the sidebar named Dashboards above vibes, and the current dashboard menu item will change to Home. The dashboards page will work just like the vibes page but will allow you to create new blank dashboards, name them, and set them as the active dashboard. All dashboards created should show up in the dropdown in the vibe editor as well, and they should all be saved to dashboard config files as well. Let's use the same UI conventions we used for the vibes page"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and switch dashboards from the shell (Priority: P1)

A user opens Nightshift and navigates to a new **Dashboards** item in the sidebar (above Vibes). They see every dashboard Nightshift knows about — built-in and user-created — in a table with an active indicator. They select one and choose **Open** (or press Enter) to make it the dashboard shown on **Home**.

**Why this priority**: Without list + switch, the new nav destination delivers no value; Home must reflect the user's choice immediately.

**Independent Test**: Open Nightshift → Dashboards screen → select a dashboard → Open → return to Home → that dashboard's title and layout appear.

**Acceptance Scenarios**:

1. **Given** Nightshift is running with at least the built-in `home` dashboard, **When** the user opens the Dashboards screen, **Then** they see a list of dashboards including name/title and which one is currently open on Home.
2. **Given** the user selects a dashboard in the list, **When** they activate/open it, **Then** the Home canvas switches to that dashboard without restarting the app.
3. **Given** the user is on any shell screen, **When** they use the first nav item (**Home**), **Then** they see the currently open dashboard canvas (not the catalog).

---

### User Story 2 - Create and name blank dashboards (Priority: P1)

A user on the Dashboards screen chooses **Add**, enters a unique kebab-case name and display title, and saves. Nightshift creates a new blank dashboard YAML file and adds it to the catalog. The new dashboard appears in the list and in the vibe editor's dashboard picker.

**Why this priority**: Creating dashboards is the core new capability; persistence and catalog sync are required for it to stick.

**Independent Test**: Add dashboard `work` → confirm `dashboards/work.yaml` exists → confirm it appears on Dashboards list and in Vibe editor dashboard dropdown.

**Acceptance Scenarios**:

1. **Given** the user is on the Dashboards list, **When** they choose Add and save a valid name/title, **Then** a YAML file is written under the config dashboards directory and the list refreshes.
2. **Given** a newly created dashboard, **When** the user opens the Vibes editor, **Then** the dashboard appears in the dashboard picker alongside built-ins and other user dashboards.
3. **Given** a blank dashboard was created, **When** the user opens it on Home, **Then** they see an empty/minimal layout they can populate via existing Home edit mode (`e`).

---

### User Story 3 - Edit metadata and manage user dashboards (Priority: P2)

A user edits an existing user dashboard's title (and name on create-only flow), duplicates a dashboard as a starting point, or deletes a user dashboard they no longer need. Built-in dashboards cannot be deleted; user overrides of built-ins follow the same override rules as today.

**Why this priority**: Parity with the Vibes screen UX; secondary to create + switch.

**Independent Test**: Duplicate `home` override → save as `focus-board` → delete `focus-board` → file removed, catalog updated.

**Acceptance Scenarios**:

1. **Given** a user dashboard in the list, **When** the user edits and saves title changes, **Then** the YAML on disk updates and the catalog reflects the new title.
2. **Given** a catalog row, **When** the user duplicates it, **Then** a create form opens prefilled except for name, and save produces a new file.
3. **Given** a pure built-in dashboard with no user file, **When** the user attempts delete, **Then** the action is refused with a clear message.
4. **Given** a user dashboard file, **When** the user confirms delete, **Then** the file is removed, `dashboard.open.*` commands refresh, and vibes referencing it are unaffected (may warn on activate).

---

### Edge Cases

- What happens when the user creates a dashboard whose name collides with a built-in? — Treat as override (same merge rule as today); confirm before overwriting on create.
- What happens when the open/active dashboard is deleted? — Fall back to `config.defaultDashboard` or first available; Home must not crash.
- What happens when YAML on disk fails to parse? — Soft-fail with warning toast; broken file omitted from catalog (existing load behavior).
- What happens when the terminal is too narrow? — Dashboards list/editor use the same responsive conventions as Vibes (toolbar, scroll, keyboardCapture on TextInput).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The first sidebar nav item MUST be labeled **Home** and MUST render the live dashboard canvas (current `DashboardApp` content).
- **FR-002**: A new sidebar screen **Dashboards** MUST appear directly above **Vibes**, using the same list + in-screen editor UX patterns as the Vibes screen (table, full-width action bar, Add/Edit/Duplicate/Delete/Open).
- **FR-003**: The Dashboards screen MUST read catalog state from `nightshift.dashboards` and MUST NOT import `@nightshift/dashboard` parse/save routines directly.
- **FR-004**: Users MUST be able to create a new blank dashboard with name (`/^[a-z][a-z0-9-]*$/`) and optional title; save MUST persist via a host command to `dashboards/<name>.yaml`.
- **FR-005**: Users MUST be able to open/activate a dashboard from the list, switching the Home canvas via existing `dashboard.open.<name>` commands.
- **FR-006**: Saving, deleting, and catalog refresh MUST go through new hidden host commands (`dashboard.save`, `dashboard.delete`) mirroring `vibe.save` / `vibe.delete`.
- **FR-007**: Every dashboard in the catalog (built-in and user) MUST appear in the vibe editor dashboard picker (`nightshift.dashboards`).
- **FR-008**: Renaming a dashboard name on create is allowed; on edit the name field is locked (same as vibes).
- **FR-009**: Built-in dashboards MUST NOT be deletable without a user file; deleting a user file MUST re-register the built-in if one exists.
- **FR-010**: Keyboard navigation on the Dashboards list MUST match Vibes conventions (`j`/`k`, Enter to open, `a` add, `e` edit) and MUST respect `keyboardCapture` while typing in the editor.

### Key Entities *(include if feature involves data)*

- **DashboardSpec**: Canonical on-disk dashboard model (name, title, theme, rows, …) — unchanged schema.
- **DashboardCatalogRow**: Row in `nightshift.dashboards` — name, title, source (`built-in` | `user`), active (matches Home canvas), optional payload for edit round-trip.
- **DashboardDraft**: UI-only editor state for create/edit metadata (not widget layout — layout editing stays on Home edit mode).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a named blank dashboard and see it on Home within two nav actions (save → Home).
- **SC-002**: 100% of user-created dashboards appear in the vibe editor dashboard picker after save without restart.
- **SC-003**: Dashboard list and editor match Vibes screen interaction patterns (same toolbar affordances and keyboard shortcuts documented in help).
- **SC-004**: Invalid save/delete operations surface toast errors and leave no partial/corrupt files.
- **SC-005**: Deleting the active dashboard leaves Home showing a valid fallback dashboard.

## Assumptions

- Widget layout editing remains on **Home** edit mode; the Dashboards screen edits identity/metadata only (name/title/theme/refresh), not row/widget placement — matching how Vibes edits orchestration, not widget layout.
- Blank dashboard means a valid minimal `DashboardSpec` (one placeholder row) satisfying existing parse rules requiring non-empty `rows`.
- "Active dashboard" means the dashboard currently open on Home (session state), surfaced in the catalog; optionally also updates `config.defaultDashboard` when user explicitly sets default (P2 — defer explicit "set as default on launch" toggle unless needed; **Open** is sufficient for v1).
- Nav order: Home, Dashboards, Vibes, Apps, Entities, Automations, Settings.
