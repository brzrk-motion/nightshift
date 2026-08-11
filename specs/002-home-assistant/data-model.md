# Data Model: Home Assistant Scenes

**Feature**: `002-home-assistant` | **Date**: 2026-08-11

## Overview

Durable secrets live in plugin storage. Live UI state is two entities: connection (non-secret status) and scenes (catalog). Vibe bindings are not stored in the plugin — they are vibe YAML commands referencing `entity_id`.

## Entities

### ConnectionCredentials (storage only)

| Field | Type | Rules |
|-------|------|--------|
| `version` | `1` | Schema version |
| `baseUrl` | string | Absolute normalized origin, e.g. `http://192.168.1.10:8123` (no trailing slash, no path) |
| `token` | string | Non-empty long-lived access token; never copied to entities |

**Lifecycle**: absent → configured → updated → cleared.

### ConnectionState (entity `home-assistant.connection`)

| Field | Type | Rules |
|-------|------|--------|
| `configured` | boolean | True when storage has usable baseUrl+token |
| `baseUrl` | string \| null | Display/copy of configured origin; null if unconfigured |
| `status` | `'idle' \| 'connecting' \| 'connected' \| 'error'` | UI status |
| `error` | string \| null | Last recoverable error message |
| `lastSyncedAt` | number \| null | Epoch ms of last successful scene sync |

**Invariant**: No `token` field.

### Scene

| Field | Type | Rules |
|-------|------|--------|
| `entityId` | string | HA id; must match `/^scene\.[a-z0-9_]+$/` (HA entity_id charset) |
| `name` | string | `attributes.friendly_name` if non-empty string, else `entityId` |
| `state` | string \| null | Raw HA state string if present (informational) |

### ScenesState (entity `home-assistant.scenes`)

| Field | Type | Rules |
|-------|------|--------|
| `scenes` | `Scene[]` | Sorted by `name` (case-insensitive), then `entityId` |
| `loading` | boolean | True while a list/refresh is in flight |
| `error` | string \| null | List/refresh error; activate errors prefer notify + connection/error as needed |
| `activatingId` | string \| null | `entityId` currently activating, else null |

## Validation rules

1. Configure rejects empty trimmed address or token; leaves prior storage unchanged.
2. Address normalization (see [contracts/plugin-surface.md](./contracts/plugin-surface.md)): produce absolute `http:`/`https:` origin or fail validation.
3. On storage load: missing/corrupt/wrong version → unconfigured empty; never throw from setup.
4. Scene list: drop any state object whose `entity_id` does not start with `scene.`.
5. Activate with unknown/empty `entity_id` → soft no-op (log/notify); do not throw.
6. HTTP 401/403 → status `error` with auth message; clear scenes or keep last good list (prefer keep last good + error banner).

## State transitions

```text
[unconfigured] --configure(ok)--> [connecting] --API ok--> [connected + scenes]
[connecting] --API fail--> [error, configured=true]
[connected] --refresh--> [loading] --ok/fail--> [connected|error]
[connected] --activate(id)--> [activatingId=id] --ok/fail--> [activatingId=null]
[configured] --clear--> [unconfigured, scenes=[]]
```

## Persistence mapping

| Layer | Key / id | Contents |
|-------|----------|----------|
| Storage | `credentials` | `{ version: 1, baseUrl, token }` |
| Entity | `home-assistant.connection` | `ConnectionState` |
| Entity | `home-assistant.scenes` | `ScenesState` |

Write-through: successful configure/clear updates storage then entities; scene sync updates entities only.
