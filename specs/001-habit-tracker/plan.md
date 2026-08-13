# Implementation Plan: Habit Tracker

**Branch**: `001-habit-tracker` | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-habit-tracker/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Ship a bundled `@nightshift/plugin-habit` plugin that registers a dashboard widget for a rolling 7-day habit grid (add habits, toggle day checkboxes, rename/delete), persists habits + completions via `context.storage`, exposes the same mutations as commands, and derives current/longest streaks in pure functions. UI follows the todo plugin’s button/`TextInput` patterns and adapts day-label density to widget width.

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ / Bun or Node 26.4+ for OpenTUI FFI dashboards

**Primary Dependencies**: `@nightshift/sdk` (runtime); React + `@opentui/react` as used by sibling plugins; workspace packages via `workspace:*`

**Storage**: Plugin `context.storage` JSON blob(s) under the Nightshift data directory (`storage` capability) — not a user-edited markdown file

**Testing**: Vitest (`vitest run --passWithNoTests`), co-located `*.test.ts(x)` — pure streak/window logic unit tests + widget/command smoke tests mirroring `plugins/todo` / `plugins/focus`

**Target Platform**: Terminal dashboard (OpenTUI), cross-platform (Windows/macOS/Linux local calendar dates)

**Project Type**: Nightshift plugin workspace package (`plugins/habit/`), bundled into `apps/cli`

**Performance Goals**: Instant toggle feedback; streak recompute O(days retained) per habit on mutation — fine for tens of habits and months of history

**Constraints**: SDK-only imports for plugin runtime; no `console.*`; one bad habit store must not break host startup; respect `keyboardCapture` when using `TextInput`; HTTPS/`network` not required

**Scale/Scope**: Personal use — ~1–50 habits, rolling 7-day UI, retained completion history for streak math; no sync/multi-user

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

`.specify/memory/constitution.md` is still the Speckit placeholder (principles not ratified). Gates below are taken from project law in `AGENTS.md` / `README.md` design principles:

| Gate                                              | Status             | Notes                                                                |
| ------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| Everything is a plugin                            | PASS               | New work lives in `plugins/habit`, not a new host package            |
| Public SDK is the only plugin interface           | PASS               | Runtime dep: `@nightshift/sdk` only                                  |
| Dashboards consume widgets                        | PASS               | Feature surface is a registered widget type                          |
| Entities provide shared state                     | PASS               | Live state via `registerEntity` + `useEntity`                        |
| Automations react to events                       | PASS (optional v1) | Commands exist for future automations; no required automation in MVP |
| Never let one bad input break startup             | PASS               | Load/parse storage defensively; skip/empty on corruption             |
| No console outside CLI                            | PASS               | Use `context.log`                                                    |
| Tests co-located; lint/typecheck/test before done | PASS               | Follow focus/todo package scripts                                    |
| Capability model honored                          | PASS               | Declare `storage` + entity/widget/command caps; no `network`/`shell` |

**Post-design re-check**: Still PASS — contracts stay inside plugin entity/commands/widget; no reverse-dependency on services/dashboard from the plugin.

## Project Structure

### Documentation (this feature)

```text
specs/001-habit-tracker/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
plugins/habit/
├── package.json                 # @nightshift/plugin-habit
├── tsconfig.json
├── tsconfig.typecheck.json
└── src/
    ├── index.ts                 # definePlugin setup/teardown
    ├── index.test.ts
    ├── entity.ts                # HABIT_ENTITY id + HabitState types
    ├── habits.ts                # add/rename/remove/toggle pure reducers
    ├── habits.test.ts
    ├── streaks.ts               # current/longest streak pure functions
    ├── streaks.test.ts
    ├── window.ts                # rolling 7-day date helpers
    ├── window.test.ts
    ├── storage.ts               # load/save + defensive parse
    ├── storage.test.ts
    └── widgets.tsx              # HabitTrackerWidget (+ layout density)
        widgets.test.tsx

apps/cli/
├── package.json                 # add workspace dep on @nightshift/plugin-habit
└── (default config wiring)      # DEFAULT_CONFIG.plugins entry

packages/services/src/config.ts  # DEFAULT_CONFIG.plugins includes habit

# Optional sample dashboard snippet (docs / examples only if already patterned)
```

**Structure Decision**: Mirror `plugins/focus` / `plugins/todo` — a single plugin package with pure domain modules + one widget module. Host changes limited to bundling the package in CLI default plugins. No new `packages/*` host library.

## Complexity Tracking

> No constitution violations requiring justification.
