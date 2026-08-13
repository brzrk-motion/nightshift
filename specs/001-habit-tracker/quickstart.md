# Quickstart: Habit Tracker validation

**Feature**: `001-habit-tracker`  
**Purpose**: Prove the plugin works end-to-end after implementation. Not an implementation guide.

## Prerequisites

- Repo root install: `pnpm install`
- Node 22+ (Node 26.4+ or Bun to open a live dashboard)
- Feature branch / directory: `specs/001-habit-tracker` (see [plan.md](./plan.md))

## Setup

```bash
pnpm install
pnpm --filter @nightshift/plugin-habit build
pnpm build
```

Confirm `@nightshift/plugin-habit` is in default plugins ([contracts/plugin-surface.md](./contracts/plugin-surface.md)) and wired from `apps/cli`.

Add the widget to a dashboard YAML (or temporary home layout):

```yaml
type: habit.tracker
title: Habits
```

## Automated checks

```bash
pnpm --filter @nightshift/plugin-habit test
pnpm --filter @nightshift/plugin-habit typecheck
pnpm --filter @nightshift/plugin-habit lint
```

Expected:

- Window helper returns 7 dates ending on injected “today”
- Streak fixtures match [spec.md](./spec.md) FR-006/FR-007 / [data-model.md](./data-model.md)
- Storage parse of corrupt JSON yields empty safe state

## Manual UI validation

```bash
pnpm start
```

1. Open the dashboard containing `habit.tracker`.
2. Add habit “Water” → row appears with 7 unchecked days.
3. Toggle today + yesterday → cells show complete; current streak ≥ 2.
4. Resize terminal / move widget to a narrow column → short day labels; toggles still work.
5. Quit and `pnpm start` again → same marks and streaks restored.
6. Rename and delete a habit → list and storage match.

## Pass criteria

Aligned with success criteria in [spec.md](./spec.md): add+toggle under ~30s, persistence after restart, streak math correct on fixtures, safe empty state on bad storage, usable at minimum dashboard size.
