---
description: 'Task list for Dashboards sidebar page implementation'
---

# Tasks: Dashboards Sidebar Page

**Input**: Design documents from `/specs/005-dashboards-sidebar-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboards-surface.md, quickstart.md

**Tests**: Included for `deleteDashboard`, `dashboardDraft` shaping, and catalog publish — plan Technical Context and SC-004 require co-located Vitest coverage.

**Organization**: Phases by user story priority (US1 → US2 → US3). Baseline already has `saveDashboard`, `nightshift.dashboards` (name/title only), `DashboardApp`, and Vibes-screen patterns to mirror.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US3 map to spec.md user stories
- Exact file paths in every task

## Path Conventions

- UI: `packages/ui/src/app/screens/` (+ `packages/ui/src/app/AppShell.tsx`)
- Dashboard IO: `packages/dashboard/src/parse.ts`, `packages/dashboard/src/schema.ts`
- Host bridge: `apps/cli/src/runtime.ts`, `apps/cli/src/commands/dashboard.ts`
- Canvas sync: `packages/dashboard/src/DashboardApp.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline against contracts and prep user-visible release note

- [x] T001 Audit existing dashboard shell surface against `specs/005-dashboards-sidebar-page/contracts/dashboards-surface.md` and note gaps at top of `specs/005-dashboards-sidebar-page/plan.md` Complexity Tracking (or inline comment in `packages/ui/src/app/screens/index.ts`)
- [x] T002 [P] Confirm `packages/ui` has zero imports of `@nightshift/dashboard` under `packages/ui/src/app/screens/` (grep gate; allowed in tests only if mocked)
- [x] T003 [P] Add changeset `.changeset/nightshift-dashboards-sidebar.md` for user-visible Dashboards nav + catalog UX

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Host IO/commands, enriched catalog entities, active-dashboard sync, and draft helpers — required before any user story UI

**CRITICAL**: No Dashboards screen work beyond stubs until this phase completes

- [x] T004 [P] Add `BLANK_DASHBOARD(name, title?)` factory in `packages/dashboard/src/schema.ts` (minimal valid one-row spec per `specs/005-dashboards-sidebar-page/data-model.md`); export from `packages/dashboard/src/index.ts`
- [x] T005 [P] Implement `deleteDashboard(directory, name)` in `packages/dashboard/src/parse.ts` (`DASHBOARD_NOT_FOUND` / `CONFIG_UNWRITABLE`); export from `packages/dashboard/src/index.ts`
- [x] T006 [P] Write Vitest cases for `deleteDashboard` and `BLANK_DASHBOARD` round-trip save in `packages/dashboard/src/parse.test.ts`
- [x] T007 Extend `publishDashboardsCatalog` in `apps/cli/src/runtime.ts` to emit full `DashboardCatalogRow` shape (`source`, `active`, optional `theme`/`refresh`/`rows`) per `specs/005-dashboards-sidebar-page/data-model.md`
- [x] T008 Register `nightshift.dashboard` entity `{ active, title }` in `apps/cli/src/runtime.ts`; initialize from `initial` dashboard passed to `DashboardApp`
- [x] T009 Track `userDashboardNames` set in `apps/cli/src/runtime.ts` (mirror `userVibeNames`) for save/delete source detection
- [x] T010 Register hidden `dashboard.save` command in `apps/cli/src/runtime.ts` per `specs/005-dashboards-sidebar-page/contracts/dashboards-surface.md` (validate serialize→parse, preserve rows when omitted, refresh merged list, re-register `dashboard.open.*`, republish catalog, toast)
- [x] T011 Register hidden `dashboard.delete` command in `apps/cli/src/runtime.ts` (refuse built-in-only, re-merge built-ins, unregister stale open commands, open fallback if active deleted, republish catalog, toast)
- [x] T012 Wire `DashboardApp` `open()` in `packages/dashboard/src/DashboardApp.tsx` to update `nightshift.dashboard` and patch `nightshift.dashboards` `active` flags via `runtime.entities` (or accept `onSwitch` callback from host that performs entity updates)
- [x] T013 Pass entity-sync `onSwitch` from `apps/cli/src/commands/dashboard.ts` when mounting `DashboardApp` so catalog ● stays accurate after palette/Home switches
- [x] T014 [P] Implement `dashboardDraft.ts` helpers (`emptyDraft`, `draftFromCatalog`, `duplicateDraft`, `draftToSaveArgs`, name regex) in `packages/ui/src/app/screens/dashboardDraft.ts`
- [x] T015 [P] Write Vitest for `dashboardDraft` (name validation, refresh parsing, rows preserved on metadata edit) in `packages/ui/src/app/screens/dashboardDraft.test.ts`
- [x] T016 Rename first nav item label to **Home** in `packages/ui/src/app/AppShell.tsx` (`dashboardScreen.label`; keep footer dynamic title on Home)
- [x] T017 Add `DashboardsScreen` stub export and insert `{ id: 'dashboards', label: 'Dashboards', render: DashboardsScreen }` before Vibes in `packages/ui/src/app/screens/index.ts`

**Checkpoint**: `dashboard.save` / `dashboard.delete` callable; enriched `nightshift.dashboards` + `nightshift.dashboard` at runtime; Home nav label updated; `deleteDashboard` tests green

---

## Phase 3: User Story 1 — Browse and switch dashboards (Priority: P1) — MVP

**Goal**: Dashboards list with active indicator; Open/Enter switches Home canvas via `dashboard.open.<name>`

**Independent Test**: Open Dashboards → see catalog with ● on active → Open another → Home shows that dashboard (spec US1)

### Tests for User Story 1

- [x] T018 [P] [US1] Add unit test for catalog active-marker mapping (uses `nightshift.dashboard.active`) in `packages/ui/src/app/screens/dashboardDraft.test.ts` or extracted `dashboardCatalog.test.ts`

### Implementation for User Story 1

- [x] T019 [P] [US1] Implement `DashboardsList.tsx` in `packages/ui/src/app/screens/DashboardsList.tsx`: Table columns (active ●, title, name, source), full-width toolbar (Add / Edit / Open / Duplicate / Delete — wire handlers as no-ops where not yet implemented), keyboard ↑↓/jk, Enter → `dashboard.open.<name>`, `a`/`e` hooks, `keyboardCapture` guard, `useShellContentSize`
- [x] T020 [US1] Implement list-only `DashboardsScreen.tsx` in `packages/ui/src/app/screens/DashboardsScreen.tsx`: read `nightshift.dashboards`, render `DashboardsList`, Open button runs `dashboard.open.<selected>`, empty state with Add CTA
- [x] T021 [US1] Update nav digit/key hints in `packages/ui/src/app/AppShell.tsx` and/or `packages/ui/src/app/HelpOverlay.tsx` for new screen order (Home=1, Dashboards=2, Vibes=3, …) if hard-coded
- [x] T022 [US1] Fix/adjust shell nav tests for Home label and Dashboards insertion in `packages/ui/src/app/shell.test.tsx`

**Checkpoint**: Dashboards list usable; Open switches Home without restart; MVP demo-ready

---

## Phase 4: User Story 2 — Create and name blank dashboards (Priority: P1)

**Goal**: Add flow saves blank dashboard YAML; catalog and vibe picker update

**Independent Test**: Add `work` → `dashboards/work.yaml` exists → appears in Dashboards list and Vibe editor picker → Open on Home shows minimal layout (spec US2)

### Implementation for User Story 2

- [x] T023 [P] [US2] Implement `DashboardEditor.tsx` in `packages/ui/src/app/screens/DashboardEditor.tsx`: Identity (name/title), Look (theme SelectField from `runtime.themes`, refresh text field), responsive layout mirroring `VibeEditor.tsx`, Save/Cancel full-width bar, `keyboardCapture` on TextInput only
- [x] T024 [US2] Extend `DashboardsScreen.tsx` view state machine (`list | create | edit`) and wire Add → create draft → `dashboard.save` on Save per `specs/005-dashboards-sidebar-page/contracts/dashboards-surface.md`
- [x] T025 [US2] Add built-in override confirmation Modal in `DashboardsScreen.tsx` when create name collides with `source: 'built-in'` row (mirror `VibesScreen.tsx` pattern)
- [x] T026 [US2] On successful create, verify `publishDashboardsCatalog` refresh exposes new row to `packages/ui/src/app/screens/VibeEditor.tsx` dashboard SelectField without restart (manual/quickstart step; fix runtime if stale)
- [x] T027 [US2] Ensure `dashboard.save` create path uses `BLANK_DASHBOARD` when draft has no rows in `apps/cli/src/runtime.ts`

**Checkpoint**: Create blank dashboard end-to-end; vibe picker includes new dashboard

---

## Phase 5: User Story 3 — Edit metadata and manage user dashboards (Priority: P2)

**Goal**: Edit title/theme/refresh, duplicate, delete user files; refuse built-in delete

**Independent Test**: Edit user dashboard title → YAML updates; duplicate → new file; delete user file → gone; delete built-in refused (spec US3)

### Implementation for User Story 3

- [x] T028 [US3] Wire Edit flow in `DashboardsScreen.tsx`: load draft from catalog row (`draftFromCatalog`), lock name on edit, save via `dashboard.save` preserving `rows` from catalog payload
- [x] T029 [US3] Wire Duplicate in `DashboardsScreen.tsx` + `dashboardDraft.ts`: prefilled create draft with cleared name, rows copied from source row
- [x] T030 [US3] Wire Delete with confirm Modal in `DashboardsScreen.tsx`: call `dashboard.delete`; disable/refuse for `source: 'built-in'` without user file
- [x] T031 [US3] Implement active-dashboard fallback when deleted dashboard was open in `apps/cli/src/runtime.ts` (`dashboard.delete` runs `dashboard.open.<fallback>` — prefer `config.defaultDashboard` if still available, else first catalog entry)
- [x] T032 [US3] Enable toolbar Edit / Duplicate / Delete buttons in `DashboardsList.tsx` with selection-aware enable/disable (e.g. Delete only for `source: 'user'`)

**Checkpoint**: Full CRUD parity with Vibes metadata UX; SC-004/SC-005 satisfied

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Exports, docs, validation across stories

- [x] T033 [P] Export `DashboardsScreen`, `DashboardsList`, `DashboardEditor` from `packages/ui/src/index.ts` if other packages need them (optional — skip if shell-only)
- [x] T034 [P] Update folder doc comment in `packages/ui/src/app/screens/index.ts` for Dashboards flow and entity ids
- [x] T035 Run `pnpm --filter @nightshift/dashboard test && pnpm --filter @nightshift/ui test && pnpm --filter @nightshift/cli typecheck` per `specs/005-dashboards-sidebar-page/quickstart.md`
- [x] T036 [P] Add `.changeset` entry amendment if scope grew during polish (same file as T003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP
- **User Story 2 (Phase 4)**: Depends on Foundational; integrates with US1 list shell
- **User Story 3 (Phase 5)**: Depends on US2 save path + US1 list (Edit/Duplicate/Delete on same screen)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — independently testable list + Open
- **US2 (P1)**: After Phase 2 — needs US1 screen shell (T020) for integrated UX; create flow testable alone via commands
- **US3 (P2)**: After US2 save + US1 list — edit/duplicate/delete on same screen

### Parallel Opportunities

- Phase 1: T002 ∥ T003
- Phase 2: T004 ∥ T005 ∥ T014 ∥ T015; T006 after T005; T016 ∥ T014
- Phase 3: T018 ∥ T019; T021 ∥ T022 after T020
- Phase 4: T023 ∥ (T024 after T023 for integration)
- Phase 6: T033 ∥ T034 ∥ T036

---

## Parallel Example: Foundational

```bash
# IO + draft helpers in parallel (different files):
T004  packages/dashboard/src/schema.ts       # BLANK_DASHBOARD
T005  packages/dashboard/src/parse.ts        # deleteDashboard
T014  packages/ui/src/app/screens/dashboardDraft.ts
T016  packages/ui/src/app/AppShell.tsx       # Home label

# Then wire runtime commands (depends on T004/T005):
T010  apps/cli/src/runtime.ts               # dashboard.save
T011  apps/cli/src/runtime.ts               # dashboard.delete
```

---

## Parallel Example: User Story 1

```bash
# List component + test helper in parallel:
T018  packages/ui/src/app/screens/dashboardDraft.test.ts
T019  packages/ui/src/app/screens/DashboardsList.tsx

# Then compose screen:
T020  packages/ui/src/app/screens/DashboardsScreen.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Dashboards list + Open → Home switches (quickstart steps 1–3, 6 partial)
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → host bridge ready
2. US1 → list + switch (MVP)
3. US2 → create blank dashboards + vibe picker sync
4. US3 → edit / duplicate / delete
5. Polish → full quickstart green

### Suggested MVP Scope

**Phases 1–3 (T001–T022)**: Home rename, Dashboards catalog, Open/active sync — delivers core navigation value without create/edit/delete.

---

## Notes

- Widget layout editing stays on Home (`DashboardApp` edit mode); Dashboards editor is metadata-only
- Do not import `@nightshift/dashboard` from UI screens — commands only
- Match Vibes UX: override confirm, toast errors from AppShell command listener, list unmounts keyboard handlers in editor view (split List like `VibesList.tsx`)
- `[P]` tasks = different files, no incomplete dependencies
- Total tasks: **36** (Setup 3, Foundational 14, US1 5, US2 5, US3 5, Polish 4)
