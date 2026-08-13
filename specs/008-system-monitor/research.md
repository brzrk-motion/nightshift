# Research: System Monitor Plugin

**Feature**: `008-system-monitor` | **Date**: 2026-08-12

## Decision: Ship as `@nightshift/plugin-system-monitor`

**Rationale**: Nightshift rule — everything is a plugin; SDK-only runtime deps. Local host metrics fit the plugin model (entity + widget + storage), same as clock/focus.

**Alternatives considered**:
- Host service in `packages/services` — rejected; not reusable by third parties and breaks “everything is a plugin”.
- External daemon + `network` polling — rejected; overkill for localhost `/proc` reads.

## Decision: Linux `/proc` + `/sys` via `node:fs/promises`

**Rationale**: CPU, memory, and network counters are stable, documented pseudo-files on Linux. No `network` or `shell` capability required. `plugins/todo` and `plugins/spotify` already use `node:fs` from plugins without extra grants.

| Metric | Source | Method |
|--------|--------|--------|
| CPU | `/proc/stat` | Delta `idle` vs `total` jiffies between polls → aggregate % |
| RAM | `/proc/meminfo` | `MemTotal` − `MemAvailable` (fallback `MemFree` + buffers) |
| Network | `/proc/net/dev` | Sum RX+TX bytes across non-loopback interfaces; delta / Δt → B/s |
| GPU | `/sys/class/drm/card*/device/gpu_busy_percent` etc. | Best-effort read; driver-specific |

**Alternatives considered**:
- `systeminformation` npm package — extra dependency; still wraps `/proc`; YAGNI for four metrics.
- `os.cpus()` only — no historical idle delta; poor utilization accuracy.
- `shell` + `nvidia-smi` — SDK `shell` capability not exposed on `PluginContext` yet; would need host work + user grant.

## Decision: GPU best-effort, soft unavailable in v1

**Rationale**: GPU utilization paths differ (AMD `gpu_busy_percent`, Intel `gt_busy_percent`, NVIDIA often needs `nvidia-smi`). v1 probes common sysfs files under `/sys/class/drm/`; if none readable, metric status `unavailable` with short copy. Default settings: GPU **enabled** but UI hides section when permanently unavailable, or show one-line “GPU unavailable” only when user enabled it (per spec US3).

**Alternatives considered**:
- Require NVIDIA tools — blocked without shell capability.
- Omit GPU entirely — user explicitly asked for GPU; best-effort satisfies ask on common open-source drivers.
- Separate optional plugin — unnecessary split for one toggle.

## Decision: Rolling history in entity state (~60 samples)

**Rationale**: Widget uses SDK `Sparkline`/`LineChart` which expect numeric arrays. Keep history on `system-monitor.metrics` entity updated each poll so widgets stay dumb presenters. Ring buffer append per metric; cap at `HISTORY_LEN` (default 60).

**Alternatives considered**:
- History only in widget local state — breaks if multiple dashboard instances or entity inspector wants raw series.
- Persist history to storage — spec says no cross-session history; in-memory only.

## Decision: Poll lifecycle — mount/unmount ref-count (weather pattern)

**Rationale**: `weather.widget-mounted` / `weather.widget-unmounted` commands avoid polling when no widget is visible. System monitor should register `system-monitor.widget-mounted` / `unmounted` and start/stop a single `setInterval` (1 s default, `unref()`).

**Alternatives considered**:
- Always poll in setup — wastes CPU when widget not on any dashboard.
- Poll only when dashboard focused — host has no focus signal to plugins; mount ref-count is sufficient.

## Decision: Settings UI — clock widget pattern

**Rationale**: Clock already implements Settings/Done toolbar, `Toggle` controls, compact height handling, and `storage`-backed entity. Reuse: `Toggle` per graph (CPU, GPU, Network, RAM), persist on change via commands (`system-monitor.set-graph-enabled`).

**Alternatives considered**:
- Separate settings widget type — extra dashboard YAML surface; one widget with in-panel settings matches user ask.
- Shell settings screen — out of scope; widget-local settings are Nightshift-native.

## Decision: Chart presentation by widget height

**Rationale**: SDK provides `Sparkline` (1 row) and `LineChart` (multi-row braille). Use `WidgetProps.height` threshold (e.g. `< 12` compact → sparkline + caption; taller → `LineChart` with `showAxis` for one primary metric or all sections). Matches weather scale/compaction patterns.

**Alternatives considered**:
- Sparkline only — underuses tall slots.
- BarChart for RAM — RAM is a level, not categorical; sparkline/line is clearer.

## Decision: Platform scope — Linux v1 only

**Rationale**: User environment is Linux; `/proc` layout is stable on target. macOS (`sysctl`) and Windows (WMI/perf counters) differ; return `platform: 'unsupported'` for non-Linux and show single empty state rather than half-working metrics.

**Alternatives considered**:
- Cross-platform v1 — triples collector code and test matrix; defer.
- Fail plugin load on non-Linux — violates “never break startup”; soft unavailable instead.

## Decision: Testing strategy

**Rationale**: Pure parsers with fixture files under `src/fixtures/` (copied `/proc/stat` snippets). Collector tests inject `readFile` mock. `index.test.ts` fake `PluginContext` like focus. Widget tests mock entity state; optional FFI gate like weather. No live `/proc` dependency in CI (works in containers with mounted fixtures only).

**Alternatives considered**:
- Integration test on real `/proc` — flaky in CI sandboxes.
- Snapshot entire widget output — brittle; assert metric labels and sparkline chars present.
