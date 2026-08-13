# Implementation Plan: Ambient Noise

**Branch**: `linear/ambient-noise-17af` (spec dir `009-ambient-noise`) | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-ambient-noise/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Ship a bundled `@nightshift/plugin-ambient-noise` app that plays a small catalog of named ambient WAV clips from `plugins/ambient-noise/test-audio/`. The player loops the current clip, exposes simple play/pause and next/previous controls, and **crossfades** when the track changes. State lives on `ambient-noise.player`; commands are the only mutation path. Audio goes through a TypeScript mixer plus an injectable sink (`@audio/speaker` in production, silent/mock in tests). Visualization via SDK `ActivityWaveform` is optional (P3).

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ / Bun or Node 26.4+ for OpenTUI dashboards

**Primary Dependencies**: `@nightshift/sdk` (runtime Nightshift API); React + `@opentui/react` as sibling plugins; `@audio/speaker` for PCM output (miniaudio prebuilds, null backend for CI); no `network`/`shell`

**Storage**: Plugin `context.storage` JSON for last `currentClipId` (`storage` capability). Clip files are bundled assets under `test-audio/`, not storage.

**Testing**: Vitest, co-located `*.test.ts(x)` — WAV fixtures, mixer tick tests (no sleeps), fake-context setup with mock sink, widget render tests FFI-gated like weather

**Target Platform**: Linux first (ALSA/Pulse via miniaudio); macOS/Windows best-effort through the same sink; headless → silent backend

**Project Type**: Nightshift plugin workspace package (`plugins/ambient-noise/`) + CLI default plugin wiring

**Performance Goals**: Mixer produces ~50–100 ms PCM chunks without blocking the React render path; pause stops new audible output within one chunk (< 250 ms); entity `levels` refresh ~10 Hz

**Constraints**: SDK-only Nightshift imports; no `console.*`; no auto-play on startup; never throw from `setup()` on missing files or missing audio device; extra runtime dep is the speaker sink only; WAV PCM v1

**Scale/Scope**: One widget, one process-wide player, a handful of bundled clips (on the order of 3–8), no user-import playlist in v1

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

`.specify/memory/constitution.md` is still the Speckit placeholder. Gates below follow `AGENTS.md` / README / create-nightshift-app:

| Gate                                              | Status | Notes                                                                                     |
| ------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Everything is a plugin                            | PASS   | `plugins/ambient-noise`                                                                   |
| Public SDK is the only plugin interface           | PASS   | Runtime Nightshift import: `@nightshift/sdk` only; speaker is a non-Nightshift audio sink |
| Dashboards consume widgets                        | PASS   | `ambient-noise.player`                                                                    |
| Entities provide shared state                     | PASS   | `ambient-noise.player`                                                                    |
| Vibes orchestrate actions                         | PASS   | play/pause/next/previous/select commands                                                  |
| Never let one bad input break startup             | PASS   | Corrupt/missing clips → empty/unavailable; sink failure → silent/error UI                 |
| Capability model honored                          | PASS   | Auto-granted only; no network/shell; no new capability                                    |
| No console outside CLI                            | PASS   | `context.log`                                                                             |
| Tests co-located; lint/typecheck/test before done | PASS   | Mirror focus/weather                                                                      |
| Widget scales to its cells                        | PASS   | Compact vs regular layout module                                                          |

**Post-design re-check**: Still PASS — contracts are plugin entities/commands/widget plus an internal sink/mixer test API; CLI wiring is the usual default-plugin migrate; no host audio subsystem; visualization uses existing `ActivityWaveform`. Adding `@audio/speaker` is scoped to this plugin and must remain optional-at-runtime (dynamic import + NullSink).

## Project Structure

### Documentation (this feature)

```text
specs/009-ambient-noise/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
plugins/ambient-noise/
├── package.json                      # @nightshift/plugin-ambient-noise
├── tsconfig.json
├── tsconfig.typecheck.json
├── vitest.config.ts                  # copy weather (FFI gate)
├── test-audio/
│   ├── clips.json                    # id + display name + file
│   └── *.wav                         # bundled beds (and/or tiny fixtures)
└── src/
    ├── index.ts                      # definePlugin: entity, commands, own(mixer)
    ├── index.test.ts
    ├── entity.ts                     # ids, PlayerState, hydrate
    ├── catalog.ts                    # load clips.json + resolve paths
    ├── catalog.test.ts
    ├── wav.ts                        # RIFF PCM parser / resample-upmix
    ├── wav.test.ts
    ├── mixer.ts                      # loop, equal-power crossfade, levels
    ├── mixer.test.ts
    ├── sink.ts                       # AudioSink + speaker / NullSink
    ├── sink.test.ts
    ├── scale.ts                      # compact | regular | wide
    ├── scale.test.ts
    ├── widgets.tsx                   # name + transport + optional waveform
    └── widgets.test.tsx

apps/cli/package.json                 # workspace dep
packages/services/src/config.ts       # DEFAULT plugins + migrate v9 → v10
packages/services/src/config.test.ts  # migration coverage
README.md                             # bundled plugin list
.changeset/                           # user-visible ship
```

**Structure Decision**: Mirror `plugins/focus` (plugin package, entity + commands + one widget) with extra pure modules for catalog/wav/mixer/sink like weather’s client split. No new `packages/*`. Assets stay in `test-audio/` (user-specified) and are listed in `package.json` `files` so they ship next to `dist/`.

## Complexity Tracking

> No constitution violations requiring justification. `@audio/speaker` is an extra runtime dependency; it is required to reach a real device and is isolated behind `AudioSink` so tests and headless hosts never need it. A host-level `audio` capability was considered and rejected for v1 (see [research.md](./research.md)).
