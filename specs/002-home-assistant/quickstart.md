# Quickstart: Home Assistant scenes validation

**Feature**: `002-home-assistant`  
**Purpose**: Prove the plugin works end-to-end after implementation. Not an implementation guide.

## Prerequisites

- Repo root: `pnpm install`
- Node 22+ (Node 26.4+ or Bun for a live dashboard)
- Feature dir: `specs/002-home-assistant` ([plan.md](./plan.md))
- Either a real Home Assistant with a long-lived token, **or** rely on automated mocks only for CI

## Setup

```bash
pnpm install
pnpm --filter @nightshift/plugin-home-assistant build
pnpm --filter @nightshift/services test
pnpm build
```

Confirm defaults in [contracts/plugin-surface.md](./contracts/plugin-surface.md):

- `@nightshift/plugin-home-assistant` in default plugins
- `pluginPermissions["home-assistant"]` includes `network`

Add the widget to a dashboard YAML:

```yaml
type: home-assistant.scenes
title: Scenes
```

Optional vibe binding:

```yaml
name: locked-in
onActivate:
  - command: home-assistant.activate-scene
    args:
      entity_id: scene.your_scene
```

(See also vibe YAML `onActivate` / `onDeactivate` in the Nightshift vibe guide.)

## Automated checks

```bash
pnpm --filter @nightshift/plugin-home-assistant test
pnpm --filter @nightshift/plugin-home-assistant typecheck
pnpm --filter @nightshift/plugin-home-assistant lint
pnpm --filter @nightshift/services test
```

Expected:

- URL normalize table matches [contracts/plugin-surface.md](./contracts/plugin-surface.md)
- Client mock asserts Bearer header + `scene.turn_on` body
- Corrupt storage → unconfigured safe state
- Host: `http://192.168.0.2/` allowed with `network`; `http://example.com/` denied; `https://example.com/` allowed

## Manual UI validation (optional real HA)

```bash
pnpm start
```

1. Open dashboard with `home-assistant.scenes`.
2. Enter LAN IP (or URL) + long-lived token → connected; scenes listed.
3. Activate a scene → HA applies it; success feedback in UI/toast.
4. Activate a vibe wired to `home-assistant.activate-scene` → scene runs; with HA stopped, vibe still switches and failure is notified/logged.
5. Clear/reconfigure credentials → form returns; new token used after save.
6. Restart Nightshift → still configured; scenes reload.

## Pass criteria

Aligned with [spec.md](./spec.md) success criteria: configure+list under ~2 minutes on a working instance; one `scene.turn_on` per UI activate; vibe soft-fail; automated coverage for auth/network/empty/corrupt paths; misconfig never blocks host startup.
