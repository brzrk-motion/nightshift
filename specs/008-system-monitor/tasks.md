---
description: "Task list for System Monitor plugin"
---

# Tasks: System Monitor

**Input**: Design documents from `/specs/008-system-monitor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/plugin-surface.md, quickstart.md

**Tests**: Included — FR-012 and SC-004 require co-located Vitest for proc parsers, settings hydration, collector history, and fake-context setup.

**Organization**: Phases by user story priority (Setup → Foundational → US1 + US2 P1 → US3 + US4 P2 → Polish). US1 delivers live metrics MVP; US2 adds settings toggles on the same widget.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 map to `spec.md` user stories
- Exact file paths in every task

## Path Conventions

- Plugin root: `plugins/system-monitor/`
- Collectors: `plugins/system-monitor/src/proc/`
- Fixtures: `plugins/system-monitor/src/fixtures/`
- CLI wiring: `apps/cli/package.json`, `packages/services/src/config.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the plugin workspace package

- [x] T001 Create `plugins/system-monitor/` with `package.json`, `tsconfig.json`, `tsconfig.typecheck.json`, and `vitest.config.ts` mirroring `plugins/focus/` (`@nightshift/plugin-system-monitor`, SDK-only runtime deps)
- [x] T002 [P] Add `.changeset/system-monitor-plugin.md` describing the new bundled system monitor widget
- [x] T003 [P] Create `plugins/system-monitor/src/fixtures/` with sample `stat`, `meminfo`, and `net-dev` snippets for parser tests per `specs/008-system-monitor/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entity types, settings hydration, proc parsers, collector orchestration, and plugin setup with poll lifecycle — required before widget UI work

**CRITICAL**: No user story UI until this phase completes

### Tests for Foundational

- [x] T004 [P] Add `plugins/system-monitor/src/settings.test.ts` covering defaults, corrupt storage → safe defaults, and valid v1 round-trip
- [x] T005 [P] Add `plugins/system-monitor/src/proc/cpu.test.ts` using fixtures — delta between two `/proc/stat` samples yields 0–100%
- [x] T006 [P] Add `plugins/system-monitor/src/proc/memory.test.ts` using fixtures — used/total bytes and percent from `meminfo`
- [x] T007 [P] Add `plugins/system-monitor/src/proc/network.test.ts` using fixtures — non-negative B/s; counter reset → 0 spike guard
- [x] T008 Add `plugins/system-monitor/src/collector.test.ts` covering history cap (60), per-metric soft-fail, and platform `unsupported` on non-Linux

### Implementation for Foundational

- [x] T009 Implement entity ids, `MetricKey`, `MetricSample`, `MonitorSettings`, `MonitorMetricsState`, and initial state helpers in `plugins/system-monitor/src/entity.ts` per `specs/008-system-monitor/data-model.md`
- [x] T010 Implement `initialSettings`, `hydrateSettings`, and storage key `settings` helpers in `plugins/system-monitor/src/settings.ts`
- [x] T011 [P] Implement `parseProcStat` and `cpuPercentFromDelta` in `plugins/system-monitor/src/proc/cpu.ts`
- [x] T012 [P] Implement `parseMeminfo` and RAM percent calculation in `plugins/system-monitor/src/proc/memory.ts`
- [x] T013 [P] Implement `parseNetDev` and throughput delta in `plugins/system-monitor/src/proc/network.ts`
- [x] T014 [P] Implement human-readable byte/rate formatters in `plugins/system-monitor/src/format.ts` (used by RAM and network labels)
- [x] T015 Implement `createCollector` in `plugins/system-monitor/src/collector.ts` — async `/proc` reads, rolling history append, `HISTORY_LEN = 60`, injectable `readFile` for tests
- [x] T016 Implement `definePlugin` setup in `plugins/system-monitor/src/index.ts`: load settings, register `system-monitor.settings` and `system-monitor.metrics` entities, detect Linux vs unsupported platform
- [x] T017 Implement mount-ref-count poll lifecycle in `plugins/system-monitor/src/index.ts`: `system-monitor.widget-mounted`, `system-monitor.widget-unmounted`, 1000 ms interval with `unref()`, stop when count → 0
- [x] T018 Add `plugins/system-monitor/src/index.test.ts` fake-context test asserting entities, commands, and widget registration per `specs/008-system-monitor/contracts/plugin-surface.md`

**Checkpoint**: `pnpm --filter @nightshift/plugin-system-monitor test` green for settings, proc parsers, collector, and index setup; metrics entity updates on poll when mount count > 0

---

## Phase 3: User Story 1 — See live system metrics at a glance (Priority: P1) 🎯 MVP

**Goal**: Dashboard widget shows CPU, RAM, and network with sparklines that refresh while mounted

**Independent Test**: Add `system-monitor.overview` to a dashboard on Linux; CPU/RAM/network values and sparklines update within ~5 s (spec US1)

### Tests for User Story 1

- [x] T019 [P] [US1] Add `plugins/system-monitor/src/widgets.test.tsx` asserting CPU/RAM/network rows render labels and sparkline chars from mocked entity state

### Implementation for User Story 1

- [x] T020 [US1] Implement `MetricRow` helper and `OverviewPanel` in `plugins/system-monitor/src/widgets.tsx` using SDK `Sparkline`, `useEntity`, `useTheme` for cpu/ram/network sections
- [x] T021 [US1] Wire `system-monitor.widget-mounted` / `system-monitor.widget-unmounted` in `plugins/system-monitor/src/widgets.tsx` via `useEffect` (weather pattern)
- [x] T022 [US1] Register widget `system-monitor.overview` in `plugins/system-monitor/src/index.ts` with entities `[system-monitor.settings, system-monitor.metrics]` and `OverviewWidget` render
- [x] T023 [US1] Ensure poll tick in `plugins/system-monitor/src/index.ts` writes formatted `label`/`detail` fields and history arrays for cpu, ram, and network metrics

**Checkpoint**: Widget on dashboard shows three updating metric sections with sparklines; non-Linux shows platform unavailable without crash (SC-001, SC-005)

---

## Phase 4: User Story 2 — Toggle which graphs appear (Priority: P1)

**Goal**: In-widget settings panel toggles each graph; preferences persist; empty state when all disabled

**Independent Test**: Disable RAM and GPU in settings → main view shows only CPU and network; restart → toggles unchanged (spec US2)

### Implementation for User Story 2

- [x] T024 [US2] Implement `SettingsPanel` with four SDK `Toggle` controls in `plugins/system-monitor/src/widgets.tsx` (clock widget pattern)
- [x] T025 [US2] Add Settings/Done `Toolbar` + `IconButton` and `startInSettings` option handling in `plugins/system-monitor/src/widgets.tsx`
- [x] T026 [US2] Implement `system-monitor.set-graph-enabled` command in `plugins/system-monitor/src/index.ts` — validate `metric` + `enabled`, update settings entity, persist to storage
- [x] T027 [US2] Filter `OverviewPanel` sections by `system-monitor.settings` flags in `plugins/system-monitor/src/widgets.tsx`
- [x] T028 [US2] Add empty-state copy when all four toggles are off in `plugins/system-monitor/src/widgets.tsx` pointing user to Settings
- [x] T029 [P] [US2] Implement optional `system-monitor.reset-settings` command in `plugins/system-monitor/src/index.ts` restoring defaults per contract

**Checkpoint**: Toggle off RAM → section hidden immediately; restart preserves choice (SC-002)

---

## Phase 5: User Story 3 — GPU when the host exposes it (Priority: P2)

**Goal**: Best-effort GPU utilization via sysfs; soft unavailable when not probeable

**Independent Test**: With GPU sysfs fixture or readable host, enabled GPU shows percent + sparkline; without probes, one-line unavailable (spec US3)

### Tests for User Story 3

- [x] T030 [P] [US3] Add `plugins/system-monitor/src/proc/gpu.test.ts` covering readable `gpu_busy_percent` fixture and missing-sysfs unavailable path

### Implementation for User Story 3

- [x] T031 [US3] Implement `readGpuPercent` in `plugins/system-monitor/src/proc/gpu.ts` probing `/sys/class/drm/card*/device/` best-effort paths from `specs/008-system-monitor/research.md`
- [x] T032 [US3] Integrate GPU sample into `plugins/system-monitor/src/collector.ts` poll tick with independent soft-fail
- [x] T033 [US3] Add GPU row to `OverviewPanel` in `plugins/system-monitor/src/widgets.tsx` — respect `showGpu` toggle; show unavailable copy when `status !== 'ok'`

**Checkpoint**: GPU section never throws; hidden when toggle off regardless of host (US3 acceptance scenarios)

---

## Phase 6: User Story 4 — Usable in compact and wide dashboard slots (Priority: P2)

**Goal**: Sparklines in compact slots; taller line charts when height allows; settings usable without clipping Done

**Independent Test**: Short widget row uses one-line sparklines; tall panel uses multi-row `LineChart`; settings Done remains reachable (spec US4)

### Implementation for User Story 4

- [x] T034 [US4] Add `COMPACT_HEIGHT` threshold and sparkline vs SDK `LineChart` selection in `plugins/system-monitor/src/widgets.tsx` based on `WidgetProps.height`
- [x] T035 [US4] Apply compact settings layout (horizontal toggles row) when `height < COMPACT_HEIGHT` in `plugins/system-monitor/src/widgets.tsx` mirroring `plugins/clock/src/widgets.tsx`
- [x] T036 [US4] Wrap main/settings content in `overflow: 'hidden'` flex box in `plugins/system-monitor/src/widgets.tsx` so toolbar Done is not clipped in short slots

**Checkpoint**: Widget readable in narrow and tall dashboard slots; settings toggles reachable in compact mode (US4)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Bundle with CLI, config migration, and full validation

- [x] T037 [P] Add `@nightshift/plugin-system-monitor` workspace dependency to `apps/cli/package.json`
- [x] T038 Add `@nightshift/plugin-system-monitor` to `DEFAULT_CONFIG.plugins` and bump `CONFIG_VERSION` to 9 with v8→v9 migration in `packages/services/src/config.ts` (mirror habit/home-assistant migration pattern)
- [x] T039 [P] Add config migration test case for system-monitor plugin in `packages/services/src/config.test.ts` if present, or extend existing migration tests in the same directory
- [x] T040 Run `pnpm --filter @nightshift/plugin-system-monitor lint && pnpm --filter @nightshift/plugin-system-monitor typecheck && pnpm --filter @nightshift/plugin-system-monitor test && pnpm build` and execute manual checks from `specs/008-system-monitor/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Foundational — MVP metrics widget
- **US2 (Phase 4)**: Depends on US1 widget shell (same `widgets.tsx` file); can start after T020–T022
- **US3 (Phase 5)**: Depends on Foundational collector; integrates with US1/US2 widget — after Phase 3–4 or in parallel once T015 done
- **US4 (Phase 6)**: Depends on US1 + US2 widget structure
- **Polish (Phase 7)**: Depends on US1–US4 (or at minimum US1 + US2 for shippable MVP)

### User Story Dependencies

| Story | Priority | Depends on | Notes |
|-------|----------|------------|-------|
| US1 | P1 | Foundational | Delivers live CPU/RAM/network — **MVP** |
| US2 | P1 | US1 widget scaffold | Settings toggles on same widget |
| US3 | P2 | Foundational collector | GPU row; independent of US2 except toggle filter |
| US4 | P2 | US1 + US2 | Layout only; no new data |

### Within Each User Story

- Tests before or alongside implementation (parser tests in Foundational precede collector)
- Parsers → collector → index poll → widget display
- Settings commands before settings UI wiring

### Parallel Opportunities

- **Phase 1**: T002, T003 parallel after T001
- **Phase 2**: T004–T007 parallel; T011–T014 parallel after T009
- **Phase 3**: T019 parallel with T020 if mock entities agreed
- **Phase 5**: T030 parallel with T031
- **Phase 7**: T037, T039 parallel

---

## Parallel Example: Foundational parsers

```bash
# After T009 entity.ts is done, launch parser modules together:
Task T011: plugins/system-monitor/src/proc/cpu.ts
Task T012: plugins/system-monitor/src/proc/memory.ts
Task T013: plugins/system-monitor/src/proc/network.ts
Task T014: plugins/system-monitor/src/format.ts

# Matching tests in parallel:
Task T005: plugins/system-monitor/src/proc/cpu.test.ts
Task T006: plugins/system-monitor/src/proc/memory.test.ts
Task T007: plugins/system-monitor/src/proc/network.test.ts
```

---

## Parallel Example: User Story 1

```bash
# Widget test can start once entity shapes are stable:
Task T019: plugins/system-monitor/src/widgets.test.tsx

# While implementing display:
Task T020: plugins/system-monitor/src/widgets.tsx (OverviewPanel)
Task T023: plugins/system-monitor/src/index.ts (poll label formatting)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Dashboard widget shows updating CPU/RAM/network sparklines on Linux
5. Optional: ship with all graphs on and no settings UI yet — **not recommended**; US2 is same priority P1

### Recommended first release (US1 + US2)

1. Setup + Foundational + US1 + US2
2. Validate toggle persistence and empty state
3. Demo bundled plugin via `pnpm start`

### Incremental delivery

1. Foundational → US1 (metrics) → US2 (settings) → **shippable v1**
2. US3 (GPU best-effort) → US4 (responsive layout) → Polish

### Parallel team strategy

- Developer A: Foundational parsers + collector (T011–T015)
- Developer B: Settings + entity layer (T009–T010, T004)
- After Phase 2: Developer A → US1 widget; Developer B → US2 settings commands + panel

---

## Notes

- No `network` or `shell` capabilities — `/proc` and `/sys` via `node:fs/promises` only
- GPU unavailable is expected on many hosts; never fail plugin setup
- Widget type id: `system-monitor.overview` per contract
- Config migration bump required when adding to default plugins (current `CONFIG_VERSION` is 8)

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Setup | T001–T003 (3) | — |
| Foundational | T004–T018 (15) | — |
| US1 Live metrics | T019–T023 (5) | US1 |
| US2 Settings toggles | T024–T029 (6) | US2 |
| US3 GPU | T030–T033 (4) | US3 |
| US4 Responsive layout | T034–T036 (3) | US4 |
| Polish | T037–T040 (4) | — |
| **Total** | **40 tasks** | |

**Suggested MVP scope**: Phase 1 + 2 + 3 + 4 (US1 + US2) — live metrics with toggleable, persistent graphs.

**Format validation**: All tasks use `- [ ] Tnnn` checkbox, sequential IDs, story labels on user-story phases, and explicit file paths.
