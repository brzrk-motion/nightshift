---
description: 'Task list for UI component system overhaul'
---

# Tasks: UI Component System Overhaul

**Input**: Design documents from `/specs/007-ui-component-system/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-component-surface.md, quickstart.md

**Tests**: Included — FR-013 and SC-004 require co-located Vitest for `formLayout` thresholds, `useListKeyboard`, and parity with former `vibeEditorLayout` tests.

**Organization**: Phases by user story priority (Foundational → US1 + US2 P1 → US3 + US4 P2 → US5 P3 → Polish). US1 and US2 share foundational layout primitives; editor migrations validate US1; `formLayout` parity validates US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 map to `spec.md` user stories
- Exact file paths in every task

## Path Conventions

- UI components: `packages/ui/src/components/`
- Form layout: `packages/ui/src/formLayout.ts`
- Shell screens: `packages/ui/src/app/screens/`
- SDK re-exports: `packages/sdk/src/index.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm baseline and user-visible tracking for the refactor

- [x] T001 Audit existing component inventory against `specs/007-ui-component-system/contracts/ui-component-surface.md` and note any drift in `specs/007-ui-component-system/plan.md` Component Audit Reference section
- [x] T002 [P] Add changeset `.changeset/nightshift-ui-component-system.md` describing shared form primitives and responsive helpers (user-visible SDK export expansion)
- [x] T003 [P] Confirm zero new npm dependencies required — grep `packages/ui/package.json` and `packages/sdk/package.json` remain unchanged after feature completes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `formLayout` module, theme validation decoupling, and form shell components required by US1 and US2

**CRITICAL**: No editor or list migration until this phase completes

### Tests for Foundational

- [x] T004 [P] Port threshold tests from `packages/ui/src/app/screens/vibeEditorLayout.test.ts` into `packages/ui/src/formLayout.test.ts` (widths 51/52, 57/58, 63/64, 67/68; heights 19/20; parity with old `vibeEditorScale` outputs)

### Implementation for Foundational

- [x] T005 [P] Implement `formContentSize`, `formScale`, `FormScale`, `FormLayout` types in `packages/ui/src/formLayout.ts` per `specs/007-ui-component-system/data-model.md`
- [x] T006 Implement `useFormScale(options?)` hook in `packages/ui/src/formLayout.ts` using `useRuntime().size` and `isNavRailCollapsed` from `packages/ui/src/layout.ts`
- [x] T007 [P] Move `isValidHex` to `packages/ui/src/theme/validate.ts`; update `packages/ui/src/app/screens/themeDraft.ts` to import from there
- [x] T008 Update `packages/ui/src/components/ColorField.tsx` to import `isValidHex` from `packages/ui/src/theme/validate.ts` (remove `app/screens/` dependency)
- [x] T009 [P] Implement `FormSection` in `packages/ui/src/components/FormSection.tsx` (accent title, `scale.tightGaps` gap)
- [x] T010 [P] Implement `FormField` in `packages/ui/src/components/FormField.tsx` (render-prop children, stack/inline via `scale.stackFields`, `onFocus` on mouse down)
- [x] T011 [P] Implement `ActionBar` in `packages/ui/src/components/ActionBar.tsx` (`toolbar` | `footer` variants, full-width surface background per contract)
- [x] T012 [P] Implement `ScreenLayout` in `packages/ui/src/components/ScreenLayout.tsx` (title, scrollbox body, sticky actions, optional hint slot)
- [x] T013 [P] Implement `FooterHint` in `packages/ui/src/components/FooterHint.tsx` (muted single-line text)
- [x] T014 Export new components and `formLayout` symbols from `packages/ui/src/components/index.ts` and `packages/ui/src/index.ts`; promote `useShellContentSize` export from `packages/ui/src/app/useShellContentSize.ts` in `packages/ui/src/index.ts`

**Checkpoint**: `pnpm --filter @nightshift/ui test -- formLayout` green; FormSection/FormField/ActionBar render in isolation; ColorField has no screen imports

---

## Phase 3: User Story 1 — Consistent form screens (Priority: P1) 🎯 MVP

**Goal**: Shared form primitives adopted by all shell editors; duplicate inline `Section`/`Field` removed; Save/Cancel footer consistent

**Independent Test**: Refactor ThemeEditor onto `ScreenLayout` + `FormField` + `ActionBar`; stacked labels below 52 cols; footer pinned while scrolling (spec US1)

### Tests for User Story 1

- [x] T015 [P] [US1] Add component tests for `FormField` stack vs inline layout at `scale.stackFields` true/false in `packages/ui/src/components/FormField.test.tsx`

### Implementation for User Story 1

- [x] T016 [US1] Migrate `packages/ui/src/app/screens/ThemeEditor.tsx` to `ScreenLayout`, `FormSection`, `FormField`, `ActionBar` (identity rows via FormField; wire `SelectField` focused state into editor focus model)
- [x] T017 [US1] Migrate `packages/ui/src/app/screens/DashboardEditor.tsx` to form primitives; set Save/Cancel buttons to `compact={false}` via `ActionBar` footer variant
- [x] T018 [US1] Migrate `packages/ui/src/app/screens/VibeEditor.tsx` to form primitives; add `keyboardCapture.isCaptured()` guard to `useKeyboard` esc handler
- [x] T019 [US1] Remove duplicate local `Section` and `Field` function definitions from `packages/ui/src/app/screens/VibeEditor.tsx`, `DashboardEditor.tsx`, and `ThemeEditor.tsx`
- [x] T020 [US1] Remove horizontal padding from editor wrappers in `packages/ui/src/app/screens/ThemesScreen.tsx`, `DashboardsScreen.tsx`, `VibesScreen.tsx` where `ScreenLayout` owns inset (match ThemesScreen pattern from themes work)

**Checkpoint**: Zero duplicate Section/Field in editor files (SC-001); all three editors use shared `ActionBar` for Save/Cancel (SC-002); `pnpm --filter @nightshift/ui test` passes

---

## Phase 4: User Story 2 — Responsive scale hook (Priority: P1)

**Goal**: Generalized `formLayout` replaces screen-local `vibeEditorLayout`; screens and index exports use `useFormScale` / `formScale`

**Independent Test**: `formLayout.test.ts` matches old threshold behavior; VibeEditor uses `useFormScale()` instead of direct `vibeEditorScale` imports (spec US2)

### Implementation for User Story 2

- [x] T021 [US2] Replace `vibeEditorContentSize` / `vibeEditorScale` imports with `formContentSize` / `useFormScale` in `packages/ui/src/app/screens/VibeEditor.tsx`, `DashboardEditor.tsx`, and `ThemeEditor.tsx`
- [x] T022 [US2] Convert `packages/ui/src/app/screens/vibeEditorLayout.ts` to deprecated re-export shim from `packages/ui/src/formLayout.ts` per `specs/007-ui-component-system/contracts/ui-component-surface.md`
- [x] T023 [US2] Update `packages/ui/src/app/screens/vibeEditorLayout.test.ts` to import from `formLayout.ts` or delete if fully superseded by `formLayout.test.ts`
- [x] T024 [US2] Replace ad-hoc width arithmetic in `packages/ui/src/app/screens/EntitiesScreen.tsx` with `useShellContentSize()` from `packages/ui/src/app/useShellContentSize.ts`
- [x] T025 [P] [US2] Align list screen padding: verify `useShellContentSize(2)` usage is consistent in `packages/ui/src/app/screens/ThemesList.tsx`, `DashboardsList.tsx`, `VibesList.tsx` (document padding choice in code comment if 2 is intentional)

**Checkpoint**: No direct `vibeEditorScale` calls outside shim; `formLayout.test.ts` ≥ former layout test coverage (SC-004)

---

## Phase 5: User Story 3 — Catalog list keyboard helper (Priority: P2)

**Goal**: Shared `useListKeyboard` hook; catalog lists deduplicate navigation handlers

**Independent Test**: ThemesList keyboard nav unchanged after hook adoption; capture guard blocks keys while TextInput focused (spec US3)

### Tests for User Story 3

- [x] T026 [P] [US3] Add Vitest tests for `useListKeyboard` selection clamp, key mapping (j/k/↓/↑/return/e/a), and capture guard in `packages/ui/src/components/useListKeyboard.test.ts`

### Implementation for User Story 3

- [x] T027 [US3] Implement `useListKeyboard` hook in `packages/ui/src/components/useListKeyboard.ts` per `specs/007-ui-component-system/data-model.md`
- [x] T028 [US3] Export `useListKeyboard` from `packages/ui/src/components/index.ts`
- [x] T029 [US3] Refactor `packages/ui/src/app/screens/ThemesList.tsx` to use `useListKeyboard` and `ActionBar` toolbar variant
- [x] T030 [P] [US3] Refactor `packages/ui/src/app/screens/DashboardsList.tsx` to use `useListKeyboard` and `ActionBar` toolbar variant
- [x] T031 [P] [US3] Refactor `packages/ui/src/app/screens/VibesList.tsx` to use `useListKeyboard` and `ActionBar` toolbar variant

**Checkpoint**: Each list file uses shared hook; inline keyboard handler LOC reduced (SC-006); list tests pass

---

## Phase 6: User Story 4 — SDK exports for form controls (Priority: P2)

**Goal**: Plugin authors import `SelectField` and layout hooks from `@nightshift/sdk` only

**Independent Test**: Typecheck passes importing `SelectField`, `resolveBreakpoint`, `useShellContentSize` from SDK without `@nightshift/ui` (spec US4)

### Implementation for User Story 4

- [x] T032 [US4] Re-export `SelectField`, `SelectOption`, `resolveBreakpoint`, `useShellContentSize`, `TerminalSize`, `Breakpoint` from `packages/sdk/src/index.ts` per contract
- [x] T033 [P] [US4] Add compile-only SDK smoke import test in `packages/sdk/src/index.test.ts` or extend existing SDK export test if present
- [x] T034 [US4] Run `pnpm --filter @nightshift/sdk typecheck` and root `pnpm typecheck` to confirm no plugin-facing breakage (SC-005)

**Checkpoint**: SDK typecheck green; FR-012 satisfied

---

## Phase 7: User Story 5 — Catalog screen consolidation (Priority: P3)

**Goal**: Shared `ConfirmModal` replaces duplicate delete/override modal bodies

**Independent Test**: Themes delete flow uses `ConfirmModal`; Esc dismisses; confirm runs delete command (spec US5)

### Implementation for User Story 5

- [x] T035 [P] [US5] Implement `ConfirmModal` in `packages/ui/src/components/ConfirmModal.tsx` wrapping `packages/ui/src/components/Modal.tsx`
- [x] T036 [US5] Export `ConfirmModal` from `packages/ui/src/components/index.ts` and `packages/ui/src/index.ts`
- [x] T037 [US5] Refactor delete and override modals in `packages/ui/src/app/screens/ThemesScreen.tsx` to use `ConfirmModal`
- [x] T038 [P] [US5] Refactor delete and override modals in `packages/ui/src/app/screens/VibesScreen.tsx` to use `ConfirmModal`
- [x] T039 [P] [US5] Refactor delete and override modals in `packages/ui/src/app/screens/DashboardsScreen.tsx` to use `ConfirmModal`

**Checkpoint**: Six duplicate modal bodies replaced by shared component; modal behavior unchanged

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Keyboard capture fixes, minor responsive polish, full validation

- [x] T040 [P] Add `keyboardCapture` acquisition to `packages/ui/src/app/screens/CommandPickerListKeys.tsx` when picker list is open (mirror `SelectFieldListKeys.tsx`)
- [x] T041 [P] Fix hardcoded underline width in `packages/ui/src/components/Tabs.tsx` to derive from available width or parent size
- [x] T042 Run full validation from `specs/007-ui-component-system/quickstart.md` (Phases A–D checklist)
- [x] T043 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` from repo root

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational (FormSection, FormField, ActionBar, ScreenLayout, formScale)
- **US2 (Phase 4)**: Depends on Foundational; best completed alongside or immediately after US1 migrations (T021–T023 overlap editor files with T016–T18)
- **US3 (Phase 5)**: Depends on Foundational (ActionBar); independent of US1 editor migrations
- **US4 (Phase 6)**: Depends on Foundational (index exports from T014); can parallel US3 after T014
- **US5 (Phase 7)**: Independent of US3/US4; can start after Foundational
- **Polish (Phase 8)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Depends on                         | Can parallel with        |
| ----- | ---------------------------------- | ------------------------ |
| US1   | Phase 2                            | — (do first for MVP)     |
| US2   | Phase 2, US1 editor files for T021 | US3, US4, US5 after T014 |
| US3   | Phase 2 (ActionBar)                | US4, US5                 |
| US4   | T014 index exports                 | US3, US5                 |
| US5   | Phase 2 (Modal exists)             | US3, US4                 |

### Within-Phase Parallel Examples

**Foundational components (after T005–T006):**

```text
T009 FormSection.tsx ∥ T010 FormField.tsx ∥ T011 ActionBar.tsx ∥ T012 ScreenLayout.tsx ∥ T013 FooterHint.tsx
```

**List migrations (after T027):**

```text
T030 DashboardsList.tsx ∥ T031 VibesList.tsx  (T029 ThemesList first as proof)
```

**Catalog modals (after T035–T036):**

```text
T038 VibesScreen.tsx ∥ T039 DashboardsScreen.tsx  (T037 ThemesScreen first)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1–2 (Setup + Foundational)
2. Complete Phase 3 (US1 — migrate ThemeEditor first, then siblings)
3. **STOP and VALIDATE** per `quickstart.md` Phase B
4. Ship changeset if ready — form primitives usable by future screens even before list/SDK work

### Incremental Delivery

1. Foundational → form components land in `@nightshift/ui`
2. US1 → editors consistent (MVP)
3. US2 → layout hook generalized
4. US3 → list keyboard deduplicated
5. US4 → plugins get SelectField + breakpoints
6. US5 → modal consolidation
7. Polish → capture fixes + full CI green

### Suggested First Session Scope

Tasks **T001–T016** (Setup + Foundational + ThemeEditor migration) deliver a demonstrable MVP: new primitives plus one fully migrated editor.

---

## Notes

- Do **not** introduce shadcn, Tailwind, or web CSS — OpenTUI box model only
- Defer generic `CatalogScreen` scaffold (plan Phase D optional) — out of scope for this task list
- `ColorField` SDK export deferred unless a plugin needs it during implementation
- Commit after each phase checkpoint; run scoped tests before moving to next story
