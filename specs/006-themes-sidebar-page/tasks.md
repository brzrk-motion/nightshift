---
description: "Task list for Themes sidebar page implementation"
---

# Tasks: Themes Sidebar Page

**Input**: Design documents from `/specs/006-themes-sidebar-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/themes-surface.md, quickstart.md

**Tests**: Included for `parseTheme`/`deleteTheme`, `themeDraft` shaping, `ColorField`, and runtime command registration — plan Technical Context and SC-004 require co-located Vitest coverage.

**Organization**: Phases by user story priority (US1 → US2 → US3). Baseline already has `createThemeEngine`, built-in themes, `theme.activate.*` in `AppShell`, Settings theme list, and Dashboards/Vibes screen patterns to mirror.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US3 map to spec.md user stories
- Exact file paths in every task

## Path Conventions

- UI: `packages/ui/src/app/screens/` (+ `packages/ui/src/components/`, `packages/ui/src/theme/`)
- Theme IO: `packages/ui/src/theme/parse.ts`, `packages/ui/src/theme/schema.ts`
- Paths: `packages/services/src/paths.ts`, `packages/services/src/config.ts`
- Host bridge: `apps/cli/src/runtime.ts`, `apps/cli/src/runtime.test.ts`
- Shell: `packages/ui/src/app/AppShell.tsx`, `packages/ui/src/app/screens/SettingsScreen.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline against contracts and prep user-visible release note

- [X] T001 Audit existing theme shell surface against `specs/006-themes-sidebar-page/contracts/themes-surface.md` and note gaps at top of `specs/006-themes-sidebar-page/plan.md` Complexity Tracking (or inline comment in `packages/ui/src/app/screens/index.ts`)
- [X] T002 [P] Confirm `packages/ui/src/app/screens/` has zero imports of `packages/ui/src/theme/parse` (grep gate; screens use entities/commands only)
- [X] T003 [P] Add changeset `.changeset/nightshift-themes-sidebar.md` for user-visible Themes nav + theme editor UX

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Theme file I/O, host commands, catalog entity, dynamic activate commands, and draft helpers — required before any user story UI

**⚠️ CRITICAL**: No Themes screen work beyond stubs until this phase completes

- [X] T004 [P] Add `yaml` dependency (`^2.9.0`, match `@nightshift/dashboard`) to `packages/ui/package.json`
- [X] T005 [P] Add `themesDir: join(configDir, 'themes')` to `NightshiftPaths` in `packages/services/src/paths.ts`
- [X] T006 Include `paths.themesDir` in `ensureConfigDirs` targets in `packages/services/src/config.ts`
- [X] T007 [P] Export `THEME_COLOR_KEYS`, `HEX_COLOR` regex, and `ThemeColorKey` type from `packages/ui/src/theme.ts`
- [X] T008 [P] Add `ThemeSpec` alias and `themeFromMidnight(name?)` template in `packages/ui/src/theme/schema.ts` per `specs/006-themes-sidebar-page/data-model.md`
- [X] T009 Implement `loadThemes`, `parseTheme`, `serializeTheme`, `saveTheme`, `deleteTheme`, `mergeThemes` in `packages/ui/src/theme/parse.ts`
- [X] T010 [P] Write Vitest for parse/save/delete/hex validation in `packages/ui/src/theme/parse.test.ts`
- [X] T011 Export theme parse helpers and `ThemeSpec` from `packages/ui/src/index.ts`
- [X] T012 Implement `publishThemesCatalog(entities, themes, userThemeNames, activeName)` in `apps/cli/src/runtime.ts` emitting full `ThemeCatalogRow` shape per `specs/006-themes-sidebar-page/data-model.md`
- [X] T013 Register `nightshift.themes` entity in `apps/cli/src/runtime.ts`; load user YAML from `context.paths.themesDir`, merge with `BUILT_IN_THEMES`, register into `app.themes`; track `userThemeNames` (mirror `userVibeNames`)
- [X] T014 Register hidden `theme.save` command in `apps/cli/src/runtime.ts` per `specs/006-themes-sidebar-page/contracts/themes-surface.md` (validate serialize→parse, write file, `app.themes.register`, refresh activate commands, republish catalog, re-activate if active, toast)
- [X] T015 Register hidden `theme.delete` command in `apps/cli/src/runtime.ts` (refuse built-in-only, delete file, re-merge built-ins, activate fallback if active deleted, persist config, refresh commands, republish catalog, toast)
- [X] T016 Move `theme.activate.*` command registration from `packages/ui/src/app/AppShell.tsx` to `apps/cli/src/runtime.ts` with `refreshThemeActivateCommands()` helper called on startup and after save/delete
- [X] T017 Wire each `theme.activate.<name>` handler in `apps/cli/src/runtime.ts` to `app.themes.activate(name)` then `saveConfig({ ...config, theme: name })` then `publishThemesCatalog` (persist across restart per FR-004)
- [X] T018 [P] Implement `themeDraft.ts` helpers (`emptyDraft`, `draftFromCatalog`, `duplicateDraft`, `draftToSaveArgs`, name/hex validation) in `packages/ui/src/app/screens/themeDraft.ts`
- [X] T019 [P] Write Vitest for `themeDraft` (name validation, hex rejection, colors round-trip) in `packages/ui/src/app/screens/themeDraft.test.ts`
- [X] T020 [P] Add `themes` icon glyph to `ICONS` in `packages/ui/src/components/Icon.tsx`
- [X] T021 Add `ThemesScreen` stub export and insert `{ id: 'themes', label: 'Themes', icon: 'themes', render: ThemesScreen }` after Vibes in `packages/ui/src/app/screens/index.ts`

**Checkpoint**: `theme.save` / `theme.delete` callable; `nightshift.themes` at runtime; user themes loaded from disk; activate persists `config.json`; `parse.test.ts` green

---

## Phase 3: User Story 1 — Browse and activate themes (Priority: P1) 🎯 MVP

**Goal**: Themes list with active indicator; Activate/Enter applies palette immediately and persists to config

**Independent Test**: Open Themes → see catalog with ● on active → Activate `ember` → shell colors change → restart → still `ember` (spec US1)

### Tests for User Story 1

- [X] T022 [P] [US1] Add unit test for catalog active-marker mapping in `packages/ui/src/app/screens/themeDraft.test.ts` (or `themeCatalog.test.ts`)
- [X] T023 [P] [US1] Add runtime tests for `theme.activate.*` persisting config and catalog refresh in `apps/cli/src/runtime.test.ts`

### Implementation for User Story 1

- [X] T024 [P] [US1] Implement `ThemesList.tsx` in `packages/ui/src/app/screens/ThemesList.tsx`: Table columns (active ●, name, appearance, source), full-width toolbar (Add / Edit / Activate / Duplicate / Delete — wire no-ops where not yet implemented), keyboard ↑↓/jk, Enter → `theme.activate.<name>`, `a`/`e` hooks, `keyboardCapture` guard, `useShellContentSize`
- [X] T025 [US1] Implement list-only `ThemesScreen.tsx` in `packages/ui/src/app/screens/ThemesScreen.tsx`: read `nightshift.themes`, render `ThemesList`, Activate button runs `theme.activate.<selected>`, empty state with Add CTA
- [X] T026 [US1] Slim down `SettingsScreen.tsx` in `packages/ui/src/app/screens/SettingsScreen.tsx`: remove theme `List`; keep terminal `StatRow` and muted hint pointing users to Themes screen (FR-010)
- [X] T027 [US1] Update nav digit/key hints in `packages/ui/src/app/AppShell.tsx` and/or `packages/ui/src/app/HelpOverlay.tsx` for Themes insertion (Home=1, Dashboards=2, Vibes=3, Themes=4, …)
- [X] T028 [US1] Fix/adjust shell nav tests for Themes screen and runtime-registered `theme.activate.*` in `packages/ui/src/app/shell.test.tsx`

**Checkpoint**: Themes list usable; Activate switches palette without restart and persists; Settings no longer duplicates theme UX; MVP demo-ready

---

## Phase 4: User Story 2 — Create and edit custom themes (Priority: P1)

**Goal**: Add/edit flow saves theme YAML; ColorField editor; catalog and vibe/dashboard pickers update

**Independent Test**: Add `forest` → `themes/forest.yaml` exists → appears in Themes list and Vibe/Dashboard editor pickers → activate → colors change (spec US2)

### Tests for User Story 2

- [X] T029 [P] [US2] Add Vitest for `ColorField` swatch + hex input in `packages/ui/src/components/ColorField.test.tsx` (or extend `packages/ui/src/components/components.test.tsx`)

### Implementation for User Story 2

- [X] T030 [P] [US2] Implement `ColorField.tsx` in `packages/ui/src/components/ColorField.tsx`: label, hex `TextInput` with `keyboardCapture`, inline swatch block using parsed color (fallback to `theme.colors.border` when invalid) per contract
- [X] T031 [P] [US2] Implement `ThemeEditor.tsx` in `packages/ui/src/app/screens/ThemeEditor.tsx`: Identity (name locked on edit, appearance SelectField), Colors grouped (Background / Surfaces / Text / Accents / Status) with `ColorField` per key, responsive layout mirroring `DashboardEditor.tsx`, Save/Cancel bar, live preview strip using draft colors
- [X] T032 [US2] Extend `ThemesScreen.tsx` view state machine (`list | create | edit`) and wire Add → create draft from midnight → `theme.save` on Save per `specs/006-themes-sidebar-page/contracts/themes-surface.md`
- [X] T033 [US2] Add built-in override confirmation Modal in `ThemesScreen.tsx` when create name collides with `source: 'built-in'` row (mirror `DashboardsScreen.tsx` pattern)
- [X] T034 [US2] Wire Edit save path in `ThemesScreen.tsx`: if saved theme is active, verify live palette updates via `app.themes.register` + re-activate in `apps/cli/src/runtime.ts` `theme.save` handler
- [X] T035 [US2] Verify `publishThemesCatalog` + engine refresh exposes new theme to `runtime.themes.list()` used by `VibeEditor.tsx` and `DashboardEditor.tsx` theme SelectFields without restart

**Checkpoint**: Create/edit custom theme end-to-end; pickers include user themes; active theme edit updates live colors

---

## Phase 5: User Story 3 — Manage user themes (Priority: P2)

**Goal**: Duplicate, delete user files; refuse built-in delete; active delete fallback

**Independent Test**: Duplicate `ember` → save as `ember-warm` → delete `ember-warm` → file gone; delete built-in `midnight` refused (spec US3)

### Implementation for User Story 3

- [X] T036 [US3] Wire Edit flow in `ThemesScreen.tsx`: load draft from catalog row (`draftFromCatalog`), lock name on edit, save via `theme.save`
- [X] T037 [US3] Wire Duplicate in `ThemesScreen.tsx` + `themeDraft.ts`: prefilled create draft with cleared name, colors copied from source row
- [X] T038 [US3] Wire Delete with confirm Modal in `ThemesScreen.tsx`: call `theme.delete`; disable/refuse for `source: 'built-in'` without user file
- [X] T039 [US3] Enable toolbar Edit / Duplicate / Delete buttons in `ThemesList.tsx` with selection-aware enable/disable (Delete only for `source: 'user'`)
- [X] T040 [US3] Add runtime test for active-theme delete fallback (`config.theme` then `midnight`) in `apps/cli/src/runtime.test.ts`

**Checkpoint**: Full CRUD parity with Dashboards/Vibes UX; SC-004/SC-005 satisfied

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Exports, docs, validation across stories

- [X] T041 [P] Export `ThemesScreen`, `ThemesList`, `ThemeEditor`, `ColorField` from `packages/ui/src/index.ts` if other packages need them (optional — skip if shell-only)
- [X] T042 [P] Update folder doc comment in `packages/ui/src/app/screens/index.ts` for Themes flow and `nightshift.themes` entity id
- [X] T043 Run `pnpm --filter @nightshift/ui test && pnpm --filter @nightshift/services test && pnpm --filter @nightshift/cli test && pnpm --filter @nightshift/ui typecheck && pnpm --filter @nightshift/cli typecheck` per `specs/006-themes-sidebar-page/quickstart.md`
- [X] T044 [P] Amend `.changeset/nightshift-themes-sidebar.md` if scope grew during polish (same file as T003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP
- **User Story 2 (Phase 4)**: Depends on Foundational; integrates with US1 list shell (T025)
- **User Story 3 (Phase 5)**: Depends on US2 save path + US1 list (Edit/Duplicate/Delete on same screen)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — independently testable list + Activate + config persist
- **US2 (P1)**: After Phase 2 — needs US1 screen shell (T025) for integrated UX; create flow testable alone via commands
- **US3 (P2)**: After US2 save + US1 list — duplicate/delete on same screen

### Parallel Opportunities

- Phase 1: T002 ∥ T003
- Phase 2: T004 ∥ T005 ∥ T007 ∥ T008 ∥ T018 ∥ T019 ∥ T020; T009 after T007/T008; T010 after T009; T012–T017 sequential in `runtime.ts` but T018 ∥ T012
- Phase 3: T022 ∥ T023 ∥ T024; T027 ∥ T028 after T025
- Phase 4: T029 ∥ T030; T031 after T030; T032 after T031
- Phase 6: T041 ∥ T042 ∥ T044

---

## Parallel Example: Foundational

```bash
# IO + draft helpers in parallel (different files):
T004  packages/ui/package.json              # yaml dep
T005  packages/services/src/paths.ts        # themesDir
T007  packages/ui/src/theme.ts              # THEME_COLOR_KEYS
T008  packages/ui/src/theme/schema.ts       # themeFromMidnight
T018  packages/ui/src/app/screens/themeDraft.ts
T020  packages/ui/src/components/Icon.tsx    # themes icon

# Then wire parse + runtime (depends on T007/T008):
T009  packages/ui/src/theme/parse.ts
T012  apps/cli/src/runtime.ts               # publishThemesCatalog
T014  apps/cli/src/runtime.ts               # theme.save
T016  apps/cli/src/runtime.ts               # move theme.activate.*
```

---

## Parallel Example: User Story 1

```bash
# List + tests in parallel:
T022  packages/ui/src/app/screens/themeDraft.test.ts
T023  apps/cli/src/runtime.test.ts
T024  packages/ui/src/app/screens/ThemesList.tsx

# Then compose screen:
T025  packages/ui/src/app/screens/ThemesScreen.tsx
T026  packages/ui/src/app/screens/SettingsScreen.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Themes list + Activate → palette changes + restart persists (quickstart steps 1–3)
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → host bridge ready
2. US1 → list + activate + config persist (MVP)
3. US2 → create/edit themes + ColorField + picker sync
4. US3 → duplicate / delete
5. Polish → full quickstart green

### Suggested MVP Scope

**Phases 1–3 (T001–T028)**: Themes catalog, Activate with config persist, Settings slim-down — delivers core navigation value without create/edit/delete.

---

## Notes

- Do not import `packages/ui/src/theme/parse` from UI screens — commands only
- Match Dashboards/Vibes UX: override confirm, toast errors from AppShell command listener, list unmounts keyboard handlers in editor view (split List like `DashboardsList.tsx`)
- `theme.next` stays in `AppShell`; only per-theme activate moves to runtime
- All 11 `ThemeColors` keys required on save; hex lowercase `#rrggbb`
- `[P]` tasks = different files, no incomplete dependencies
- Total tasks: **44** (Setup 3, Foundational 18, US1 7, US2 7, US3 5, Polish 4)
