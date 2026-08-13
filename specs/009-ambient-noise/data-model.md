# Data Model: Ambient Noise

**Feature**: `009-ambient-noise` | **Date**: 2026-08-13

## Overview

The clip catalog is bundled (files + names). Live transport lives on one player entity. Mixer playheads and gains are in-memory only. The last selected clip id is durable in plugin storage.

## Entities

### Clip (catalog entry, not a Nightshift entity)

| Field        | Type                    | Rules                                               |
| ------------ | ----------------------- | --------------------------------------------------- |
| `id`         | string                  | kebab-case, unique, stable                          |
| `name`       | string                  | Non-empty display name ("Rainy Day")                |
| `file`       | string                  | Path relative to `test-audio/`                      |
| `durationMs` | number \| null          | Set after successful decode; null if not yet loaded |
| `status`     | `'ok' \| 'unavailable'` | File missing/corrupt → `unavailable`                |

Catalog is loaded at setup from `test-audio/clips.json` (or equivalent) plus the files on disk. Order in the file is cycle order.

### PlayerState (entity `ambient-noise.player`)

| Field           | Type                                                                                   | Default                     | Rules                                                                   |
| --------------- | -------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `clips`         | `ClipPublic[]`                                                                         | `[]`                        | Public view: `id`, `name`, `status` (no filesystem paths on the entity) |
| `currentClipId` | string \| null                                                                         | first ok clip or null       | Must be an id in `clips` or null                                        |
| `currentName`   | string                                                                                 | `''`                        | Denormalized display name for the widget                                |
| `status`        | `'idle' \| 'loading' \| 'playing' \| 'paused' \| 'fading' \| 'unavailable' \| 'empty'` | `'empty'` if no clips       | See transitions                                                         |
| `output`        | `'device' \| 'silent' \| 'error'`                                                      | `'silent'` until sink opens | `error` if device open failed after play                                |
| `outputMessage` | string \| null                                                                         | null                        | Short hint when silent/error                                            |
| `positionMs`    | number                                                                                 | 0                           | Playhead of the audible clip (incoming during fade)                     |
| `durationMs`    | number \| null                                                                         | null                        | Current clip duration                                                   |
| `crossfadeMs`   | number                                                                                 | 1500                        | Active fade length (constant in v1)                                     |
| `levels`        | `number[]`                                                                             | `[]`                        | Recent RMS/peak 0–1 for `ActivityWaveform`; cap ~48                     |
| `error`         | string \| null                                                                         | null                        | Decode/play error for current clip                                      |

`ClipPublic`: `{ id: string, name: string, status: 'ok' | 'unavailable' }`.

Index signature required so the state is `Json`.

### MixerInternals (in-memory only, not entity)

| Field           | Type                              | Rules                                  |
| --------------- | --------------------------------- | -------------------------------------- |
| `buffers`       | `Map<id, PcmBuffer>`              | Decoded s16 stereo @ mixer sample rate |
| `primary`       | `{ clipId, frame }` \| null       | Current/outgoing source                |
| `incoming`      | `{ clipId, frame, gain }` \| null | Set only during track-change fade      |
| `fadeRemaining` | number (frames)                   | 0 when not fading                      |
| `playing`       | boolean                           | Master run flag                        |
| `sink`          | `AudioSink`                       | Device, null, or test capture          |
| `timer`         | handle \| null                    | Owned via `context.own()`              |

### PcmBuffer (in-memory)

| Field        | Type         | Rules                                    |
| ------------ | ------------ | ---------------------------------------- |
| `sampleRate` | number       | Mixer master (44100)                     |
| `channels`   | 2            | Stereo interleaved                       |
| `frames`     | `Int16Array` | Interleaved L,R; length = frameCount × 2 |

### StoredSettings (plugin storage key `settings`)

| Field           | Type           | Default | Rules                                           |
| --------------- | -------------- | ------- | ----------------------------------------------- |
| `version`       | `1`            | `1`     | Schema version                                  |
| `currentClipId` | string \| null | null    | Last selected clip; hydrate if still in catalog |

Do not persist `playing`.

## Validation rules

1. Unknown command clip ids and bad args → no-op (log, do not throw).
2. Empty catalog → `status: 'empty'`; play/next/previous no-op.
3. `currentClipId` pointing at an unavailable clip → skip to next `ok` clip on play; if none, `unavailable`.
4. Crossfade duration clamped to `min(CROSSFADE_MS, durationA, durationB)` so a clip shorter than the fade still mixes.
5. `levels` values clamped 0–1; array capped at `LEVELS_LEN`.
6. Corrupt storage → defaults (first catalog clip, not playing).
7. Cycle wrap: index ± 1 modulo catalog length (skip `unavailable` on play).

## State transitions

```text
[setup]
  --> load catalog + hydrate currentClipId
  --> status empty | paused (never auto-play)
  --> register sink factory (lazy)

[play] (from paused/idle, has ok clip)
  --> status loading while the clip decodes
  --> open sink if needed
  --> playing; start mixer ticks
  --> output device | silent | error

[pause] (from loading | playing | fading)
  --> cancel in-flight load if status was loading
  --> stop ticks; close or pause sink
  --> paused; keep currentClipId and position

[next | previous] while paused
  --> currentClipId / currentName change
  --> persist currentClipId
  --> positionMs = 0

[next | previous] while playing
  --> status fading
  --> incoming = target; equal-power mix
  --> on fade complete: primary = incoming; status playing

[loop wrap]
  --> primary.frame = 0 (optional short seam fade)
  --> status remains playing

[teardown / unload]
  --> stop mixer; close sink
```

## Persistence mapping

| Layer   | Key / id                             | Contents                        |
| ------- | ------------------------------------ | ------------------------------- |
| Files   | `plugins/ambient-noise/test-audio/*` | WAV clips + `clips.json`        |
| Storage | `settings`                           | `{ version: 1, currentClipId }` |
| Entity  | `ambient-noise.player`               | `PlayerState`                   |

## Display mapping (widget)

| Slot    | What to draw                                                 |
| ------- | ------------------------------------------------------------ |
| Compact | `currentName` + play/pause                                   |
| Regular | name + previous / play-pause / next                          |
| Wide    | regular + `ActivityWaveform` from `levels` when playing (P3) |

Empty → `EmptyState` ("No ambient clips"). Output error → `ErrorState` with hint, transport still shown if clips exist.
