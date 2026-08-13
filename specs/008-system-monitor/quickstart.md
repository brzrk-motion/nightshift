# Quickstart: System Monitor validation

**Feature**: `008-system-monitor`  
**Purpose**: Prove the plugin works end-to-end after implementation. Not an implementation guide.

## Prerequisites

- Repo root: `pnpm install`
- Node 22+ (Node 26.4+ or Bun for a live dashboard)
- Linux host with readable `/proc` (or rely on automated fixture tests in CI)
- Feature dir: `specs/008-system-monitor` ([plan.md](./plan.md))

## Setup

```bash
pnpm install
pnpm --filter @nightshift/plugin-system-monitor build
pnpm build
```

Add the widget to a dashboard YAML:

```yaml
type: system-monitor.overview
title: System
```

Confirm `@nightshift/plugin-system-monitor` appears in CLI default plugins after implementation (see [contracts/plugin-surface.md](./contracts/plugin-surface.md)).

## Automated checks

```bash
pnpm --filter @nightshift/plugin-system-monitor test
pnpm --filter @nightshift/plugin-system-monitor typecheck
pnpm --filter @nightshift/plugin-system-monitor lint
```

Expected:

- CPU parser: two `/proc/stat` fixtures → sensible delta percent
- Memory parser: fixture `meminfo` → used/total/percent
- Network parser: two `/proc/net/dev` fixtures → non-negative B/s
- GPU parser: missing sysfs → unavailable without throw
- Settings: corrupt storage → all toggles default true
- Setup: fake context registers entities, commands, widget

## Manual UI validation (Linux)

```bash
pnpm start
```

1. Open dashboard with `system-monitor.overview`.
2. Within ~5 s, CPU and RAM show values and sparklines updating.
3. Generate load (`stress-ng --cpu 2` optional) — CPU graphic rises within ~4 s.
4. Open Settings → disable RAM and GPU → main view shows only CPU and Network.
5. Restart Nightshift → toggles unchanged.
6. Re-enable all graphs → all sections return.
7. Disable every graph → empty state with hint to open settings.

## Optional GPU check

On a host with `gpu_busy_percent` or similar under `/sys/class/drm/`:

1. Ensure GPU toggle is on in settings.
2. Confirm GPU section shows a percentage and trend.

If unavailable, confirm one-line message and no widget crash.

## Pass criteria

Aligned with [spec.md](./spec.md):

- SC-001: metrics visible within 5 s
- SC-002: toggles persist
- SC-003: CPU responds to load
- SC-004: automated parser/settings coverage
- SC-005: failures never block host startup

## References

- Data shapes: [data-model.md](./data-model.md)
- Commands/entities/widget: [contracts/plugin-surface.md](./contracts/plugin-surface.md)
- Collector decisions: [research.md](./research.md)
