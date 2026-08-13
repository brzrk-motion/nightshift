# Quickstart: Ambient Noise validation

**Feature**: `009-ambient-noise`  
**Purpose**: Prove the plugin works end-to-end after implementation. Not an implementation guide.

## Prerequisites

- Repo root: `pnpm install`
- Node 22+ (Node 26.4+ or Bun for a live dashboard)
- Host with a working audio output for manual listen tests (automated tests use a mock/silent sink)
- Clips under `plugins/ambient-noise/test-audio/` plus [clips.json](./contracts/plugin-surface.md)
- Feature dir: `specs/009-ambient-noise` ([plan.md](./plan.md))

## Setup

```bash
pnpm install
pnpm --filter @nightshift/plugin-ambient-noise build
pnpm build
```

Add the widget to a dashboard YAML:

```yaml
type: ambient-noise.player
title: Ambient
```

Confirm `@nightshift/plugin-ambient-noise` appears in CLI default plugins after implementation (see [contracts/plugin-surface.md](./contracts/plugin-surface.md)).

## Automated checks

```bash
pnpm --filter @nightshift/plugin-ambient-noise test
pnpm --filter @nightshift/plugin-ambient-noise typecheck
pnpm --filter @nightshift/plugin-ambient-noise lint
```

Expected:

- WAV parser: valid fixture → PCM frames; truncated/non-PCM → error without throw from setup
- Mixer loop: playhead wraps; output continues
- Mixer crossfade: during fade, mixed samples are a blend of clip A and B (not a hard cut to B)
- Next/previous wrap at catalog ends
- Pause: subsequent ticks are silence / mixer not emitting to sink
- Catalog: missing file → clip unavailable; empty dir → empty player state
- Storage: unknown `currentClipId` → first ok clip
- Setup: fake context registers entity, commands, widget; play/pause/next mutate state with mock sink

## Manual UI validation (machine with speakers)

```bash
pnpm start
```

1. Open a dashboard with `ambient-noise.player`.
2. Confirm a display name such as "Rainy Day" or "White Noise" (not a raw `.wav` basename).
3. Activate play — hear the clip; confirm it loops after it ends.
4. Activate pause — sound stops; name unchanged.
5. Play again, then next — name changes and the new clip fades in over ~1.5 s (no hard cut).
6. Previous returns to the earlier clip with a fade if still playing.
7. Next on the last clip wraps to the first.
8. Compact the slot — name + play/pause remain usable.
9. Quit Nightshift — audio stops.

Headless: play shows `silent` / unavailable hint; no crash.

## Pass criteria

Aligned with [spec.md](./spec.md):

- SC-001: named clip plays and loops
- SC-002: next/previous crossfade while playing
- SC-003: pause stops output promptly
- SC-004: automated coverage without a real device
- SC-005: failures never block host startup

## References

- Data shapes: [data-model.md](./data-model.md)
- Commands/entities/widget: [contracts/plugin-surface.md](./contracts/plugin-surface.md)
- Engine decisions: [research.md](./research.md)
