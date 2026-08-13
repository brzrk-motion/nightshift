---
description: 'Task list for user-friendly vibe editor implementation'
---

# Tasks: User-Friendly Vibe Editor

**Input**: Design documents from `/specs/003-vibe-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-015 and SC-004 require co-located Vitest for draft↔save-args, serialize/save/delete round-trips, and catalog publish after save/delete.

**Organization**: Phases by user story priority (US1 → US2 → US3 → US4 → US5). Baseline already landed (`serializeVibe` / `saveVibe` / `vibe.save` / `nightshift.vibes` / raw `VibeEditor` with TextInput fields); tasks below harden that base and add pickers, summary, duplicate/delete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 map to spec.md user stories
- Exact file paths in every task

## Path Conventions

- UI: `packages/ui/src/app/screens/` (+ shared controls under `packages/ui/src/components/` when promoted)
- Vibes IO: `packages/vibes/src/parse.ts`
- Host bridge: `apps/cli/src/runtime.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm feature baseline and shared types align with the spec contracts

- [x] T001 Audit existing vibe editor surface against `specs/003-vibe-editor/contracts/vibe-editor-surface.md` and note gaps in `specs/003-vibe-editor/plan.md` Complexity Tracking (or a short comment block at top of `packages/ui/src/app/screens/VibesScreen.tsx` if no plan edit needed)
- [x] T002 [P] Confirm exports of `serializeVibe` / `saveVibe` from `packages/vibes/src/index.ts` and that `packages/ui` has zero imports of `@nightshift/vibes` (grep gate)
- [x] T003 [P] Extend or add changeset `.changeset/nightshift-vibes-editor.md` (or `.changeset/nightshift-vibe-editor-ux.md`) for the user-visible picker/summary/delete upgrade

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Host catalog helpers, delete IO, and reusable select/list-pick primitives required by later stories

**CRITICAL**: No user-story polish that depends on delete/pickers until this phase completes

- [x] T004 [P] Implement `deleteVibe(directory, name)` in `packages/vibes/src/parse.ts` (unlink `vibes/<name>.yaml`, `VIBE_NOT_FOUND` / `CONFIG_UNWRITABLE` as appropriate); export from `packages/vibes/src/index.ts`
- [x] T005 [P] Write Vitest cases for `deleteVibe` (deletes file, missing file errors, directory missing) in `packages/vibes/src/parse.test.ts`
- [x] T006 Extract/publish catalog helpers in `apps/cli/src/runtime.ts`: keep `publishVibesCatalog`; after delete/save, re-register built-in if user override removed; ensure `vibe.activate.*` stays in sync
- [x] T007 Publish `nightshift.dashboards` entity snapshot `{ dashboards: { name, title }[] }` from loaded dashboards in `apps/cli/src/runtime.ts` per `specs/003-vibe-editor/data-model.md`
- [x] T008 [P] Add a reusable single-select list field (keyboard ↑↓ + enter, clear/none option) in `packages/ui/src/components/SelectField.tsx` (or extend `packages/ui/src/components/controls.tsx` if smaller) suitable for theme/dashboard picking
- [x] T009 [P] Export the new select control from `packages/ui/src/components/index.ts` and `packages/ui/src/index.ts` if it is a public component
- [x] T010 Register hidden `vibe.delete` command in `apps/cli/src/runtime.ts` per `specs/003-vibe-editor/contracts/vibe-editor-surface.md` (refuse built-in-only; soft toast errors)

**Checkpoint**: `deleteVibe` tests green; `nightshift.dashboards` present at runtime; SelectField usable in isolation; `vibe.delete` callable

---

## Phase 3: User Story 1 — Browse vibes with clear status (Priority: P1) — MVP

**Goal**: Readable catalog + full-width action bar for Add / Edit / Activate

**Independent Test**: Open Vibes; see title/theme/dashboard/source/active; Activate updates header + row marker (spec US1)

### Tests for User Story 1

- [x] T011 [P] [US1] Extend or add a pure helper test for catalog row display mapping (active marker, title fallback) in `packages/ui/src/app/screens/vibeDraft.test.ts` or `packages/ui/src/app/screens/vibeCatalog.test.ts` if mapping is extracted

### Implementation for User Story 1

- [x] T012 [US1] Verify and harden `packages/ui/src/app/screens/VibesScreen.tsx` list: columns title/theme/dashboard/source/active, selection, full-width surface toolbar with Add / Edit / Activate, empty state with Add CTA (baseline exists — fill any gaps vs spec)
- [x] T013 [US1] Verify list keyboard shortcuts (↑↓ / enter activate / e edit / a add) with `keyboardCapture` guard in `packages/ui/src/app/screens/VibesScreen.tsx`
- [x] T014 [US1] Ensure `publishVibesCatalog` refreshes `active` flags on vibe activate/deactivate in `apps/cli/src/runtime.ts` (verify/fix if already present)

**Checkpoint**: Catalog-only MVP usable without opening the editor

---

## Phase 4: User Story 2 — Create or edit without YAML (Priority: P1)

**Goal**: Sectioned in-screen form; save via `vibe.save`; entities preserved on edit

**Independent Test**: Create vibe with title + theme + one onActivate; YAML exists; Edit round-trips; entities survive save (spec US2)

### Tests for User Story 2

- [x] T015 [P] [US2] Extend `packages/ui/src/app/screens/vibeDraft.test.ts` for name regex rejection path (or document host-side validation) and entities preservation through `draftToSaveArgs`
- [x] T016 [P] [US2] Confirm/extend `packages/vibes/src/parse.test.ts` serialize/save round-trip coverage for identity + actions (add any missing title/description cases)

### Implementation for User Story 2

- [x] T017 [US2] Restructure `packages/ui/src/app/screens/VibeEditor.tsx` into sections: Identity, Look, onActivate, onDeactivate (Look may still be text until US3)
- [x] T018 [US2] Enforce create-only editable name, locked name on edit, Cancel/Esc discard in `packages/ui/src/app/screens/VibeEditor.tsx` + `packages/ui/src/app/screens/VibesScreen.tsx`
- [x] T019 [US2] Add action reorder up/down controls plus add/remove in `packages/ui/src/app/screens/VibeEditor.tsx`; blank command rows skipped on save via `packages/ui/src/app/screens/vibeDraft.ts`
- [x] T020 [US2] On save validation errors (bad args JSON, bad name), toast/inline error and do not call `vibe.save` in `packages/ui/src/app/screens/VibesScreen.tsx`
- [x] T021 [US2] Verify `entities` from catalog row flow into draft on edit and back through save in `packages/ui/src/app/screens/vibeDraft.ts` (end-to-end)

**Checkpoint**: Create/edit/save/cancel works with sectioned form; YAML round-trip OK

---

## Phase 5: User Story 3 — Pick themes, dashboards, and commands (Priority: P1)

**Goal**: Replace free-typed theme/dashboard/command ids with live pickers (free-type fallback for commands)

**Independent Test**: Theme list = registered themes; dashboard list = `nightshift.dashboards`; command search selects `focus.start` with minutes args (spec US3)

### Tests for User Story 3

- [x] T022 [P] [US3] Add unit tests for command-picker filter helper (hide `hidden`, match search) in `packages/ui/src/app/screens/commandPicker.test.ts` (or colocated with the helper module)

### Implementation for User Story 3

- [x] T023 [US3] Wire theme SelectField to `runtime.themes.list()` (clear/none allowed) in `packages/ui/src/app/screens/VibeEditor.tsx`
- [x] T024 [US3] Wire dashboard SelectField to `useEntity('nightshift.dashboards')` in `packages/ui/src/app/screens/VibeEditor.tsx`
- [x] T025 [US3] Implement searchable command picker UI (list + query field, free-type fallback) in `packages/ui/src/app/screens/CommandPicker.tsx` (or inline in `VibeEditor.tsx` if small)
- [x] T026 [US3] Integrate command picker into onActivate/onDeactivate rows in `packages/ui/src/app/screens/VibeEditor.tsx`; keep args JSON field with validation via `vibeDraft.ts`
- [x] T027 [US3] Ensure `keyboardCapture` held while picker search / TextInputs focused so digit nav does not steal keys in `packages/ui/src/app/screens/VibeEditor.tsx` / `CommandPicker.tsx`

**Checkpoint**: Happy-path create needs zero memorized ids for theme/dashboard/command

---

## Phase 6: User Story 4 — Live summary before save (Priority: P2)

**Goal**: Plain-language summary of activate effects derived from draft

**Independent Test**: Change theme + add two commands → summary updates (spec US4)

### Tests for User Story 4

- [x] T028 [P] [US4] Write Vitest cases for `summariseDraft` in `packages/ui/src/app/screens/vibeSummary.test.ts`

### Implementation for User Story 4

- [x] T029 [US4] Implement `summariseDraft(draft)` in `packages/ui/src/app/screens/vibeSummary.ts` (theme, dashboard, command titles/counts, omit empties; mention entities count if preserved)
- [x] T030 [US4] Render live Summary section in `packages/ui/src/app/screens/VibeEditor.tsx` from `summariseDraft`

**Checkpoint**: Summary always reflects current draft without side effects

---

## Phase 7: User Story 5 — Duplicate and delete user vibes (Priority: P2)

**Goal**: Duplicate → create draft; delete user YAML; refuse pure built-in; warn on built-in override save

**Independent Test**: Duplicate locked-in → save copy → delete copy; delete built-in refused (spec US5)

### Tests for User Story 5

- [x] T031 [P] [US5] Extend `packages/vibes/src/parse.test.ts` / CLI-focused unit coverage for delete + built-in restore behavior if extractable; otherwise document manual quickstart steps covered by T035

### Implementation for User Story 5

- [x] T032 [US5] Add Duplicate toolbar action in `packages/ui/src/app/screens/VibesScreen.tsx` (prefill create draft via `draftFromCatalog`, clear `name`)
- [x] T033 [US5] Add Delete toolbar action with confirm step in `packages/ui/src/app/screens/VibesScreen.tsx`; call `vibe.delete`; disable/refuse when `source === 'built-in'`
- [x] T034 [US5] On save when name matches a built-in and `source` would become user override, show confirm warning before `vibe.save` in `packages/ui/src/app/screens/VibesScreen.tsx`
- [x] T035 [US5] After `vibe.delete`, ensure catalog + activate commands + optional built-in reappear correctly in `apps/cli/src/runtime.ts`

**Checkpoint**: Catalog hygiene complete; built-ins protected

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Docs, gates, quickstart validation

- [x] T036 [P] Update Vibes section in `README.md` to mention in-app create/edit (pickers + save to `vibes/`)
- [x] T037 [P] Refresh screen folder doc comment in `packages/ui/src/app/screens/index.ts` for `nightshift.dashboards` / editor flow
- [x] T038 Run `pnpm --filter @nightshift/vibes test`, `pnpm --filter @nightshift/ui test`, and `pnpm --filter @nightshift/vibes typecheck`, `pnpm --filter @nightshift/ui typecheck`, `pnpm --filter @nightshift/cli typecheck`
- [ ] T039 Execute manual checklist in `specs/003-vibe-editor/quickstart.md`
- [x] T040 Finalize changeset changelog text in `.changeset/nightshift-vibes-editor.md` (or the UX changeset from T003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Immediate
- **Foundational (Phase 2)**: After Setup — **blocks** US3 (dashboards entity, SelectField) and US5 (`deleteVibe` / `vibe.delete`)
- **US1 (Phase 3)**: After Setup; can start in parallel with Foundational for list-only polish, but prefer Foundational first to avoid toolbar churn
- **US2 (Phase 4)**: After US1 list shell stable (shares `VibesScreen` / `VibeEditor`)
- **US3 (Phase 5)**: After Foundational (SelectField + `nightshift.dashboards`) and US2 sectioned editor
- **US4 (Phase 6)**: After US2 draft model stable (can parallelize with US3 if careful on `VibeEditor.tsx`)
- **US5 (Phase 7)**: After Foundational delete command + US1 toolbar
- **Polish (Phase 8)**: After desired stories complete

### User Story Dependencies

- **US1**: Independent catalog MVP
- **US2**: Builds on US1 navigation into editor
- **US3**: Builds on US2 form sections + Phase 2 pickers
- **US4**: Builds on US2 draft; independent of pickers
- **US5**: Builds on US1 toolbar + Phase 2 delete; duplicate uses US2 create draft

### Parallel Opportunities

- T004 / T005 / T008 / T009 in Foundational
- T011 with T012–T014 after list shape agreed
- T015 / T016 before or with T017
- T022 with T023–T024
- T028 with T029
- T036 / T037 in Polish

---

## Parallel Example: User Story 3

```bash
# After Foundational + US2 sectioned editor:
Task: "T022 command-picker filter tests in packages/ui/src/app/screens/commandPicker.test.ts"
Task: "T023 theme SelectField in packages/ui/src/app/screens/VibeEditor.tsx"
Task: "T024 dashboard SelectField in packages/ui/src/app/screens/VibeEditor.tsx"
# Then:
Task: "T025–T027 CommandPicker integrate + keyboardCapture"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup
2. Phase 2 Foundational (at least catalog helpers; SelectField can wait if MVP skips pickers)
3. Phase 3 US1 catalog
4. Phase 4 US2 sectioned save/edit
5. **STOP and VALIDATE** create/edit/activate without pickers
6. Then US3 pickers (friendliness unlock), US4 summary, US5 delete/duplicate

### Incremental Delivery

1. Setup + Foundational → host delete + dashboards entity ready
2. US1 → browsable catalog demo
3. US2 → YAML-free create/edit demo
4. US3 → zero free-typed ids happy path (SC-002)
5. US4 → safer saves via summary
6. US5 → catalog hygiene
7. Polish + quickstart

### Suggested MVP scope

**US1 + US2** (browse + sectioned create/edit/save). US3 is the next highest-value increment for “much more user friendly.”

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Baseline files already exist — prefer extend over rewrite
- Do not import `@nightshift/vibes` from `packages/ui`
- Commit after each task or logical group
- Validate at each story checkpoint using Independent Test lines above
