# Implementation Plan: System Monitor

**Branch**: `008-system-monitor` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-system-monitor/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Ship a bundled `@nightshift/plugin-system-monitor` plugin that polls Linux `/proc` (and optional `/sys` GPU probes) for CPU, RAM, network throughput, and best-effort GPU utilization; exposes live state via entities; renders trend graphics with SDK `Sparkline`/`LineChart`; and provides an in-widget settings panel with per-metric toggles persisted in plugin storage. Polling starts on widget mount and stops when unmounted (weather-style ref-count).

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ / Bun or Node 26.4+ for OpenTUI dashboards

**Primary Dependencies**: `@nightshift/sdk` (runtime); React + `@opentui/react` as sibling plugins; `node:fs/promises` for `/proc`/`/sys` reads

**Storage**: Plugin `context.storage` JSON for graph visibility settings (`storage` capability)

**Testing**: Vitest, co-located `*.test.ts(x)` — pure parsers/collectors with fixture files; fake-context setup; widget render tests with mocked entity state (FFI-gated like weather)

**Target Platform**: Linux first (Arch and common distros); macOS/Windows soft-unavailable in v1

**Project Type**: Nightshift plugin workspace package (`plugins/system-monitor/`) + CLI default plugin wiring

**Performance Goals**: Default 1 s poll interval; collector work < 10 ms per tick on typical hardware; no blocking sync I/O on the React render path (async read in interval, entity update triggers re-render)

**Constraints**: SDK-only runtime imports; no `console.*`; no `network` or `shell` capabilities; soft-fail per metric; `keyboardCapture` N/A (toggles only); never throw from setup on bad storage or missing `/proc`

**Scale/Scope**: Single widget, four metrics, ~60-point rolling history, one machine (local host)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the Speckit placeholder. Gates below follow `AGENTS.md` / README:

| Gate | Status | Notes |
|------|--------|-------|
| Everything is a plugin | PASS | `plugins/system-monitor` |
| Public SDK is the only plugin interface | PASS | Runtime dep: `@nightshift/sdk` only |
| Dashboards consume widgets | PASS | `system-monitor.overview` |
| Entities provide shared state | PASS | `system-monitor.metrics` + settings entity or combined state |
| Never let one bad input break startup | PASS | Corrupt storage → defaults; `/proc` errors → per-metric unavailable |
| Capability model honored | PASS | Auto-granted only: entities, widgets, commands, storage |
| No console outside CLI | PASS | `context.log` |
| Tests co-located; lint/typecheck/test before done | PASS | Mirror clock/focus |

**Post-design re-check**: Still PASS — contracts are plugin entities/commands/widget only; no host changes; collectors are internal modules testable with fixture `/proc` snippets.

## Project Structure

### Documentation (this feature)

```text
specs/008-system-monitor/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
plugins/system-monitor/
├── package.json                      # @nightshift/plugin-system-monitor
├── tsconfig.json
├── tsconfig.typecheck.json
├── vitest.config.ts
└── src/
    ├── index.ts                      # definePlugin: entities, commands, poll lifecycle
    ├── index.test.ts
    ├── entity.ts                     # entity ids, MonitorState, Settings types
    ├── settings.ts                   # defaults, hydrate, persist helpers
    ├── settings.test.ts
    ├── collector.ts                  # orchestrates metric readers, history roll
    ├── collector.test.ts
    ├── proc/
    │   ├── cpu.ts                    # parse /proc/stat deltas → %
    │   ├── cpu.test.ts
    │   ├── memory.ts                 # parse /proc/meminfo → used/total/%
    │   ├── memory.test.ts
    │   ├── network.ts                # parse /proc/net/dev deltas → B/s
    │   ├── network.test.ts
    │   └── gpu.ts                    # best-effort /sys/class/drm probes
    │   └── gpu.test.ts
    ├── fixtures/                     # sample proc/sys snippets for tests
    └── widgets.tsx                   # overview + settings panel
        widgets.test.tsx

apps/cli/package.json                 # add @nightshift/plugin-system-monitor dep + default plugins
packages/services/src/config.ts       # default plugins list (if not auto-discovered)
```

**Structure Decision**: Mirror `plugins/clock` / `plugins/focus` — one plugin package, pure domain modules under `proc/`, single widget with settings toggle panel. No new `packages/*` library; chart rendering uses existing SDK exports.

## Complexity Tracking

> No constitution violations requiring justification. GPU sysfs probing is the only open-ended area; scoped to best-effort with soft unavailable (see [research.md](./research.md)).
