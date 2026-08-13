---
description: 'Task list for Home Assistant scenes plugin implementation'
---

# Tasks: Home Assistant Scenes

**Input**: Design documents from `/specs/002-home-assistant/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included â€” FR-011, SC-004, and plan.md require co-located Vitest for url/storage/client/scenes, fake-context setup, and host private-HTTP allowlist.

**Organization**: Phases by user story priority (US1 → US2 → US3 → US4). Paths under `plugins/home-assistant/` unless noted.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1â€“US4 map to spec.md user stories
- Exact file paths in every task

## Path Conventions

Plugin package at `plugins/home-assistant/` (mirrors `plugins/weather` / `plugins/spotify`). Host fetch gate in `packages/services/src/plugins/host.ts`. CLI wiring in `apps/cli/` and `packages/services/src/config.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the `@nightshift/plugin-home-assistant` workspace package

- [x] T001 Create `plugins/home-assistant/` package skeleton mirroring `plugins/weather` (`package.json` name `@nightshift/plugin-home-assistant`, `tsconfig.json`, `tsconfig.typecheck.json`, `vitest.config.ts` copied from weather, empty `src/`)
- [x] T002 [P] Set `plugins/home-assistant/package.json` scripts/deps (`@nightshift/sdk`, `@opentui/react`, `react`; devDeps `@nightshift/entities`, `@nightshift/ui`, `@types/react`) and description for Home Assistant scenes
- [x] T003 Run `pnpm install` from repo root so the new workspace package links

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Private-HTTP fetch allowlist, shared entity/storage/url modules, and plugin shell â€” required before any user story

**âš ï¸ CRITICAL**: No user story work until this phase completes

- [x] T004 [P] Extend `context.fetch` in `packages/services/src/plugins/host.ts` to allow `http:` only for loopback (`localhost`, `127.0.0.1`, `::1`) and RFC1918 IPv4 hosts; keep denying public `http:`
- [x] T005 [P] Update `PluginContext.fetch` JSDoc in `packages/sdk/src/index.ts` to document HTTPS + private-network HTTP policy
- [x] T006 Write Vitest cases in `packages/services/src/plugins/host.test.ts` for `http://192.168.0.2/` allowed, `http://127.0.0.1:8123/` allowed, `http://example.com/` denied, `https://example.com/` allowed (with `network` grant)
- [x] T007 [P] Define `HOME_ASSISTANT_CONNECTION_ENTITY`, `HOME_ASSISTANT_SCENES_ENTITY`, `ConnectionState`, `ScenesState`, `Scene`, and initial empty states in `plugins/home-assistant/src/entity.ts` per `specs/002-home-assistant/data-model.md`
- [x] T008 [P] Write failing Vitest cases for address normalization table in `plugins/home-assistant/src/url.test.ts` per `specs/002-home-assistant/contracts/plugin-surface.md`
- [x] T009 Implement `normalizeBaseUrl` / validation in `plugins/home-assistant/src/url.ts` until `url.test.ts` passes
- [x] T010 [P] Write failing Vitest cases for corrupt/partial/empty credentials storage → safe unconfigured in `plugins/home-assistant/src/storage.test.ts`
- [x] T011 Implement parse/serialize for storage key `credentials` v1 in `plugins/home-assistant/src/storage.ts` until `storage.test.ts` passes
- [x] T012 Add `definePlugin` shell in `plugins/home-assistant/src/index.ts` (id `home-assistant`, caps including `storage` + `network`, load credentials defensively, `registerEntity` for connection + scenes, no commands/widgets yet)

**Checkpoint**: Package builds; host allowlist tests green; url + storage tests green; plugin loads without throwing on bad storage

---

## Phase 3: User Story 1 â€” Connect to Home Assistant (Priority: P1) ðŸŽ¯ MVP (part 1)

**Goal**: Collect address + token, persist credentials, validate via HA REST `/api/`, show connected or recoverable error (token never in entity state)

**Independent Test**: Configure against mock HA → connected + no token in entities; invalid token → error state without crashing (spec US1)

### Tests for User Story 1

- [x] T013 [P] [US1] Write failing Vitest cases for `checkConnection` (200 ok, 401 auth error, network throw) in `plugins/home-assistant/src/client.test.ts`
- [x] T014 [P] [US1] Write failing fake-context setup tests in `plugins/home-assistant/src/index.test.ts` asserting `network` capability, entities register, corrupt storage does not throw, and configure persists without putting `token` on `home-assistant.connection`

### Implementation for User Story 1

- [x] T015 [US1] Implement `checkConnection(fetch, baseUrl, token)` in `plugins/home-assistant/src/client.ts` (`GET {baseUrl}/api/` + Bearer) until connection cases in `client.test.ts` pass
- [x] T016 [US1] Register `home-assistant.configure` command (normalize address, reject empty, persist storage, update connection entity, run check) in `plugins/home-assistant/src/index.ts` per `specs/002-home-assistant/contracts/plugin-surface.md`
- [x] T017 [US1] On setup when credentials exist, restore connection entity and run check (soft-fail) in `plugins/home-assistant/src/index.ts`
- [x] T018 [US1] Implement configure form UI (address + token `TextInput`, save → `home-assistant.configure`, show `connection.error`) in `plugins/home-assistant/src/widgets.tsx`
- [x] T019 [US1] Register widget type `home-assistant.scenes` (entities connection + scenes) and wire render from `plugins/home-assistant/src/index.ts`

**Checkpoint**: Unconfigured → form → configure → connected/error; restart restores credentials; US1 independent test passes

---

## Phase 4: User Story 2 â€” Browse and trigger scenes (Priority: P1) ðŸŽ¯ MVP (part 2)

**Goal**: List `scene.*` entities and activate them from the widget (and via command)

**Independent Test**: Mock HA with three scenes; list + activate one → `scene.turn_on` called once; empty list shows empty state (spec US2)

### Tests for User Story 2

- [x] T020 [P] [US2] Write failing Vitest cases for filtering/mapping HA states → sorted `Scene[]` (drop non-scenes, friendly_name fallback) in `plugins/home-assistant/src/scenes.test.ts`
- [x] T021 [P] [US2] Extend `plugins/home-assistant/src/client.test.ts` with failing cases for `listScenes` and `activateScene` (Bearer header, path, body `entity_id`, non-OK soft error)

### Implementation for User Story 2

- [x] T022 [US2] Implement `scenesFromStates` (filter `scene.*`, map name/state, sort) in `plugins/home-assistant/src/scenes.ts` until `scenes.test.ts` passes
- [x] T023 [US2] Implement `listScenes` / `activateScene` in `plugins/home-assistant/src/client.ts` until client tests pass
- [x] T024 [US2] Register `home-assistant.refresh` and `home-assistant.activate-scene` commands with write-through scenes entity + soft notify/log on failure in `plugins/home-assistant/src/index.ts`
- [x] T025 [US2] After successful configure/check, auto-refresh scenes in `plugins/home-assistant/src/index.ts`
- [x] T026 [US2] Extend `plugins/home-assistant/src/widgets.tsx` with connected scene list, empty state, refresh action, and per-scene activate buttons (respect `activatingId` / loading)
- [x] T027 [P] [US2] Add widget smoke/coverage in `plugins/home-assistant/src/widgets.test.tsx` (unconfigured form vs connected list; or layout helpers if split)
- [x] T028 [US2] Extend `plugins/home-assistant/src/index.test.ts` to assert refresh/activate-scene register and mocked activate hits `scene.turn_on`

**Checkpoint**: List + activate works against mock fetch; empty/error paths recoverable; US2 independent test passes

---

## Phase 5: User Story 3 â€” Trigger scenes when a vibe activates (Priority: P1)

**Goal**: `home-assistant.activate-scene` is safe for vibe `onActivate`/`onDeactivate` (soft-fail, never throws)

**Independent Test**: Vibe `onActivate` runs activate-scene with known `entity_id` against mock HA → one turn_on; HA down / bad id → no throw, other vibe actions still runnable (spec US3)

### Tests for User Story 3

- [x] T029 [P] [US3] Write failing Vitest cases in `plugins/home-assistant/src/index.test.ts` for activate-scene with missing/invalid `entity_id` (soft no-op) and fetch failure (does not throw from command handler)

### Implementation for User Story 3

- [x] T030 [US3] Harden `home-assistant.activate-scene` in `plugins/home-assistant/src/index.ts` to catch all errors, `context.log`/`notify`, never rethrow (including unconfigured)
- [x] T031 [P] [US3] Add example vibe YAML snippet documenting `onActivate` → `home-assistant.activate-scene` in `specs/002-home-assistant/quickstart.md` (and/or a sample under existing vibes docs path if the repo already patterns sample vibes)

**Checkpoint**: Command is vibe-safe; US3 independent test passes against fake context

---

## Phase 6: User Story 4 â€” Reconfigure or disconnect (Priority: P2)

**Goal**: Update credentials or clear configuration from the widget

**Independent Test**: Save → clear → setup form returns; reconfigure with new token → subsequent calls use new token (spec US4)

### Tests for User Story 4

- [x] T032 [P] [US4] Write failing Vitest cases in `plugins/home-assistant/src/index.test.ts` for `home-assistant.clear` resetting entities/storage and re-configure replacing token used by next activate

### Implementation for User Story 4

- [x] T033 [US4] Register `home-assistant.clear` command (delete storage credentials, reset connection + scenes entities) in `plugins/home-assistant/src/index.ts`
- [x] T034 [US4] Add clear / â€œedit connectionâ€ controls on connected widget state in `plugins/home-assistant/src/widgets.tsx` that return to the configure form or call clear/configure

**Checkpoint**: Clear and reconfigure work; US4 independent test passes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Bundle with CLI, defaults/migration, quality gates, validation

- [x] T035 Add `@nightshift/plugin-home-assistant` workspace dependency in `apps/cli/package.json`
- [x] T036 Append `@nightshift/plugin-home-assistant` to `DEFAULT_CONFIG.plugins`, grant `pluginPermissions['home-assistant']` includes `network`, and bump `CONFIG_VERSION` with migration in `packages/services/src/config.ts`
- [x] T037 [P] Add `home-assistant.scenes` widget to the default/sample home dashboard YAML used by the CLI (same place other bundled widgets are listed)
- [x] T038 [P] Add a changeset for the user-visible plugin + host fetch policy (`pnpm changeset`) covering `@nightshift/plugin-home-assistant`, `@nightshift/services`, `@nightshift/sdk` as needed
- [x] T039 Run `pnpm --filter @nightshift/plugin-home-assistant lint && pnpm --filter @nightshift/plugin-home-assistant typecheck && pnpm --filter @nightshift/plugin-home-assistant test` and `pnpm --filter @nightshift/services test`; fix failures
- [x] T040 Manually walk `specs/002-home-assistant/quickstart.md` automated section (and optional live HA section if available)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies â€” start immediately
- **Foundational (Phase 2)**: Depends on Setup â€” **BLOCKS** all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on US1 configure/check + client shell (needs credentials path)
- **US3 (Phase 5)**: Depends on US2 `activate-scene` command existing
- **US4 (Phase 6)**: Depends on US1 configure + widget; can proceed after US1 with light coupling to US2 list reset
- **Polish (Phase 7)**: Depends on desired stories (minimum US1+US2 for shippable MVP)

### User Story Dependencies

- **US1 (P1)**: After Foundational â€” no other story deps
- **US2 (P1)**: After US1 (needs connected credentials + widget shell)
- **US3 (P1)**: After US2 activate-scene command
- **US4 (P2)**: After US1; integrates with US2 empty scenes on clear

### Within Each User Story

- Tests marked first MUST be written and FAIL before implementation
- Pure modules before `index.ts` wiring
- Commands before / with widget consumers
- Soft-fail hardening before calling a story done

### Parallel Opportunities

- T004/T005/T007/T008/T010 can proceed in parallel after Setup
- T013/T014 parallel within US1 tests
- T020/T021 parallel within US2 tests
- T027 parallel with index wiring once widget exists
- T031 parallel with T030
- T032 parallel once clear behavior is specified
- T037/T038 parallel during polish

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Write failing Vitest cases for checkConnection in plugins/home-assistant/src/client.test.ts"
Task: "Write failing fake-context setup tests in plugins/home-assistant/src/index.test.ts"

# Then sequential implementation:
Task: "Implement checkConnection in plugins/home-assistant/src/client.ts"
Task: "Register home-assistant.configure in plugins/home-assistant/src/index.ts"
Task: "Implement configure form in plugins/home-assistant/src/widgets.tsx"
```

## Parallel Example: User Story 2

```bash
# Tests in parallel:
Task: "Write failing scenes filter tests in plugins/home-assistant/src/scenes.test.ts"
Task: "Extend client.test.ts for listScenes/activateScene"

# Then implementation (scenes.ts || client extensions can overlap after tests exist):
Task: "Implement scenesFromStates in plugins/home-assistant/src/scenes.ts"
Task: "Implement listScenes/activateScene in plugins/home-assistant/src/client.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (host allowlist + url/storage/entity shell)
3. Complete Phase 3: US1 Connect
4. Complete Phase 4: US2 List + activate
5. **STOP and VALIDATE**: Mock configure → list → activate; token absent from entities
6. Demo if ready (vibe binding can follow immediately as US3)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → configure/connect demo
3. US2 → full scene UX (shippable MVP with US1)
4. US3 → vibe `onActivate` bindings
5. US4 → clear/reconfigure polish
6. Phase 7 → CLI defaults, changeset, quality gates

### Parallel Team Strategy

1. Team completes Setup + Foundational together (especially host allowlist)
2. After Foundational:
   - Dev A: US1 connect path
   - Dev B: scenes.ts + client list/activate tests (merge into US2 after US1 lands)
3. US3/US4 after activate-scene exists

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Token must never appear on `home-assistant.connection` entity state
- Soft-fail all HA/network errors; never break host startup or vibe engine
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: WebSocket HA API, non-scene entity control, in-widget vibe→scene mapper (out of v1 scope)
