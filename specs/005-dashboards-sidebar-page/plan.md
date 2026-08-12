# Implementation Plan: Dashboards Sidebar Page

**Branch**: `005-dashboards-sidebar-page` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-dashboards-sidebar-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a **Dashboards** nav screen (above Vibes) that mirrors the Vibes catalog/editor UX: list user and built-in dashboards, create blank dashboards persisted as YAML, edit metadata, duplicate/delete user files, and open (activate) a dashboard on **Home**. Rename the first nav item from Dashboard to **Home**. Extend the CLI runtime bridge with `dashboard.save` / `dashboard.delete`, enrich `nightshift.dashboards` catalog rows (source, active, edit payload), and wire `DashboardApp` to publish active dashboard changes back to the entity store — keeping `packages/ui` on entities/commands only.

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ (Node 26.4+ or Bun for OpenTUI FFI)

**Primary Dependencies**: `@nightshift/ui` (screens, controls), `@nightshift/dashboard` (parse/save/merge, `DashboardApp`), `@nightshift/services` (config paths), `@nightshift/cli` (runtime wiring), OpenTUI React

**Storage**: User dashboard YAML under `paths.dashboardsDir` (`dashboards/<name>.yaml`); `config.json` `defaultDashboard` unchanged for v1 except optional future enhancement

**Testing**: Vitest co-located — `dashboardDraft` shaping, `deleteDashboard` + save round-trips in `packages/dashboard`, CLI command registration tests, UI draft/save-args unit tests; shell tests where FFI available

**Target Platform**: Nightshift terminal shell (new Dashboards nav + renamed Home)

**Project Type**: Shell UX feature spanning `packages/ui`, `packages/dashboard`, `apps/cli` (not a plugin)

**Performance Goals**: Catalog refresh within one command tick after save/delete; no filesystem polling

**Constraints**: UI ↔ entities/commands only; soft-fail on bad YAML; keyboardCapture on TextInput; built-in delete refused; user file overrides built-in by name; widget layout editing stays on Home (`DashboardApp` edit mode); unknown YAML keys ignored

**Scale/Scope**: Tens of dashboards; metadata editor only (not duplicating widget editor)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the Speckit placeholder. Gates from `AGENTS.md` / README:

| Gate | Status | Notes |
|------|--------|-------|
| Everything is a plugin | N/A / PASS | Dashboards are core shell + dashboard package |
| Public SDK only for plugins | PASS | No plugin changes |
| Dashboards consume widgets | PASS | Blank dashboards valid YAML; widgets added on Home |
| Vibes orchestrate actions | PASS | Vibe picker reads enriched `nightshift.dashboards` |
| Entities provide shared state | PASS | Extended catalog + optional `nightshift.dashboard` active snapshot |
| UI must not import dashboard parse | PASS | Save/delete via commands |
| Never let one bad input break startup | PASS | Soft-fail load/save/delete; broken YAML skipped |
| No console outside CLI | PASS | Toasts via AppRuntime |
| Tests co-located | PASS | Draft + parse/delete tests |

**Post-design re-check**: Still PASS — contracts are command/entity surfaces; `DashboardApp` publishes active name to entities (host-side callback), UI screens remain decoupled from filesystem.

## Project Structure

### Documentation (this feature)

```text
specs/005-dashboards-sidebar-page/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/dashboard/src/
├── parse.ts             # add deleteDashboard; export BLANK_DASHBOARD helper
├── parse.test.ts
└── schema.ts            # BLANK_DASHBOARD constant (minimal valid spec)

apps/cli/src/
└── runtime.ts           # dashboard.save, dashboard.delete, enrich publishDashboardsCatalog,
                         # track userDashboardNames, refresh dashboard.open.* after mutations

packages/ui/src/app/
├── AppShell.tsx         # Home label; footer unchanged
└── screens/
    ├── index.ts         # DashboardsScreen before Vibes in DEFAULT_SCREENS
    ├── DashboardsScreen.tsx
    ├── DashboardsList.tsx
    ├── DashboardEditor.tsx
    ├── dashboardDraft.ts
    └── dashboardDraft.test.ts

packages/dashboard/src/
└── DashboardApp.tsx     # onSwitch → update nightshift.dashboard + catalog active flags
```

**Structure Decision**: Mirror the 003-vibe-editor split (`*Screen`, `*List`, `*Editor`, `*Draft`) under `packages/ui/src/app/screens/`. Add `deleteDashboard` next to `saveDashboard` in `packages/dashboard`. Host commands live in `runtime.ts` beside `vibe.save` / `vibe.delete`. `DashboardApp` already owns Home canvas and `dashboard.open.*`; extend it to sync active dashboard into entities for the catalog's ● column.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Baseline audit (T001)**: Gaps closed in this branch — enriched `nightshift.dashboards` catalog, `nightshift.dashboard` active entity, `dashboard.save`/`dashboard.delete` host commands, Dashboards screen mirroring Vibes UX, Home nav label.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
