---
description: "Task list for habit tracker plugin implementation"
---

# Tasks: Habit Tracker

**Input**: Design documents from `/specs/001-habit-tracker/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — SC-003 and plan.md require co-located Vitest for window/streak/habits/storage fixtures.

**Organization**: Phases by user story priority (US1 → US2 → US4 → US3). Paths under `plugins/habit/` unless noted.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 map to spec.md user stories
- Exact file paths in every task

## Path Conventions

Plugin package at `plugins/habit/` (mirrors `plugins/focus`). Host wiring in `apps/cli/` and `packages/services/src/config.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the `@nightshift/plugin-habit` workspace package

- [X] T001 Create `plugins/habit/` package skeleton mirroring `plugins/focus` (`package.json` name `@nightshift/plugin-habit`, `tsconfig.json`, `tsconfig.typecheck.json`, empty `src/`)
- [X] T002 [P] Set `plugins/habit/package.json` scripts/deps (`@nightshift/sdk`, `@opentui/react`, `react`; devDeps `@nightshift/entities`, `@nightshift/ui`, `@types/react`) matching focus
- [X] T003 Run `pnpm install` from repo root so the new workspace package links

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, date window, defensive storage, and plugin shell — required before any user story UI

**⚠️ CRITICAL**: No user story work until this phase completes

- [X] T004 Define `HABIT_ENTITY`, `Habit`, `HabitState`, and `initialState()` in `plugins/habit/src/entity.ts` per `specs/001-habit-tracker/data-model.md`
- [X] T005 [P] Implement rolling 7-day helpers (`todayKey`, `rollingWindow(today)`, date arithmetic) in `plugins/habit/src/window.ts`
- [X] T006 [P] Write failing Vitest cases for the 7-day window (injected today) in `plugins/habit/src/window.test.ts`
- [X] T007 Implement `window.ts` until `plugins/habit/src/window.test.ts` passes
- [X] T008 [P] Implement defensive parse/serialize for storage schema v1 (`habits` + `completions` map) in `plugins/habit/src/storage.ts`
- [X] T009 [P] Write failing Vitest cases for corrupt/partial/empty storage → safe empty state in `plugins/habit/src/storage.test.ts`
- [X] T010 Implement `storage.ts` until `plugins/habit/src/storage.test.ts` passes
- [X] T011 Add `definePlugin` shell in `plugins/habit/src/index.ts` (id `habit`, caps including `storage`, load storage → `registerEntity(HABIT_ENTITY, …)`, no widgets/commands yet)

**Checkpoint**: Package builds; window + storage tests green; entity registers on load without crashing on bad storage

---

## Phase 3: User Story 1 — Track habits across a rolling week (Priority: P1) 🎯 MVP

**Goal**: Add habits, toggle completions on a rolling 7-day grid, persist across restarts via commands + widget

**Independent Test**: Add one habit, toggle today and yesterday, restart Nightshift, confirm marks remain and headers end on today (see spec US1)

### Tests for User Story 1

- [X] T012 [P] [US1] Write failing Vitest cases for `addHabit` / `toggleCompletion` (empty name rejected, toggle on/off, no future dates) in `plugins/habit/src/habits.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement pure reducers `addHabit` and `toggleCompletion` in `plugins/habit/src/habits.ts` until `habits.test.ts` passes
- [X] T014 [US1] Register `habit.add` and `habit.toggle` commands (write-through entity + `context.storage`) in `plugins/habit/src/index.ts` per `specs/001-habit-tracker/contracts/plugin-surface.md`
- [X] T015 [US1] Implement `HabitTrackerWidget` rolling grid (day headers + `[ ]`/`[x]` day buttons calling commands, empty state + add via `TextInput`) in `plugins/habit/src/widgets.tsx`
- [X] T016 [US1] Register widget type `habit.tracker` and wire render from `plugins/habit/src/index.ts`
- [X] T017 [US1] Add `@nightshift/plugin-habit` dependency in `apps/cli/package.json`
- [X] T018 [US1] Append `@nightshift/plugin-habit` to `DEFAULT_CONFIG.plugins` and add config migration (bump `CONFIG_VERSION`) in `packages/services/src/config.ts`
- [X] T019 [US1] Add `habit.tracker` widget to the default/sample home dashboard YAML used by the CLI (same place other bundled widgets are listed)
- [X] T020 [US1] Add plugin setup smoke assertions in `plugins/habit/src/index.test.ts` (entity + commands register; corrupt storage does not throw)

**Checkpoint**: MVP — add/toggle/persist works in dashboard; US1 independent test passes

---

## Phase 4: User Story 2 — See basic streaks (Priority: P2)

**Goal**: Show current and longest streak per habit (FR-006/FR-007)

**Independent Test**: Seed three consecutive days ending today → current=3; clear today → current per rules, longest retained (spec US2)

### Tests for User Story 2

- [X] T021 [P] [US2] Write failing Vitest streak fixtures (current from today/yesterday, longest historical, gap → 0) in `plugins/habit/src/streaks.test.ts`

### Implementation for User Story 2

- [X] T022 [US2] Implement `currentStreak` / `longestStreak` (injectable today) in `plugins/habit/src/streaks.ts` until `streaks.test.ts` passes
- [X] T023 [US2] Display current and longest streak per habit row in `plugins/habit/src/widgets.tsx`

**Checkpoint**: Streak values match fixtures and appear in the widget

---

## Phase 5: User Story 4 — Responsive, scalable widget layout (Priority: P2)

**Goal**: Compact vs roomy day labels / streak presentation; usable in narrow slots; many habits don’t break header alignment

**Independent Test**: Narrow column and wide row both show seven toggles without overflow; long list scrolls/truncates cleanly (spec US4)

### Implementation for User Story 4

- [X] T024 [US4] Add density helper (short vs weekday+date headers from available width) in `plugins/habit/src/widgets.tsx` (or `plugins/habit/src/layout.ts` if split)
- [X] T025 [US4] Apply compact/normal/wide row layout (habit name truncation, streak column visibility, scrollable habit list) in `plugins/habit/src/widgets.tsx`
- [X] T026 [P] [US4] Add Vitest coverage for density/label helpers in `plugins/habit/src/widgets.test.tsx` (or colocated layout test file)

**Checkpoint**: Widget usable at compact widths and richer at wide widths

---

## Phase 6: User Story 3 — Manage habits simply (Priority: P3)

**Goal**: Rename and delete habits from the widget via commands

**Independent Test**: Add two habits, rename one, delete the other; only renamed habit remains with completions intact (spec US3)

### Tests for User Story 3

- [X] T027 [P] [US3] Extend failing/passing cases for `renameHabit` / `removeHabit` in `plugins/habit/src/habits.test.ts`

### Implementation for User Story 3

- [X] T028 [US3] Implement `renameHabit` and `removeHabit` in `plugins/habit/src/habits.ts` (empty rename no-op; remove drops completions)
- [X] T029 [US3] Register `habit.rename` and `habit.remove` commands with storage write-through in `plugins/habit/src/index.ts`
- [X] T030 [US3] Add Edit/Delete (or equivalent) controls and inline rename `TextInput` on habit rows in `plugins/habit/src/widgets.tsx`

**Checkpoint**: Full CRUD for habits; completions preserved on rename, removed on delete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Docs, quality gates, release hygiene

- [X] T031 [P] Document the habit plugin in `README.md` (bundled plugins list + brief capability note)
- [X] T032 [P] Add a changeset for user-visible `@nightshift/*` release via `pnpm changeset` (or `.changeset/*.md`)
- [X] T033 Run `pnpm --filter @nightshift/plugin-habit lint`, `typecheck`, and `test`
- [X] T034 Run end-to-end checks from `specs/001-habit-tracker/quickstart.md` (`pnpm start`, add/toggle/restart/rename/delete)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None
- **Foundational (Phase 2)**: Depends on Setup — **blocks all stories**
- **US1 (Phase 3)**: Depends on Foundational — **MVP**
- **US2 (Phase 4)**: Depends on Foundational; needs US1 widget/commands for display integration
- **US4 (Phase 5)**: Depends on US1 widget (and ideally US2 streak columns for wide layout)
- **US3 (Phase 6)**: Depends on Foundational + US1 reducers/commands/widget
- **Polish (Phase 7)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only — MVP
- **US2 (P2)**: After US1 for widget integration; streak math can be coded in parallel once `HabitState` exists
- **US4 (P2)**: After US1 widget exists; refine layout after streaks visible
- **US3 (P3)**: After US1; can parallelize reducer tests with US2 once `habits.ts` exists

### Within Each User Story

- Tests (where listed) written first and failing before implementation
- Pure domain modules before `index.ts` command wiring
- Commands before / alongside widget
- Host bundling (T017–T019) before manual restart validation

### Parallel Opportunities

- T002 with other setup file tweaks after T001
- T005/T006 and T008/T009 in parallel during Foundational
- T012 can start once T004 exists
- T021 streak tests parallel with late US1 once completion shape is stable
- T031/T032 polish docs in parallel

---

## Parallel Example: User Story 1

```bash
# After T004 (entity types) exist:
Task: "Write failing Vitest cases for addHabit/toggleCompletion in plugins/habit/src/habits.test.ts"

# After reducers + storage + shell:
Task: "Register habit.add and habit.toggle in plugins/habit/src/index.ts"
Task: "Implement HabitTrackerWidget in plugins/habit/src/widgets.tsx"
# Then sequentially: register widget, CLI dep, DEFAULT_CONFIG migration, dashboard YAML
```

---

## Parallel Example: Foundational

```bash
Task: "Implement rolling 7-day helpers in plugins/habit/src/window.ts"
Task: "Write window.test.ts"
Task: "Implement storage parse/serialize in plugins/habit/src/storage.ts"
Task: "Write storage.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1 (through T020)
4. **STOP** — validate add/toggle/persist/restart
5. Demo MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP demo
3. US2 → streaks visible
4. US4 → responsive density
5. US3 → rename/delete
6. Polish → README, changeset, quickstart

### Parallel Team Strategy

1. Together: Setup + Foundational
2. Then: A on US1 host wiring + widget; B on streak math (US2) against fixtures; C on rename/remove reducers (US3) once `habits.ts` lands
3. US4 layout last on the shared widget file (avoid merge conflicts — single owner for `widgets.tsx`)

---

## Notes

- `[P]` = different files, no incomplete dependencies
- Do not import past `@nightshift/sdk` in plugin runtime code
- No `console.*`; use `context.log`
- Corrupt storage must never fail plugin host startup (FR-010 / SC-005)
- Prefer `Button` `[ ]`/`[x]` + focused `TextInput` patterns from `plugins/todo`
- Commit after each task or logical group; stop at checkpoints to validate independently
