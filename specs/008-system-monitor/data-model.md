# Data Model: System Monitor

**Feature**: `008-system-monitor` | **Date**: 2026-08-12

## Overview

Graph visibility preferences are durable in plugin storage. Live samples and rolling history live in one metrics entity updated on each poll tick. The widget reads both settings and metrics entities.

## Entities

### MonitorSettings (storage + entity field or separate `system-monitor.settings`)

| Field         | Type    | Default | Rules                            |
| ------------- | ------- | ------- | -------------------------------- |
| `version`     | `1`     | `1`     | Schema version                   |
| `showCpu`     | boolean | `true`  | When false, hide CPU section     |
| `showGpu`     | boolean | `true`  | When false, hide GPU section     |
| `showNetwork` | boolean | `true`  | When false, hide network section |
| `showRam`     | boolean | `true`  | When false, hide RAM section     |

**Lifecycle**: load on setup → user toggles → persist async to storage.

**Invariant**: At least zero graphs may be enabled; empty main view shows hint (not an error).

### MetricSample (component of live state)

| Field     | Type                               | Rules                                            |
| --------- | ---------------------------------- | ------------------------------------------------ |
| `status`  | `'ok' \| 'unavailable' \| 'error'` | Per-metric probe outcome                         |
| `value`   | number \| null                     | Primary scalar (%, B/s, etc.)                    |
| `label`   | string                             | Display value, e.g. `42%`, `4.2 GB`, `12.3 MB/s` |
| `detail`  | string \| null                     | Optional secondary, e.g. `8.1 / 16 GB` for RAM   |
| `history` | `number[]`                         | Rolling samples for charts; same unit as `value` |
| `error`   | string \| null                     | Short message when `status !== 'ok'`             |

### MetricKey

Union: `'cpu' | 'gpu' | 'network' | 'ram'`.

### MonitorMetricsState (entity `system-monitor.metrics`)

| Field           | Type                              | Rules                                              |
| --------------- | --------------------------------- | -------------------------------------------------- |
| `platform`      | `'linux' \| 'unsupported'`        | Set once at setup                                  |
| `polling`       | boolean                           | True while mount ref-count > 0 and interval active |
| `lastUpdatedAt` | number \| null                    | Epoch ms of last successful poll                   |
| `intervalMs`    | number                            | Poll interval (default 1000)                       |
| `metrics`       | `Record<MetricKey, MetricSample>` | Four keys always present                           |

**GPU sample when unavailable**: `status: 'unavailable'`, `value: null`, `history: []`, `error` optional.

### PollInternals (in-memory only, not entity)

| Field             | Type                    | Rules                             |
| ----------------- | ----------------------- | --------------------------------- |
| `mountCount`      | number                  | Increment on widget mount command |
| `previousCpu`     | CpuCounters \| null     | For delta utilization             |
| `previousNetwork` | NetworkCounters \| null | For delta throughput              |
| `timer`           | Timer handle            | Cleared when mountCount → 0       |

## Validation rules

1. Toggle commands ignore unknown metric keys; no-op.
2. Corrupt/missing storage → `MonitorSettings` defaults (all graphs on).
3. History arrays capped at `HISTORY_LEN` (60); drop oldest on append.
4. CPU `value` clamped 0–100; RAM 0–100; network ≥ 0.
5. Negative network delta (counter reset) → treat as 0 for that tick, reset baseline.
6. Non-Linux: `platform: 'unsupported'`; all metrics `unavailable`; settings still work.

## State transitions

```text
[setup] --> load settings + init metrics (empty history)
[widget-mounted] --> mountCount++ ; start interval if was 0
[poll tick] --> read proc --> update metrics + roll history --> lastUpdatedAt
[widget-unmounted] --> mountCount-- ; stop interval if 0
[set-graph-enabled] --> update settings --> persist storage
```

## Persistence mapping

| Layer   | Key / id                  | Contents                                                                                                           |
| ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Storage | `settings`                | `{ version: 1, showCpu, showGpu, showNetwork, showRam }`                                                           |
| Entity  | `system-monitor.settings` | `MonitorSettings` (optional mirror; may embed in single entity — pick one in implementation, document in contract) |
| Entity  | `system-monitor.metrics`  | `MonitorMetricsState`                                                                                              |

**Recommended**: Two entities — `system-monitor.settings` (user toggles) and `system-monitor.metrics` (live data) — so settings changes do not rewrite large history blobs unnecessarily.

## Display mapping (widget)

| MetricKey | Section title | Chart                          | Compact caption           |
| --------- | ------------- | ------------------------------ | ------------------------- |
| `cpu`     | CPU           | Sparkline/LineChart 0–100      | `{value}%`                |
| `ram`     | RAM           | Sparkline/LineChart 0–100      | `{value}%` + detail       |
| `network` | Network       | Sparkline/LineChart auto-scale | `{label}` rate            |
| `gpu`     | GPU           | Sparkline/LineChart 0–100      | `{value}%` or unavailable |
