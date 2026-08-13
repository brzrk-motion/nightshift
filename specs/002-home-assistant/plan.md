# Implementation Plan: Home Assistant Scenes

**Branch**: `002-home-assistant` | **Date**: 2026-08-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-home-assistant/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Ship a bundled `@nightshift/plugin-home-assistant` plugin that stores HA base URL + long-lived token in plugin storage, lists `scene.*` entities via the HA REST API, lets the user activate scenes from a dashboard widget, and exposes `home-assistant.activate-scene` for vibe `onActivate`/`onDeactivate` bindings. Includes a minimal host change so `context.fetch` may use `http:` only for loopback/private IPs (local HA), while public cleartext HTTP remains denied.

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ / Bun or Node 26.4+ for OpenTUI FFI dashboards

**Primary Dependencies**: `@nightshift/sdk` (runtime); React + `@opentui/react` as used by sibling plugins; Home Assistant REST API (HTTPS or private-network HTTP)

**Storage**: Plugin `context.storage` JSON for credentials (`storage` capability); live non-secret connection + scene catalog via entities

**Testing**: Vitest, co-located `*.test.ts(x)` — pure normalize/filter/storage tests; mocked `fetch` client tests; fake-context setup tests; host tests for private-HTTP allowlist

**Target Platform**: Terminal dashboard (OpenTUI), talking to a user-run Home Assistant instance on LAN or remote HTTPS

**Project Type**: Nightshift plugin workspace package (`plugins/home-assistant/`) + small fetch-gate tweak in `packages/services` (+ SDK doc comment)

**Performance Goals**: Scene list load and activate within HA/network latency; 15s fetch timeout (host default); no polling required for v1 beyond refresh-on-connect and manual refresh

**Constraints**: SDK-only plugin imports; no `console.*`; token never in entity state; soft-fail all HA errors; `network` grant required in `config.json` / defaults; keyboardCapture when using `TextInput`

**Scale/Scope**: Personal HA — tens to low hundreds of scenes; scenes-only (no full entity control plane)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

`.specify/memory/constitution.md` is still the Speckit placeholder (principles not ratified). Gates below are taken from project law in `AGENTS.md` / README design principles:

| Gate                                              | Status          | Notes                                                                       |
| ------------------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| Everything is a plugin                            | PASS            | New work lives in `plugins/home-assistant`                                  |
| Public SDK is the only plugin interface           | PASS            | Runtime dep: `@nightshift/sdk` only                                         |
| Dashboards consume widgets                        | PASS            | Widget type `home-assistant.scenes`                                         |
| Vibes orchestrate actions                         | PASS            | Vibe YAML calls `home-assistant.activate-scene`                             |
| Entities provide shared state                     | PASS            | Connection + scenes entities; secrets only in storage                       |
| Automations react to events                       | PASS (optional) | Commands sufficient for vibes; no required automation in MVP                |
| Never let one bad input break startup             | PASS            | Defensive storage parse; HA failures soft                                   |
| Capability model honored                          | PASS            | Declares `network` + storage/entity/widget/command; default grant migration |
| No console outside CLI                            | PASS            | `context.log` / `context.notify`                                            |
| Tests co-located; lint/typecheck/test before done | PASS            | Mirror weather/spotify                                                      |

**Host fetch exception**: Allowing private-network `http:` is a deliberate, narrowly scoped change to the documented HTTPS-only fetch rule, justified in [research.md](./research.md). Public HTTP remains denied.

**Post-design re-check**: Still PASS — contracts stay plugin entity/commands/widget + documented vibe YAML; host change limited to fetch URL policy + tests; no reverse deps from plugin into services.

## Project Structure

### Documentation (this feature)

```text
specs/002-home-assistant/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
plugins/home-assistant/
├── package.json                      # @nightshift/plugin-home-assistant
├── tsconfig.json
├── tsconfig.typecheck.json
├── vitest.config.ts                  # copy weather (FFI-gated widget tests)
└── src/
    ├── index.ts                      # definePlugin setup
    ├── index.test.ts
    ├── entity.ts                     # entity ids + state types + initials
    ├── url.ts                        # normalize/validate base address
    ├── url.test.ts
    ├── storage.ts                    # load/save credentials + guards
    ├── storage.test.ts
    ├── client.ts                     # check/listScenes/activateScene via fetch
    ├── client.test.ts
    ├── scenes.ts                     # filter/map HA states → Scene[]
    ├── scenes.test.ts
    └── widgets.tsx                   # configure form + scene list UI
        widgets.test.tsx

packages/services/src/plugins/
├── host.ts                           # allow http for loopback/private IPv4
└── host.test.ts                      # cover allow + deny cases

packages/sdk/src/index.ts             # update fetch JSDoc to match policy

apps/cli/package.json                 # workspace dep

packages/services/src/config.ts       # DEFAULT_CONFIG plugins + network grant + migration bump
```

**Structure Decision**: Mirror `plugins/spotify` / `plugins/weather` — one plugin package with pure client/domain modules and one widget. Host changes only for (1) private-HTTP fetch allowlist and (2) default plugin wiring/migration. No new `packages/*` library.

## Complexity Tracking

| Violation                                           | Why Needed                                                               | Simpler Alternative Rejected Because                              |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Host `context.fetch` allows private-network `http:` | Local HA is almost always cleartext on LAN IP:8123; user ask is IP-first | HTTPS-only would force Nabu Casa/TLS proxy before any scene works |
