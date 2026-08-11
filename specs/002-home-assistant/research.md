# Research: Home Assistant Scenes Plugin

**Feature**: `002-home-assistant` | **Date**: 2026-08-11

## Decision: Ship as `@nightshift/plugin-home-assistant`

**Rationale**: Nightshift rule — everything is a plugin; SDK-only runtime deps. Matches weather/spotify (network + storage + in-widget configure).

**Alternatives considered**:
- Host package under `packages/` — rejected; third parties could not ship the same surface.
- Shell out to `hass-cli` — rejected; needs `shell` capability and external install.

## Decision: Home Assistant REST API for list + activate

**Rationale**: Official REST API accepts JSON + `Authorization: Bearer <long-lived token>`. Scenes are entities with ids `scene.*`. Activation is `POST /api/services/scene/turn_on` with body `{"entity_id":"scene.…"}`. Listing uses `GET /api/states` filtered to `entity_id` prefix `scene.`, or `GET /api/` as a lightweight reachability check.

Sources: developers.home-assistant REST API docs (`/home-assistant/developers.home-assistant` via Context7); home-assistant.io HTTP integration Bearer examples.

**Alternatives considered**:
- WebSocket API — richer/push updates; unnecessary for v1 list+activate; harder to test.
- MQTT — out of band; not the user’s ask.

## Decision: Allow `http:` fetch only for loopback / private IPs (small host change)

**Rationale**: User ask is explicitly “IP address”. Local HA defaults to `http://<lan-ip>:8123`. Current `context.fetch` refuses all non-HTTPS URLs (`packages/services/src/plugins/host.ts`), which would block the primary setup path. Extend the gate to allow `http:` when the hostname is loopback (`localhost`, `127.0.0.1`, `::1`) or an IPv4 private address (RFC1918: `10/8`, `172.16/12`, `192.168/16`). Keep refusing cleartext HTTP to public hostnames. HTTPS remains allowed for any host (Nabu Casa / reverse proxy).

**Alternatives considered**:
- HTTPS-only (no host change) — simpler code; rejects the “enter my IP” UX for most installs.
- Allow all `http:` when `network` is granted — too broad.
- New capability `network:insecure` — extra config surface for one plugin; YAGNI if private-IP rule is enough.

## Decision: Credentials in `context.storage`; non-secret status in entities

**Rationale**: Same pattern as Spotify session secrets. Entity store is shared/observable (e.g. `core.entities`); never put the token there. Persist `{ version, baseUrl, token }`; expose `home-assistant.connection` with `{ configured, baseUrl, status, error, lastSyncedAt }` (baseUrl OK to show; token never).

**Alternatives considered**:
- User-edited file in home directory — unnecessary; token is secret, not a hand-edited doc like `todo.md`.
- OS keychain — no existing SDK surface; defer.

## Decision: Vibe binding = command on vibe `onActivate`

**Rationale**: Vibes already run commands (`packages/vibes` `onActivate` / `onDeactivate`). A command `home-assistant.activate-scene` with `{ entity_id }` is the smallest integration that matches “tie scenes to vibes” and stays editable in vibe YAML. Soft-fail inside the command so one HA outage does not stop other activate actions (engine already continues after action failures; plugin must not throw).

**Alternatives considered**:
- Plugin watches `nightshift.vibe` and stores vibe→scene maps — duplicate of vibe actions; more UI/state; defer.
- New automation trigger type for vibe changes — host change; unnecessary.

## Decision: In-widget configure form (Spotify-style)

**Rationale**: Weather/Spotify already teach “empty → credentials form → connected UI”. Collect address + token with `TextInput` + `keyboardCapture` discipline; commands `home-assistant.configure` / `home-assistant.clear` / `home-assistant.refresh` / `home-assistant.activate-scene`.

**Alternatives considered**:
- CLI-only configure — weaker for a dashboard-first product.
- Config.json fields for token — secrets in a widely edited file; worse than plugin storage.

## Decision: Address normalization

**Rationale**: Accept bare IPv4, `host:port`, or absolute `http(s)://` URL. Default scheme `http` for bare IP/host; default port `8123` when omitted. Strip trailing slash. Reject empty / unparseable input before calling network.

**Alternatives considered**:
- Require full URL only — more precise, worse UX for “enter IP”.
- Always force HTTPS — conflicts with local IP decision above.

## Decision: Testing strategy

**Rationale**: Pure modules for URL normalize + scene filter + storage parse; HA client tests with injected `fetch` mock (assert method, path, Authorization header, body); `index.test.ts` fake `PluginContext` like weather/spotify; no live HA in CI. Host tests for private-IP HTTP allow / public HTTP deny.

**Alternatives considered**:
- Recorded fixtures only — still need mock fetch for headers/status codes.
- E2E against real HA — non-deterministic; optional manual quickstart only.
