# Feature Specification: Home Assistant Scenes

**Feature Branch**: `002-home-assistant`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "We need a new plugin for our Home Assistant app, it should ask the user for their home assistant ip address and an access token to be configured, from there it should expose the different scenes in home assistant and let the user trigger them from the UI. We also need to be able to tie scenes to different Vibes in nightshift, so when we change the vibe, home automation scenes will trigger as well. This needs to be robust and highly tested, and it should remain simple, change scenes, and automate them with vibes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect to Home Assistant (Priority: P1)

A user opens the Home Assistant widget for the first time, enters their Home Assistant address (IP or URL) and a long-lived access token, and saves. The plugin validates the connection and shows a connected state (or a clear error if the instance or token is wrong).

**Why this priority**: Without credentials and a working connection, scenes cannot be listed or triggered.

**Independent Test**: Enter a valid base address + token against a stub/mock HA API; confirm connected state and that the token is not shown back in plain entity dumps after save. Enter invalid token; confirm error state without crashing Nightshift.

**Acceptance Scenarios**:

1. **Given** the plugin is not configured, **When** the user saves a non-empty address and token, **Then** credentials are persisted and a connection check runs.
2. **Given** valid credentials, **When** the connection check succeeds, **Then** the widget shows a connected/ready state and can load scenes.
3. **Given** invalid credentials or unreachable HA, **When** the connection check fails, **Then** the widget shows a recoverable error message and Nightshift keeps running.
4. **Given** saved credentials, **When** Nightshift restarts, **Then** the plugin restores them and reconnects without re-entry.

---

### User Story 2 - Browse and trigger scenes (Priority: P1)

A connected user sees the list of Home Assistant scenes and can activate one from the widget. Activation feedback is immediate (success or failure) without leaving the dashboard.

**Why this priority**: Core product value — list scenes and change them from the UI.

**Independent Test**: Seed a mock HA with three `scene.*` entities; open the widget; activate one; confirm the mock received `scene.turn_on` for that entity id and the UI reflects success (or a toast/error on failure).

**Acceptance Scenarios**:

1. **Given** a connected instance with scenes, **When** the scene list loads, **Then** each scene shows a human-readable name and can be activated.
2. **Given** a listed scene, **When** the user activates it, **Then** Home Assistant is asked to turn that scene on and the user gets success feedback.
3. **Given** HA rejects or times out an activation, **When** the user activates a scene, **Then** the failure is surfaced and the widget remains usable.
4. **Given** HA reports no scenes, **When** the list loads, **Then** an empty state explains that no scenes were found.

---

### User Story 3 - Trigger scenes when a vibe activates (Priority: P1)

A user ties a Home Assistant scene to a Nightshift vibe so that switching into that vibe activates the scene. The binding uses Nightshift’s existing vibe action mechanism (commands on activate), not a separate home-automation engine.

**Why this priority**: Explicit requirement; pairs with scene activation for “deep focus environment” workflows.

**Independent Test**: Configure a vibe `onActivate` that runs the plugin’s activate-scene command with a known `entity_id`; activate the vibe against a mock HA; confirm the scene service was called once.

**Acceptance Scenarios**:

1. **Given** a vibe whose `onActivate` includes the Home Assistant activate-scene command with a scene id, **When** the user activates that vibe, **Then** that scene is triggered.
2. **Given** the activate-scene command runs but HA is unreachable or misconfigured, **When** the vibe activates, **Then** vibe activation continues (other actions still run) and the failure is logged/notified rather than crashing Nightshift.
3. **Given** an activate-scene command with a missing/invalid scene id, **When** it runs, **Then** it no-ops or fails softly without throwing out of the host.

---

### User Story 4 - Reconfigure or disconnect (Priority: P2)

The user can update address/token or clear configuration from the widget when their HA instance or token changes.

**Why this priority**: Needed for real use over time; not required to demo list+trigger once connected.

**Independent Test**: Save credentials, open configure/clear, replace token, confirm subsequent scene calls use the new token; clear config and confirm the setup form returns.

**Acceptance Scenarios**:

1. **Given** saved credentials, **When** the user updates address or token and saves, **Then** the new values are used for subsequent API calls.
2. **Given** saved credentials, **When** the user clears configuration, **Then** scenes are cleared from the UI and the setup form is shown again.

---

### Edge Cases

- Empty address or empty token on save is rejected; prior config unchanged.
- Address may be entered as bare IP, `IP:port`, or full URL; invalid syntax yields a clear validation error.
- Non-scene entities from HA are never shown in the scene list.
- Duplicate friendly names are allowed; identity is the HA `entity_id`.
- Network errors, HTTP 401/403, and timeouts must not crash plugin setup or the host.
- Corrupt storage loads as unconfigured (safe empty), not a startup failure.
- Access token must not appear in entity state intended for general dashboard display.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Plugin MUST collect and persist a Home Assistant base address and long-lived access token via the widget (and matching configure command).
- **FR-002**: Plugin MUST validate connectivity using the Home Assistant REST API with Bearer token auth before treating the instance as connected.
- **FR-003**: Plugin MUST list Home Assistant scenes (`scene.*` entities) in a dashboard widget.
- **FR-004**: Users MUST be able to activate a listed scene from the widget.
- **FR-005**: Plugin MUST expose a command to activate a scene by `entity_id` so vibe `onActivate` / `onDeactivate` can call it.
- **FR-006**: Plugin MUST refresh the scene list on demand (command and/or widget action) after connect and when the user requests refresh.
- **FR-007**: Plugin MUST persist credentials across restarts using plugin storage; token MUST NOT be written into shared entity state.
- **FR-008**: Plugin MUST declare and use the `network` capability (and require the corresponding config grant) for all HA HTTP(S) calls.
- **FR-009**: Failures (bad token, unreachable host, empty scenes, activate errors) MUST surface as recoverable UI/log/notify outcomes and MUST NOT abort Nightshift startup or vibe switching.
- **FR-010**: Plugin MUST support local Home Assistant instances addressed by LAN IP (typical `http://host:8123`) as well as HTTPS remote URLs.
- **FR-011**: Automated tests MUST cover credential normalization/validation, HA client request shaping, scene filtering, soft-fail activate paths, and plugin setup against a fake context with mocked fetch.

### Key Entities *(include if feature involves data)*

- **Connection config**: Base URL + access token (durable); connection status/error (live, non-secret).
- **Scene**: Home Assistant `entity_id`, friendly name, optional state metadata for display.
- **Scene catalog**: Ordered list of scenes for the widget.
- **Vibe binding**: Not a separate store — a vibe YAML action that invokes the activate-scene command with an `entity_id`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with a working HA token can configure the plugin and see scenes in under 2 minutes.
- **SC-002**: Activating a scene from the widget results in a single corresponding HA `scene.turn_on` call for that entity in the happy path.
- **SC-003**: Activating a vibe with an `onActivate` scene command triggers that scene without blocking other vibe actions when HA fails.
- **SC-004**: Unit/integration tests for client + setup cover success, 401, timeout/network error, empty scenes, and corrupt storage → safe empty (≥ the scenarios in FR-011).
- **SC-005**: Misconfiguration never prevents Nightshift from starting or other plugins from loading.

## Assumptions

- Users create a Home Assistant long-lived access token from their HA profile (standard HA docs flow).
- Scope is **scenes only** in v1 — not lights, switches, scripts, or full entity browsers.
- Vibe ↔ scene tying uses vibe YAML `onActivate`/`onDeactivate` commands (Nightshift-native); an in-widget vibe→scene mapper is out of scope for v1.
- Default HA port is 8123 when the user enters a bare IP without a port.
- WebSocket HA API is out of scope; REST is sufficient for list + activate.
- Plugin ships bundled with the CLI like weather/spotify (default plugins + `network` grant migration).
