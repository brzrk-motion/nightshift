# Contract: Ambient Noise plugin surface

**Feature**: `009-ambient-noise`  
**Audience**: Dashboard YAML authors, vibe/automation authors, plugin maintainers  
**Transport**: In-process Nightshift SDK; local WAV/MP3 files; local audio device

## Plugin manifest

| Field        | Value                                                                                 |
| ------------ | ------------------------------------------------------------------------------------- |
| `id`         | `ambient-noise`                                                                       |
| Package      | `@nightshift/plugin-ambient-noise`                                                    |
| Capabilities | `entities:read`, `entities:write`, `widgets:register`, `commands:register`, `storage` |

No `network` or `shell` grant. Bundled with CLI defaults (same pattern as `focus` / `clock` / `system-monitor`).

## Entities

| Id                     | Title         | Shape                           |
| ---------------------- | ------------- | ------------------------------- |
| `ambient-noise.player` | Ambient noise | [PlayerState](../data-model.md) |

## Widget

| Type                   | Title         | Entities               | Notes                               |
| ---------------------- | ------------- | ---------------------- | ----------------------------------- |
| `ambient-noise.player` | Ambient noise | `ambient-noise.player` | Name + transport; optional waveform |

Dashboard YAML:

```yaml
type: ambient-noise.player
title: Ambient
```

No required widget `options` in v1.

## Commands

Invalid args soft-fail (log); must not throw to the host.

### `ambient-noise.play`

No args. Starts or resumes the current clip. No-op if catalog empty or no `ok` clip.

**Effect**: `status` → `loading` while the clip decodes, then `playing` (or `unavailable` / keeps `empty`). Opens the audio sink lazily. Pause during `loading` cancels the in-flight play.

### `ambient-noise.pause`

No args. Stops output. No-op if not `loading`, `playing`, or `fading`.

**Effect**: `status` → `paused`.

### `ambient-noise.toggle`

No args. Play if paused/idle; pause if loading/playing/fading.

### `ambient-noise.next`

No args. Selects the next catalog clip (wrap). If playing, starts a crossfade to that clip.

### `ambient-noise.previous`

No args. Selects the previous catalog clip (wrap). If playing, starts a crossfade to that clip.

### `ambient-noise.select` (optional convenience)

| Arg  | Type   | Required | Description     |
| ---- | ------ | -------- | --------------- |
| `id` | string | yes      | Catalog clip id |

**Effect**: Same as jumping to that clip (crossfade if playing). Unknown id → no-op.

## Catalog file contract

Path: `plugins/ambient-noise/test-audio/clips.json` (shipped with the package; resolved via `import.meta.url` / package root, not `cwd`).

```json
[
  {
    "id": "rainy-day",
    "name": "Rainy Day",
    "file": "whitenoisesleepers-rainy-day-in-town-with-birds-singing-194011.mp3"
  },
  {
    "id": "soft-static",
    "name": "Soft Static",
    "file": "freesound_community-soft-static-noise-5934.mp3"
  },
  {
    "id": "ambient-noise",
    "name": "Ambient Noise",
    "file": "soul_serenity_sounds-ambient-noise-236388.mp3"
  }
]
```

| Field  | Required | Rules                                                 |
| ------ | -------- | ----------------------------------------------------- |
| `id`   | yes      | `/^[a-z][a-z0-9-]*$/`                                 |
| `name` | yes      | non-empty trimmed string                              |
| `file` | yes      | relative path, no `..`, must stay under `test-audio/` |

Unknown JSON keys ignored (forward-compatible). Duplicate ids: last wins or first wins — pick one in implementation tests and keep it.

WAV v1: PCM, 16-bit preferred; bundled beds may also be MP3 (decoded at play). Other bit depths converted or rejected as `unavailable`.

## Audio sink contract (internal, test-facing)

Not SDK surface. Exported for tests from the plugin package.

```ts
interface AudioSink {
  write(chunk: Buffer | Uint8Array): Promise<void> | void;
  close(): void;
  readonly backend: 'device' | 'silent' | 'error';
}
```

| Implementation                              | When                                        |
| ------------------------------------------- | ------------------------------------------- |
| Device (`@audio/speaker` miniaudio/process) | Play on a host with output                  |
| Silent (null backend or test capture)       | CI, headless, missing native addon          |
| Error                                       | Device open threw; entity `output: 'error'` |

Mixer tests never construct the device sink.

## Mixer contract (internal, test-facing)

| Function / method                   | Input       | Output                                  |
| ----------------------------------- | ----------- | --------------------------------------- |
| `loadWav(bytes)`                    | Uint8Array  | `PcmBuffer` or throw/`Error`            |
| `tick(frames)`                      | frame count | interleaved s16 chunk; updates playhead |
| `play()` / `pause()`                | —           | run flag                                |
| `skipTo(clipId, { fade: boolean })` | target id   | starts fade or hard-switch if paused    |

Loop: `frame = frame % frameCount` when not fading. Crossfade: two sources, equal-power gains over `crossfadeMs`.

## Storage schema (v1)

Key: `settings`

```json
{
  "version": 1,
  "currentClipId": "rainy-day"
}
```

## Failure behavior

| Condition                              | Behavior                                                             |
| -------------------------------------- | -------------------------------------------------------------------- |
| Missing `test-audio/` or empty catalog | `status: 'empty'`; EmptyState; commands no-op                        |
| Missing clip file                      | that clip `unavailable` at catalog load; others play                 |
| Decode/play failure                    | toast; `status: 'paused'` with `error`; clip stays `ok` for retry    |
| All clips unavailable                  | `status: 'unavailable'`                                              |
| No audio device / silent backend       | play still updates state; `output: 'silent'` + hint                  |
| Device open failure                    | `output: 'error'`; toast once (`key: 'output'`); Nightshift stays up |
| Corrupt storage                        | first `ok` clip; not playing                                         |
| Plugin unload                          | sink closed; timer cleared                                           |

## SDK components used by widget

From `@nightshift/sdk`:

- `Button` / `Toolbar` — transport (Spotify glyph pattern)
- `ActivityWaveform` — optional levels (P3)
- `EmptyState`, `ErrorState`
- `useEntity`, `useCommands`, `useTheme`

No new UI primitives. No `TextInput` (no keyboard capture issue).

## Vibe / automation usage

```yaml
onActivate:
  - command: ambient-noise.select
    args: { id: rainy-day }
  - command: ambient-noise.play
onDeactivate:
  - command: ambient-noise.pause
```
