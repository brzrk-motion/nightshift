# Data Model: Habit Tracker

**Feature**: `001-habit-tracker` | **Date**: 2026-08-11

## Overview

Live state is an entity (`habit.tracker`). Durable copy mirrors that shape in plugin storage. Streaks are **derived**, not stored (except optionally caching longest — prefer derive for simplicity).

## Entities

### Habit

| Field       | Type              | Rules                                              |
| ----------- | ----------------- | -------------------------------------------------- |
| `id`        | string            | Stable unique id (e.g. ULID/UUID/nanoid); required |
| `name`      | string            | Trimmed display name; non-empty after trim         |
| `createdAt` | string (ISO-8601) | Set on create; immutable                           |

**Relationships**: Has many Completions (by `habitId`).

**Lifecycle**: created → active → removed (hard delete in v1; completions deleted with habit).

### Completion

| Field      | Type   | Rules                                        |
| ---------- | ------ | -------------------------------------------- |
| `habitId`  | string | Must reference an existing habit             |
| `date`     | string | Local calendar `YYYY-MM-DD`                  |
| (presence) | —      | Binary: existence means done; no count field |

**Uniqueness**: At most one completion per `(habitId, date)`.

**Lifecycle**: created on toggle-on; deleted on toggle-off.

### HabitState (entity blob)

```ts
interface HabitState {
  habits: Habit[];
  completions: Completion[]; // or Record<habitId, string[]> of dates
}
```

Preferred storage-friendly form for toggles:

```ts
completions: Record<string, string[]>; // habitId -> sorted unique YYYY-MM-DD
```

### RollingWindow (view)

| Field   | Type      | Rules                            |
| ------- | --------- | -------------------------------- |
| `dates` | string[7] | `[today-6, …, today]` local keys |
| `today` | string    | Injected/clock `todayKey()`      |

### StreakSummary (derived)

| Field     | Type   | Rules                   |
| --------- | ------ | ----------------------- |
| `habitId` | string |                         |
| `current` | number | ≥ 0; see FR-006         |
| `longest` | number | ≥ `current`; see FR-007 |

## Validation rules

1. Reject add/rename when `name.trim() === ''`.
2. Ignore toggle for unknown `habitId` or dates outside sensible range (never future relative to `today`).
3. On load: drop completions for missing habits; drop malformed dates; coerce missing arrays to `[]`.
4. Ids must be unique; generating code never reuses an id of a deleted habit within the same process without need (new id each add).

## State transitions

```text
[empty] --add--> [habits…]
habit --toggle(date)--> completion present | absent
habit --rename--> same id, new name
habit --remove--> habit + its completions gone
day rollover --> window slides; completions unchanged
```

## Persistence mapping

| Layer   | Key / id        | Contents                     |
| ------- | --------------- | ---------------------------- |
| Entity  | `habit.tracker` | Full `HabitState` for UI     |
| Storage | e.g. `state`    | Serialized `HabitState` JSON |

Write-through: every successful command updates entity then `storage.set`.
