# Contract: System Monitor plugin surface

**Feature**: `008-system-monitor`  
**Audience**: Dashboard YAML authors, plugin maintainers  
**Transport**: In-process Nightshift SDK; local `/proc` and `/sys` reads

## Plugin manifest

| Field | Value |
|-------|--------|
| `id` | `system-monitor` |
| Package | `@nightshift/plugin-system-monitor` |
| Capabilities | `entities:read`, `entities:write`, `widgets:register`, `commands:register`, `storage` |

No `network` or `shell` grant required. Bundled with CLI defaults (same pattern as `focus` / `clock`).

## Entities

| Id | Title | Shape |
|----|-------|--------|
| `system-monitor.settings` | System monitor settings | [MonitorSettings](../data-model.md) |
| `system-monitor.metrics` | System metrics | [MonitorMetricsState](../data-model.md) |

## Widget

| Type | Title | Entities | Notes |
|------|-------|----------|--------|
| `system-monitor.overview` | System monitor | `system-monitor.settings`, `system-monitor.metrics` | Main metrics view; toolbar opens settings toggles |

Dashboard YAML:

```yaml
type: system-monitor.overview
title: System
```

Optional widget option:

| Option | Type | Description |
|--------|------|-------------|
| `startInSettings` | boolean | Open settings panel on first mount (clock pattern) |

## Commands

Invalid args soft-fail (log); must not throw to the host.

### `system-monitor.widget-mounted`

No args. Increments mount ref-count; starts polling when count goes from 0 → 1.

### `system-monitor.widget-unmounted`

No args. Decrements mount ref-count; stops polling when count reaches 0.

### `system-monitor.set-graph-enabled`

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `metric` | `'cpu' \| 'gpu' \| 'network' \| 'ram'` | yes | Which graph to configure |
| `enabled` | boolean | yes | Show or hide the section |

**Effect**: Updates settings entity and persists to storage.

### `system-monitor.reset-settings` (optional convenience)

No args. Restores default settings (all graphs enabled).

## Collector contract (internal, test-facing)

Exported for tests only from plugin package; not SDK surface.

| Function | Input | Output |
|----------|-------|--------|
| `readCpuPercent` | previous + current `/proc/stat` parse | 0–100 or error |
| `readMemory` | `/proc/meminfo` parse | `{ usedBytes, totalBytes, percent }` |
| `readNetworkThroughput` | previous + current `/proc/net/dev`, Δt ms | bytes/sec ≥ 0 |
| `readGpuPercent` | sysfs glob/read | 0–100 or unavailable |

## Metric units

| Metric | Stored history unit | Display |
|--------|---------------------|---------|
| CPU | percent 0–100 | `NN%` |
| RAM | percent 0–100 | `NN%` + `used / total` human sizes |
| Network | bytes per second | `KB/s`, `MB/s`, etc. |
| GPU | percent 0–100 | `NN%` or “Unavailable” |

## Storage schema (v1)

Key: `settings`

```json
{
  "version": 1,
  "showCpu": true,
  "showGpu": true,
  "showNetwork": true,
  "showRam": true
}
```

## Failure behavior

| Condition | Behavior |
|-----------|----------|
| Missing `/proc/stat` | CPU `unavailable`; other metrics independent |
| `/proc/meminfo` parse error | RAM `unavailable` |
| No non-lo interfaces | Network shows `0 B/s` idle |
| No GPU sysfs | GPU `unavailable` when enabled |
| Non-Linux platform | `platform: 'unsupported'`; empty-state message |
| Corrupt storage | Defaults; log warn once |

## SDK components used by widget

From `@nightshift/sdk`:

- `Sparkline`, `LineChart` — trend graphics
- `Toggle`, `Toolbar`, `IconButton` — settings panel
- `useEntity`, `useCommands`, `useTheme`, `useShellContentSize` (optional width)

No new UI primitives required from `007-ui-component-system`.
