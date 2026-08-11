# Feature Specification: User-Friendly Vibe Editor

**Feature Branch**: `003-vibe-editor`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "Let's create a plan to build a much more user friendly vibe editor"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse vibes with clear status (Priority: P1)

A user opens the Vibes screen and sees every vibe in a readable table: display title, theme, dashboard, whether it is built-in or user-owned, and which one is active. They can activate, edit, duplicate, or add a vibe from a full-width top action bar without leaving the screen.

**Why this priority**: Discovery and activation are the everyday path; editing is useless if the catalog is hard to scan.

**Independent Test**: With built-in and at least one user vibe loaded, open Vibes; confirm columns and active marker; activate a row; confirm header and row both reflect active.

**Acceptance Scenarios**:

1. **Given** registered vibes, **When** the user opens Vibes, **Then** each vibe shows title (or name), theme, dashboard, source, and active state.
2. **Given** a selected vibe, **When** the user chooses Activate (or presses Enter), **Then** that vibe becomes active and the catalog updates.
3. **Given** no vibes (edge), **When** the catalog is empty, **Then** an empty state offers Add vibe.
4. **Given** the list view, **When** the user presses Add / Edit / Activate from the top bar, **Then** the matching action runs for create / selected row / selected row.

---

### User Story 2 - Create or edit a vibe without writing YAML (Priority: P1)

A user adds a new vibe or edits an existing one through a guided form that mirrors vibe file concepts (identity, look & layout, activation actions, deactivation actions) without requiring them to know YAML syntax. Saving writes `vibes/<name>.yaml` and refreshes the live catalog.

**Why this priority**: Core ask — replace hand-editing config with a form that still produces the same files.

**Independent Test**: Create a vibe with title, theme, dashboard, and one onActivate command; confirm the YAML file exists and reopening Edit shows the same values; activate it and confirm theme/dashboard/command effects.

**Acceptance Scenarios**:

1. **Given** list view, **When** the user chooses Add vibe, **Then** they enter a create form with empty fields and an editable name.
2. **Given** a selected vibe, **When** the user chooses Edit, **Then** the form loads that vibe’s values; name is locked for existing vibes.
3. **Given** a valid draft, **When** the user saves, **Then** `vibes/<name>.yaml` is written, the catalog refreshes, and the list view returns.
4. **Given** invalid input (bad name, malformed action args), **When** the user tries to save, **Then** a clear error is shown and nothing is written.
5. **Given** editing a vibe that has `entities` in its file, **When** the user saves without opening an entities UI, **Then** those entities are preserved in the written file.

---

### User Story 3 - Pick themes, dashboards, and commands instead of typing ids (Priority: P1)

While editing, the user chooses theme and dashboard from what Nightshift actually has registered, and adds activate/deactivate steps by picking a command (searchable list) rather than typing opaque ids. Optional args remain editable in a structured way (key/value or JSON for advanced cases) with validation before save.

**Why this priority**: Free-text ids are the main unfriendly part of the current editor; pickers remove the need to memorize command and theme names.

**Independent Test**: Open editor; confirm theme list matches registered themes; dashboard list matches known dashboards; command picker lists palette-visible commands; selecting `focus.start` and setting minutes persists correctly in YAML.

**Acceptance Scenarios**:

1. **Given** the editor, **When** the user opens the theme control, **Then** they see registered theme names and can pick one (or clear).
2. **Given** the editor, **When** the user opens the dashboard control, **Then** they see available dashboard names and can pick one (or clear).
3. **Given** an action list, **When** the user adds a command, **Then** they can search/select from registered commands instead of only free-typing.
4. **Given** a selected command with args, **When** the user enters invalid arg JSON/structure, **Then** save is blocked with a field-level or toast error naming the bad row.

---

### User Story 4 - Understand the vibe before saving (Priority: P2)

The editor shows a live plain-language summary of what the vibe will do on activate (theme, dashboard, N commands, entity merges if any) so the user can spot mistakes without reading YAML.

**Why this priority**: Reduces “save and hope”; secondary to being able to edit at all.

**Independent Test**: Change theme and add two onActivate commands; confirm summary updates to mention theme name and command count/titles.

**Acceptance Scenarios**:

1. **Given** a draft with theme + dashboard + actions, **When** the user views the summary, **Then** it reflects those choices in everyday language.
2. **Given** an empty optional field, **When** viewing the summary, **Then** that aspect is omitted rather than shown as blank noise.

---

### User Story 5 - Duplicate and delete user vibes (Priority: P2)

A user can duplicate an existing vibe as a starting point (new name) and delete a user-owned vibe file they no longer want. Built-in vibes cannot be deleted; saving over a built-in name creates/replaces a user override (existing Nightshift rule) with a clear confirm.

**Why this priority**: Common catalog hygiene; not required for first create/edit path.

**Independent Test**: Duplicate `locked-in` to `locked-in-copy`; delete the copy; confirm file removed and catalog updated; attempt delete on pure built-in → refused with explanation.

**Acceptance Scenarios**:

1. **Given** a selected vibe, **When** the user duplicates it, **Then** create form opens with copied fields and an empty/new name.
2. **Given** a user-owned vibe, **When** the user deletes and confirms, **Then** its YAML is removed and it disappears from the catalog (built-in of same name may reappear if applicable).
3. **Given** a built-in with no user override, **When** the user tries to delete, **Then** the action is refused with a clear message.
4. **Given** saving a form whose name matches a built-in, **When** the user saves, **Then** they are warned they are overriding the built-in with a user file.

---

### Edge Cases

- Name must match `^[a-z][a-z0-9-]*$`; reject uppercase, spaces, and empty names on create.
- Concurrent external edit of the YAML file: next save overwrites; no merge (same as dashboard edit mode).
- Command listed in an action but later unregistered: still shown in editor; activation already soft-fails per vibe engine.
- Very long descriptions/command lists: UI remains scrollable / usable; save still succeeds.
- Esc / Cancel discards unsaved draft changes without writing.
- Keyboard capture while focused in text fields must not trigger global nav or list shortcuts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Vibes screen MUST show a full-width top action bar (Add, Edit, Activate, and later Duplicate/Delete as those stories ship) above the catalog.
- **FR-002**: Catalog MUST be driven by the `nightshift.vibes` entity (and active state), not by importing the vibe engine into `packages/ui`.
- **FR-003**: Create/Edit MUST use an in-screen form flow (list ↔ editor), not a new nav-rail destination.
- **FR-004**: Save MUST persist via a host command (`vibe.save`) that writes `vibes/<name>.yaml` using the same schema as hand-edited vibe files.
- **FR-005**: Editor MUST collect identity fields: name (create), title, description.
- **FR-006**: Editor MUST let the user choose theme and dashboard from registered options (with clear/none), not only free text.
- **FR-007**: Editor MUST support ordered onActivate and onDeactivate action lists with add/remove/reorder.
- **FR-008**: Adding an action MUST allow selecting a command from registered commands (searchable); free-type remains available as fallback for advanced users.
- **FR-009**: Action args MUST be editable and validated before save; invalid args MUST not write a file.
- **FR-010**: Saving an edit MUST preserve any `entities` map already on the vibe when the entities UI is not yet implemented or left unchanged.
- **FR-011**: Editor MUST show a live summary of activate effects (P2 story; can ship with stub then enrich).
- **FR-012**: Host MUST support deleting a user vibe file and refreshing the catalog (`vibe.delete` or equivalent).
- **FR-013**: Host MUST support duplicating into a create draft (UI-only is enough if save creates the new file).
- **FR-014**: All failures MUST toast or inline-error without crashing Nightshift.
- **FR-015**: Automated tests MUST cover draft↔save-args shaping, serialize/save round-trips, and catalog publish after save/delete.

### Key Entities *(include if feature involves data)*

- **VibeSpec**: Name, title, description, theme, dashboard, entities, onActivate, onDeactivate (file + engine).
- **Vibe catalog row**: Display projection published on `nightshift.vibes` for the UI.
- **Vibe draft**: In-memory editor state including action drafts and preserved entities.
- **Vibe action**: Command id + optional args object.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can create a vibe with theme + one activate command and save it without opening a YAML file, in under 3 minutes.
- **SC-002**: Theme and dashboard fields are choosable from live registered lists (0 free-typed ids required for the happy path).
- **SC-003**: Round-trip: save then edit shows the same title, theme, dashboard, and actions.
- **SC-004**: Invalid name or invalid action args never produce a partial/corrupt YAML file.
- **SC-005**: `packages/ui` still has no dependency on `@nightshift/vibes` or filesystem APIs for this feature.

## Assumptions

- The v1 table + raw TextInput form + `vibe.save` / `serializeVibe` / `nightshift.vibes` already exist and are the baseline to improve, not replace from scratch.
- In-screen list↔form navigation remains preferred over AppShell push stacks or modals for the editor body.
- Entities map editing can ship after pickers/summary/delete; preservation on save is required in the meantime.
- Reorder of actions is in scope for friendliness (up/down controls); drag-and-drop is out of scope in the terminal.
- Command args UI for v1 of this feature: structured JSON text with validation is acceptable if paired with command picker; per-command arg forms are a later enhancement unless a small common set (e.g. `minutes`) is easy.
