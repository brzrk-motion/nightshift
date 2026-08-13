# Contract: Habit plugin surface

**Feature**: `001-habit-tracker`  
**Audience**: Plugin authors, dashboard YAML authors, command palette / automations  
**Transport**: In-process Nightshift SDK (not HTTP)

## Plugin manifest

| Field        | Value                                                                                 |
| ------------ | ------------------------------------------------------------------------------------- |
| `id`         | `habit`                                                                               |
| Package      | `@nightshift/plugin-habit`                                                            |
| Capabilities | `entities:read`, `entities:write`, `widgets:register`, `commands:register`, `storage` |

## Entity

| Id              | Title         | Shape                                              |
| --------------- | ------------- | -------------------------------------------------- |
| `habit.tracker` | Habit tracker | See [data-model.md](../data-model.md) `HabitState` |

## Widget

| Type            | Title  | Entities            | Notes                                       |
| --------------- | ------ | ------------------- | ------------------------------------------- |
| `habit.tracker` | Habits | `['habit.tracker']` | Rolling 7-day grid; density adapts to width |

Dashboard YAML example:

```yaml
type: habit.tracker
title: Habits
```

## Commands

All commands are idempotent where noted; invalid args no-op or no-op with log (must not throw out of the host).

### `habit.add`

| Arg    | Type   | Required | Description            |
| ------ | ------ | -------- | ---------------------- |
| `name` | string | yes      | Trimmed; empty → no-op |

**Effect**: Appends habit with new `id`; persists.

### `habit.toggle`

| Arg    | Type   | Required | Description                                                                     |
| ------ | ------ | -------- | ------------------------------------------------------------------------------- |
| `id`   | string | yes      | Habit id                                                                        |
| `date` | string | no       | `YYYY-MM-DD`; default `today`                                                   |
|        |        |          | Must be ≤ today and within retained history policy; UI only offers window dates |

**Effect**: Toggles completion for `(id, date)`; persists; streaks recompute on read.

### `habit.rename`

| Arg    | Type   | Required | Description            |
| ------ | ------ | -------- | ---------------------- |
| `id`   | string | yes      |                        |
| `name` | string | yes      | Trimmed; empty → no-op |

### `habit.remove`

| Arg  | Type   | Required | Description                       |
| ---- | ------ | -------- | --------------------------------- |
| `id` | string | yes      | Removes habit and its completions |

## Storage schema (v1)

Key: `state`

```json
{
  "version": 1,
  "habits": [
    { "id": "…", "name": "Meditate", "createdAt": "2026-08-11T12:00:00.000Z" }
  ],
  "completions": {
    "…": ["2026-08-09", "2026-08-10", "2026-08-11"]
  }
}
```

Unknown `version` or corrupt JSON → treat as empty state and log; do not crash.

## Non-goals (contract)

- No `network` / `shell` capability.
- No HTTP API.
- No automation definitions required in v1 (commands are enough for later hooks).
