# Implementation Plan: User-Friendly Vibe Editor

**Branch**: `003-vibe-editor` | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-vibe-editor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Upgrade the Vibes screen from a raw TextInput form into a guided, picker-driven editor: theme/dashboard selectors from live registries, searchable command picker for activate/deactivate actions, live effect summary, duplicate/delete for user vibes, while keeping the entity/command bridge so `packages/ui` never imports `@nightshift/vibes` or writes files directly. Persist through existing `serializeVibe` / `saveVibe` plus new `vibe.delete`, and enrich `nightshift.vibes` / helper catalog entities as needed for pickers.

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ (Node 26.4+ or Bun for OpenTUI FFI)

**Primary Dependencies**: `@nightshift/ui` (screens, controls), `@nightshift/vibes` (serialize/save/parse/engine), `@nightshift/cli` (runtime wiring), OpenTUI React (`useKeyboard`, layout)

**Storage**: User vibe YAML under `paths.vibesDir` (`vibes/<name>.yaml`); no new database

**Testing**: Vitest co-located — `vibeDraft` shaping, serialize/save round-trips, CLI catalog publish/delete unit coverage where extractable; UI logic tested without full renderer where shell tests remain skipped

**Target Platform**: Nightshift terminal shell (Vibes nav destination)

**Project Type**: Shell UX feature spanning `packages/ui`, `packages/vibes`, `apps/cli` (not a plugin)

**Performance Goals**: Catalog and pickers update within one entity/command tick; save/delete under normal filesystem latency; no polling

**Constraints**: UI ↔ entities/commands only; soft-fail; keyboardCapture while TextInput focused; unknown YAML keys ignored; built-in delete refused; preserve `entities` on save without entities UI

**Scale/Scope**: Tens of vibes; hundreds of commands in picker (search/filter); action lists typically &lt;10 steps

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

`.specify/memory/constitution.md` is still the Speckit placeholder. Gates from `AGENTS.md` / README:

| Gate                                  | Status     | Notes                                                         |
| ------------------------------------- | ---------- | ------------------------------------------------------------- |
| Everything is a plugin                | N/A / PASS | Vibes are core shell + vibe package, not a third-party plugin |
| Public SDK only for plugins           | PASS       | No plugin changes required                                    |
| Dashboards consume widgets            | PASS       | Unchanged                                                     |
| Vibes orchestrate actions             | PASS       | Editor authors those actions                                  |
| Entities provide shared state         | PASS       | `nightshift.vibes` (+ optional picker snapshots)              |
| UI must not import vibe engine        | PASS       | Save/delete via commands                                      |
| Never let one bad input break startup | PASS       | Soft-fail save/delete; broken YAML already skipped at load    |
| No console outside CLI                | PASS       | Toasts / `context`-equivalent via AppRuntime                  |
| Tests co-located                      | PASS       | Draft + parse/save tests                                      |

**Post-design re-check**: Still PASS — contracts are command/entity surfaces; pickers read published entities or `runtime.themes` / command registry already on `AppRuntime`; no reverse dependency.

## Project Structure

### Documentation (this feature)

```text
specs/003-vibe-editor/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/vibes/src/
├── parse.ts             # serializeVibe / saveVibe (exists); add deleteVibe
├── parse.test.ts
└── schema.ts            # VibeSpec / VibeAction (unchanged contract)

apps/cli/src/
└── runtime.ts           # nightshift.vibes, vibe.save, vibe.delete, catalog refresh;
                         # optional nightshift.dashboards snapshot for picker

packages/ui/src/app/screens/
├── VibesScreen.tsx      # list + toolbar + view state machine
├── VibeEditor.tsx       # sectioned form, summary, pickers
├── vibeDraft.ts         # draft ↔ save args (extend)
├── vibeDraft.test.ts
└── components/          # optional local: CommandPicker, SelectField, ActionList
    (or keep inline under screens/ if small)

packages/ui/src/components/
└── controls.tsx         # reuse Button / TextInput; add Select/ListPick if missing
```

**Structure Decision**: Evolve the existing Vibes screen and CLI bridge. Add `deleteVibe` next to `saveVibe`. Prefer small screen-local picker components; only promote to shared `components/` if Settings/other screens need the same Select immediately.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
