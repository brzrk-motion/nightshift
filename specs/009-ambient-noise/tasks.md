---
description: "Task list for Ambient Noise plugin"
---

# Tasks: Ambient Noise

**Input**: Design documents from `/specs/009-ambient-noise/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/plugin-surface.md, quickstart.md

**Tests**: Included — FR-009 and SC-004 require co-located Vitest for WAV parse, catalog, mixer loop/crossfade, sink, fake-context setup, and widget render (FFI-gated).

**Organization**: Phases by user story priority (Setup → Foundational → US1 P1 MVP → US2 P1 cycle/crossfade → US3 P2 responsive transport → US4 P3 waveform → Polish).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 map to `spec.md` user stories
- Exact file paths in every task

## Path Conventions

- Plugin root: `plugins/ambient-noise/`
- Assets: `plugins/ambient-noise/test-audio/`
- CLI wiring: `apps/cli/package.json`, `packages/services/src/config.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the plugin workspace package and clip asset folder

- [ ] T001 Create `plugins/ambient-noise/` with `package.json`, `tsconfig.json`, `tsconfig.typecheck.json`, and `vitest.config.ts` mirroring `plugins/weather/` (`@nightshift/plugin-ambient-noise`; runtime deps `@nightshift/sdk`, `@opentui/react`, `react`, and `@audio/speaker`; `files` includes `dist` and `test-audio`)
- [ ] T002 [P] Add `.changeset/ambient-noise-plugin.md` describing the bundled ambient player widget (minor on `@nightshift/cli` and `@nightshift/plugin-ambient-noise`, patch on `@nightshift/services`)
- [ ] T003 [P] Create `plugins/ambient-noise/test-audio/` with `clips.json` mapping kebab-case ids to display names like "Rainy Day" and "White Noise" plus WAV PCM files (use existing samples if present; otherwise generate short fixture WAVs for tests per `specs/009-ambient-noise/research.md`)
- [ ] T004 Run `pnpm install` from repo root so `@nightshift/plugin-ambient-noise` is linked in the workspace

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entity types, WAV decode, catalog loader, injectable sink, mixer tick/loop engine, and plugin setup that never auto-plays — required before widget/commands

**CRITICAL**: No user story UI until this phase completes

### Tests for Foundational

> Write these tests FIRST; they must fail until the matching modules exist

- [ ] T005 [P] Add `plugins/ambient-noise/src/wav.test.ts` covering valid PCM16 WAV → frames, truncated/non-PCM → error (no process crash)
- [ ] T006 [P] Add `plugins/ambient-noise/src/catalog.test.ts` covering `clips.json` load, missing file → `unavailable`, empty dir → empty list, `..` path rejected
- [ ] T007 [P] Add `plugins/ambient-noise/src/sink.test.ts` covering `NullSink` write/close and `backend: 'silent'` (never opens a device)
- [ ] T008 Add `plugins/ambient-noise/src/mixer.test.ts` covering play, pause (subsequent ticks silent), loop wrap of playhead, and tick producing interleaved s16 of requested frame count (inject mock sink; no sleeps)

### Implementation for Foundational

- [ ] T009 Implement entity id `ambient-noise.player`, `ClipPublic`, `PlayerState`, `StoredSettings`, `initialPlayerState`, and hydrate helpers in `plugins/ambient-noise/src/entity.ts` per `specs/009-ambient-noise/data-model.md`
- [ ] T010 [P] Implement RIFF PCM parser / stereo s16 @ 44100 upmix in `plugins/ambient-noise/src/wav.ts`
- [ ] T011 [P] Implement catalog loader in `plugins/ambient-noise/src/catalog.ts` resolving `test-audio/clips.json` via `import.meta.url` / package root (not `cwd`)
- [ ] T012 Implement `AudioSink` interface, `NullSink`, and dynamic-import `@audio/speaker` device factory with silent fallback in `plugins/ambient-noise/src/sink.ts` (open failure must not throw to setup)
- [ ] T013 Implement mixer `tick` / `play` / `pause` / loop wrap / optional short loop-seam fade in `plugins/ambient-noise/src/mixer.ts` with injectable sink (crossfade `skipTo` stub allowed until US2)
- [ ] T014 Implement `definePlugin` in `plugins/ambient-noise/src/index.ts`: load catalog, hydrate `currentClipId` from storage, register `ambient-noise.player`, construct mixer, `context.own()` cleanup of timer/sink; never auto-play
- [ ] T015 Add `plugins/ambient-noise/src/index.test.ts` fake-context test asserting entity registration, empty/paused initial status, teardown closes sink, and setup does not throw on missing device per `specs/009-ambient-noise/contracts/plugin-surface.md`

**Checkpoint**: `pnpm --filter @nightshift/plugin-ambient-noise test` green for wav, catalog, sink, mixer loop, and index setup; entity shows a named clip (or empty) and `playing` is false

---

## Phase 3: User Story 1 — Play a looping named clip (Priority: P1) 🎯 MVP

**Goal**: Widget shows the clip display name; play/pause commands start looping audio through the sink and stop it; headless hosts stay silent without crashing

**Independent Test**: Widget on dashboard shows e.g. "Rainy Day"; play loops the clip; pause silences; no device → recoverable silent hint (spec US1)

### Tests for User Story 1

- [ ] T016 [P] [US1] Extend `plugins/ambient-noise/src/index.test.ts` so `ambient-noise.play` / `ambient-noise.pause` / `ambient-noise.toggle` mutate `ambient-noise.player` status with a mock sink and do not auto-start
- [ ] T017 [P] [US1] Add `plugins/ambient-noise/src/widgets.test.tsx` (FFI `describe.skipIf(!detectRuntime().ffi)` like weather) asserting the current clip **display name** and a play control render from mocked entity state

### Implementation for User Story 1

- [ ] T018 [US1] Implement `ambient-noise.play`, `ambient-noise.pause`, and `ambient-noise.toggle` in `plugins/ambient-noise/src/index.ts` — lazy-open sink, start/stop mixer ticks (`unref()` + `context.own()`), persist `currentClipId` only (not `playing`)
- [ ] T019 [US1] Map mixer/sink health onto entity `output` (`device` \| `silent` \| `error`) and `outputMessage` in `plugins/ambient-noise/src/index.ts`; toast device errors once with `key: 'output'`
- [ ] T020 [US1] Implement `PlayerWidget` in `plugins/ambient-noise/src/widgets.tsx` showing `currentName` (never a raw `.wav` basename) plus play/pause using Spotify-style glyphs (`▶` / `▮`) via SDK `Toolbar`/`Button`, `useEntity`, `useCommands`, `useTheme`
- [ ] T021 [US1] Add `EmptyState` / `ErrorState` / silent-output hint in `plugins/ambient-noise/src/widgets.tsx` for `empty`, `unavailable`, and `output !== 'device'`
- [ ] T022 [US1] Register widget type `ambient-noise.player` in `plugins/ambient-noise/src/index.ts` with `entities: ['ambient-noise.player']` and `PlayerWidget` render

**Checkpoint**: Named clip visible; play loops via mock sink in tests; pause stops ticks; missing device does not break Nightshift (SC-001, SC-003, SC-005)

---

## Phase 4: User Story 2 — Cycle clips with a crossfade (Priority: P1)

**Goal**: Next/previous wrap the catalog; while playing, skip equal-power crossfades (~1.5 s) instead of cutting; paused skip changes name only

**Independent Test**: With ≥2 clips, next changes the displayed name and mixed PCM during fade is a blend of A and B; wrap at ends; single-clip next is a no-op (spec US2)

### Tests for User Story 2

- [ ] T023 [P] [US2] Extend `plugins/ambient-noise/src/mixer.test.ts` with equal-power crossfade: during fade, mixed samples are not a hard cut to B; fade duration clamped for clips shorter than `CROSSFADE_MS`; rapid `skipTo` replaces in-progress fade (max two sources)
- [ ] T024 [P] [US2] Extend `plugins/ambient-noise/src/index.test.ts` for `ambient-noise.next` / `ambient-noise.previous` wrap, paused skip emits no sink audio, and optional `ambient-noise.select` with unknown id no-ops

### Implementation for User Story 2

- [ ] T025 [US2] Implement `skipTo(clipId, { fade })` equal-power crossfade (`cos`/`sin` over default 1500 ms, clamped to clip durations) in `plugins/ambient-noise/src/mixer.ts`
- [ ] T026 [US2] Implement `ambient-noise.next`, `ambient-noise.previous`, and `ambient-noise.select` in `plugins/ambient-noise/src/index.ts` per `specs/009-ambient-noise/contracts/plugin-surface.md` — wrap catalog; fade only when `status` is `playing` or `fading`; persist `currentClipId`
- [ ] T027 [US2] Add previous/next buttons (`◀◀` / `▶▶`) to `plugins/ambient-noise/src/widgets.tsx` calling `ambient-noise.previous` / `ambient-noise.next`
- [ ] T028 [US2] Set entity `status: 'fading'` during track-change mix and restore `playing` when fade completes in `plugins/ambient-noise/src/index.ts`

**Checkpoint**: Next/previous update `currentName` immediately; playing skip crossfades; wrap works; one-clip catalog does not error (SC-002)

---

## Phase 5: User Story 3 — Simple transport in compact and wide slots (Priority: P2)

**Goal**: Compact slot keeps name + play/pause; regular/wide shows previous, play/pause, and next; no overflow

**Independent Test**: Render widget at compact vs regular sizes; compact keeps name + play/pause; regular shows all three transport controls (spec US3)

### Tests for User Story 3

- [ ] T029 [P] [US3] Add `plugins/ambient-noise/src/scale.test.ts` covering `compact` / `regular` / `wide` breakpoints from `WidgetProps` width/height
- [ ] T030 [P] [US3] Extend `plugins/ambient-noise/src/widgets.test.tsx` to render at two sizes and assert compact drops prev/next glyphs while keeping the clip name and play/pause

### Implementation for User Story 3

- [ ] T031 [US3] Implement `resolveLayout(width, height)` in `plugins/ambient-noise/src/scale.ts` (`compact` \| `regular` \| `wide`) — no `width < n` checks scattered in JSX
- [ ] T032 [US3] Apply layout in `plugins/ambient-noise/src/widgets.tsx`: compact = name + play/pause; regular+ = name + prev/play/next; wrap in `overflow: 'hidden'` flex box so content does not spill the panel
- [ ] T033 [US3] Use compact glyphs `«` / `»` when width is tight but still `regular` enough for skip controls in `plugins/ambient-noise/src/widgets.tsx` (Spotify compact pattern)

**Checkpoint**: Compact and regular slots remain usable; transport reachable; no panel overflow (US3)

---

## Phase 6: User Story 4 — Optional activity visualization (Priority: P3)

**Goal**: Wide + playing may show SDK `ActivityWaveform` from mixer RMS; compact/paused still work without it

**Independent Test**: Wide playing view shows a pulse strip; paused or compact omits it without error (spec US4)

### Tests for User Story 4

- [ ] T034 [P] [US4] Extend `plugins/ambient-noise/src/mixer.test.ts` so ticks while playing append 0–1 `levels` (capped length); pause does not require visualization
- [ ] T035 [P] [US4] Extend `plugins/ambient-noise/src/widgets.test.tsx` asserting `ActivityWaveform` appears in wide+playing mocked state and is absent in compact

### Implementation for User Story 4

- [ ] T036 [US4] Publish mixer RMS/peak ring buffer onto `ambient-noise.player` `levels` (~10 Hz entity updates, not per-sample) from `plugins/ambient-noise/src/index.ts` / `plugins/ambient-noise/src/mixer.ts`
- [ ] T037 [US4] Render SDK `ActivityWaveform` from `levels` in `plugins/ambient-noise/src/widgets.tsx` only when layout is `wide` and status is `playing` or `fading`

**Checkpoint**: Visualization is optional; P1 transport still works if this phase is skipped

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Bundle with CLI, config migration, docs, and full validation

- [ ] T038 [P] Add `@nightshift/plugin-ambient-noise` workspace dependency to `apps/cli/package.json`
- [ ] T039 Add `@nightshift/plugin-ambient-noise` to `DEFAULT_CONFIG.plugins` and bump `CONFIG_VERSION` from 9 to 10 with v9→v10 migration in `packages/services/src/config.ts` (mirror system-monitor v8→v9)
- [ ] T040 [P] Add config migration test for ambient-noise in `packages/services/src/config.test.ts` (v9 upgrade adds the plugin; no extra `pluginPermissions`)
- [ ] T041 [P] Document the plugin in `README.md` bundled-plugin list (and dashboard YAML example `type: ambient-noise.player`)
- [ ] T042 Confirm `plugins/ambient-noise/package.json` `files` includes `test-audio` so clips ship with the package
- [ ] T043 Run `pnpm --filter @nightshift/plugin-ambient-noise lint && pnpm --filter @nightshift/plugin-ambient-noise typecheck && pnpm --filter @nightshift/plugin-ambient-noise test && pnpm build` and execute automated checks from `specs/009-ambient-noise/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Foundational — named play/pause/loop MVP
- **US2 (Phase 4)**: Depends on US1 commands + mixer tick (same `mixer.ts` / `index.ts` / `widgets.tsx`)
- **US3 (Phase 5)**: Depends on US1 widget; prev/next buttons from US2 for regular layout
- **US4 (Phase 6)**: Depends on US3 `wide` layout; mixer levels can start after T013
- **Polish (Phase 7)**: Depends on US1+US2 for a shippable player; US3+US4 recommended before calling it done

### User Story Dependencies

| Story | Priority | Depends on | Notes |
|-------|----------|------------|-------|
| US1 | P1 | Foundational | Named looping play/pause — **MVP** |
| US2 | P1 | US1 mixer + entity | Crossfade cycle; same player |
| US3 | P2 | US1 widget (+ US2 skip buttons) | Layout only |
| US4 | P3 | US3 wide breakpoint | Optional waveform |

### Within Each User Story

- Tests before or alongside implementation; confirm they fail first
- WAV → catalog → sink → mixer → index commands → widget
- Persist clip id on skip/play; never persist playing

### Parallel Opportunities

- **Phase 1**: T002, T003 parallel after T001
- **Phase 2**: T005–T007 parallel; T010–T011 parallel after T009
- **Phase 3**: T016, T017 parallel once entity shape is stable
- **Phase 4**: T023, T024 parallel
- **Phase 5**: T029, T030 parallel
- **Phase 6**: T034, T035 parallel
- **Phase 7**: T038, T040, T041 parallel

---

## Parallel Example: Foundational decode/catalog

```bash
# After T001 scaffold:
Task T005: plugins/ambient-noise/src/wav.test.ts
Task T006: plugins/ambient-noise/src/catalog.test.ts
Task T007: plugins/ambient-noise/src/sink.test.ts

# After T009 entity.ts:
Task T010: plugins/ambient-noise/src/wav.ts
Task T011: plugins/ambient-noise/src/catalog.ts
```

---

## Parallel Example: User Story 1

```bash
# Command contract tests and widget render tests together:
Task T016: plugins/ambient-noise/src/index.test.ts (play/pause/toggle)
Task T017: plugins/ambient-noise/src/widgets.test.tsx (name + play control)
```

---

## Parallel Example: User Story 2

```bash
Task T023: plugins/ambient-noise/src/mixer.test.ts (crossfade math)
Task T024: plugins/ambient-noise/src/index.test.ts (next/previous/select)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Named clip, play loops, pause stops (mock sink in CI; real device optional)
5. Demo is thin without skip/crossfade — US2 is also P1

### Recommended first release (US1 + US2)

1. Setup + Foundational + US1 + US2
2. Validate wrap + crossfade in mixer tests and named next/previous in the widget
3. Add US3 layout before shipping on real dashboards
4. US4 waveform is optional

### Incremental delivery

1. Foundational → US1 (play/pause/loop) → US2 (cycle/crossfade) → **shippable v1 audio**
2. US3 (responsive transport) → US4 (waveform) → Polish (CLI default plugin)

### Parallel team strategy

- Developer A: wav + mixer + sink (T005, T007–T008, T010, T012–T013, T023, T025)
- Developer B: catalog + entity + index commands + widget (T006, T009, T011, T014–T022, T026–T028)
- After US2: either developer takes US3 scale + US4 waveform

---

## Notes

- No `network` or `shell` capabilities — local WAV + `AudioSink` only
- `@audio/speaker` is dynamic-import; missing native addon → `NullSink` / `output: 'silent'`
- Widget type id: `ambient-noise.player` per contract
- Config migration bump required (`CONFIG_VERSION` is currently 9 → 10)
- Do not add `ambient-noise.player` to `DEFAULT_DASHBOARD` `minimal`/`nightshift` layouts unless product asks
- Playback is process-wide (does not stop on widget unmount); stop on pause and plugin teardown
- Clip names come from `test-audio/clips.json`, never from raw filenames in the UI

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Setup | T001–T004 (4) | — |
| Foundational | T005–T015 (11) | — |
| US1 Play looping named clip | T016–T022 (7) | US1 |
| US2 Cycle + crossfade | T023–T028 (6) | US2 |
| US3 Compact/wide transport | T029–T033 (5) | US3 |
| US4 Optional waveform | T034–T037 (4) | US4 |
| Polish | T038–T043 (6) | — |
| **Total** | **43 tasks** | |

**Suggested MVP scope**: Phase 1 + 2 + 3 (US1) for a looping named player; **recommended first release** adds Phase 4 (US2 crossfade cycle). US3 before putting the widget on dense dashboards. US4 is optional.

**Format validation**: All tasks use `- [ ] Tnnn` checkbox, sequential IDs, `[P]` only when parallel, `[USn]` on user-story phases only, and an explicit file path in every description.
