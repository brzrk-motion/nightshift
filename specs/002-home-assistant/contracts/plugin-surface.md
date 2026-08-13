# Contract: Home Assistant plugin surface

**Feature**: `002-home-assistant`  
**Audience**: Dashboard YAML authors, vibe YAML authors, plugin host config  
**Transport**: In-process Nightshift SDK + Home Assistant REST (outbound)

## Plugin manifest

| Field        | Value                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `id`         | `home-assistant`                                                                                 |
| Package      | `@nightshift/plugin-home-assistant`                                                              |
| Capabilities | `entities:read`, `entities:write`, `widgets:register`, `commands:register`, `storage`, `network` |

Default grant (bundled): `pluginPermissions["home-assistant"]` includes `network` (same migration pattern as weather/spotify).

## Host fetch policy (services)

`context.fetch` allows:

- `https:` for any valid host
- `http:` only when host is loopback or IPv4 private (RFC1918)

All other URLs → `NETWORK_DENIED`.

## Entities

| Id                          | Title                 | Shape                               |
| --------------------------- | --------------------- | ----------------------------------- |
| `home-assistant.connection` | Home Assistant        | [ConnectionState](../data-model.md) |
| `home-assistant.scenes`     | Home Assistant scenes | [ScenesState](../data-model.md)     |

## Widget

| Type                    | Title          | Entities                                             | Notes                                                                  |
| ----------------------- | -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `home-assistant.scenes` | Home Assistant | `home-assistant.connection`, `home-assistant.scenes` | Configure form when unconfigured; scene list + activate when connected |

Dashboard YAML:

```yaml
type: home-assistant.scenes
title: Scenes
```

## Commands

Invalid args soft-fail (log/notify); must not throw to the host.

### `home-assistant.configure`

| Arg       | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| `address` | string | yes      | IP, `host:port`, or absolute URL |
| `token`   | string | yes      | Long-lived access token          |

**Effect**: Normalize address → persist credentials → connection check → refresh scenes.

### `home-assistant.clear`

No args. Clears storage credentials and resets both entities to empty/unconfigured.

### `home-assistant.refresh`

No args. Re-fetches scene list when configured; no-op if not.

### `home-assistant.activate-scene`

| Arg         | Type   | Required | Description                                |
| ----------- | ------ | -------- | ------------------------------------------ |
| `entity_id` | string | yes      | HA scene entity id, e.g. `scene.locked_in` |

**Effect**: `POST {baseUrl}/api/services/scene/turn_on` with JSON `{"entity_id":"…"}` and Bearer token.

## Vibe binding

```yaml
name: locked-in
onActivate:
  - command: home-assistant.activate-scene
    args:
      entity_id: scene.deep_work
```

## Home Assistant HTTP contract (plugin → HA)

### Auth

All requests:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### Reachability / auth check

`GET {baseUrl}/api/` → expect 200 JSON (HA returns a message object).

### List scenes

`GET {baseUrl}/api/states` → JSON array of state objects; plugin keeps entries where `entity_id` starts with `scene.`.

### Activate scene

`POST {baseUrl}/api/services/scene/turn_on`  
Body: `{"entity_id":"scene.example"}`  
Expect 200; non-OK → soft error.

## Storage schema (v1)

Key: `credentials`

```json
{
  "version": 1,
  "baseUrl": "http://192.168.1.10:8123",
  "token": "<secret>"
}
```

## Address normalization rules

| Input                          | Result                                                |
| ------------------------------ | ----------------------------------------------------- |
| `192.168.1.10`                 | `http://192.168.1.10:8123`                            |
| `192.168.1.10:8123`            | `http://192.168.1.10:8123`                            |
| `http://192.168.1.10:8123/`    | `http://192.168.1.10:8123`                            |
| `https://example.ui.nabu.casa` | `https://example.ui.nabu.casa` (default port omitted) |
| empty / garbage                | validation error                                      |
