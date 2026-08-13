# Research: Ambient Noise Plugin

**Feature**: `009-ambient-noise` | **Date**: 2026-08-13

## Decision: Ship as `@nightshift/plugin-ambient-noise`

**Rationale**: Nightshift rule — everything is a plugin; SDK-only Nightshift imports. Local looping clips with a dashboard widget match `focus` / `clock` / `system-monitor`. Spotify already occupies "control someone else's player"; this plugin owns **local** playback.

**Alternatives considered**:
- Host audio service in `packages/services` — rejected; not reusable by third parties and breaks "everything is a plugin".
- Extend the Spotify plugin — rejected; Spotify does not stream and has a different auth/network model.

## Decision: TypeScript mixer + injectable `AudioSink` (test without a device)

**Rationale**: Looping and crossfade are sample-level mix operations. Keep them in a pure module (`mixer.ts`) that reads decoded PCM, applies gains, and emits interleaved s16 stereo chunks. The sink is an interface (`write(chunk)`, `close()`) so:

- Unit tests use a capturing/null sink (no FFI, no ALSA).
- Production uses a real device sink.
- Headless/CI hosts never fail setup because the device is missing.

**Alternatives considered**:
- Drive two OS players (`aplay` × 2) and hope volumes cross — needs `shell` (not on `PluginContext`), hard to sync, poor fade control.
- Web Audio API — not available in the OpenTUI/Node process.

## Decision: Decode bundled files as WAV PCM in TypeScript

**Rationale**: Ambient beds are short-to-medium loops. WAV PCM 16-bit is trivial to parse (RIFF header + `fmt ` + `data`) with no native decoder. Resample/channel-upmix in TS to a mixer master format (44.1 kHz, stereo, s16). Catalog + files live in `plugins/ambient-noise/test-audio/`.

If files in `test-audio/` are not WAV at implementation time, convert them once (commit WAV) rather than adding mpg123/lame/ffmpeg as a runtime dependency.

**Alternatives considered**:
- MP3 via `lame` / `mpg123` — extra native decoder; YAGNI if we control the bundled assets.
- Decode with FFmpeg child process — `shell` is declare-only on the SDK; also a capability bypass if spawned via `node:child_process`.

## Decision: Output via `@audio/speaker` behind the sink, with silent fallback

**Rationale**: `@audio/speaker` (v2.3.x, 2026) writes PCM through miniaudio N-API **prebuilds**, then `process` (ffplay/sox/aplay), then a **`null` backend that keeps the timing contract**. That last backend is exactly what CI and SSH sessions need. API is `write(pcmBuffer, cb)` — matches a mixer that pushes chunks.

The dependency is **plugin-local** (`plugins/ambient-noise/package.json` only). Dynamic import so a missing native binary does not throw during `setup()`; fall back to `NullSink` and set player `output: 'silent'`.

**Alternatives considered**:
- `speaker` (TooTallNate) — mature but compiles mpg123 against `libasound2-dev`; no null backend; painful in cloud agents.
- `naudiodon` / PortAudio — extra native stack; PulseAudio hang-on-exit reports.
- New SDK `audio` capability + host sink — out of scope; would block the plugin on core work. Audio is local hardware analogous to `node:fs` (todo plugin) rather than network/shell.

**Capability note**: Do **not** declare `network` or `shell`. Do **not** add a new capability in v1. Play is opt-in (no auto-start). Missing device → unavailable/silent UI, not `PERMISSION_DENIED`.

## Decision: Equal-power crossfade on clip change only; loop by wrapping the playhead

**Rationale**: Spec splits two behaviours:

1. **Loop**: when the current clip's playhead reaches the end, wrap to 0 (same clip). Optional very short seam fade (~32–64 ms) to avoid a click — not advertised as "crossfade".
2. **Track change**: on next/previous while `playing`, run a two-source mix: outgoing gain `cos(θ)`, incoming `sin(θ)` over `CROSSFADE_MS` (default **1500**). Equal-power avoids a mid-fade dip that linear amplitude ramps cause.

Rapid skips cancel the current fade and start a new one to the latest target (max two sources in the mix).

Paused skip: change `currentClipId` only; do not open the device.

**Alternatives considered**:
- Linear amplitude ramp — quieter in the middle; worse for noise beds.
- Gapless concat without overlap — audible cut, fails FR-007.
- Crossfade on loop as well — different product; user asked for loop-when-finished and crossfade-when-changed.

## Decision: Catalog JSON maps files to display names

**Rationale**: User wants names like "Rainy Day" and "White Noise", not filenames. A `clips.json` (or equivalent) in `test-audio/`:

```json
[
  { "id": "rainy-day", "name": "Rainy Day", "file": "rainy-day.wav" },
  { "id": "white-noise", "name": "White Noise", "file": "white-noise.wav" }
]
```

Ids are kebab-case; names are what the widget draws. Implementation inspects whatever files are actually in `test-audio/` and authors the catalog (title-case from basename is the fallback if a file has no entry).

Tests generate tiny valid WAV fixtures so CI does not depend on large binaries.

**Alternatives considered**:
- Infer names only from filenames — too easy to show `rain_loop_01.wav`.
- User-editable playlist in storage — out of scope for v1.

## Decision: One player entity; commands mutate; playback is process-wide

**Rationale**: Create-nightshift-app pattern: entity is source of truth, commands are the only writes, widget is a skin. Playback should **not** stop when the widget unmounts — ambient sound is the point, and weather-style mount ref-count would silence the room when switching dashboards. Stop on pause, plugin `teardown`, and `context.own()` of the mixer/sink.

Persist `currentClipId` in `context.storage`. Never persist `playing: true` as auto-play.

**Alternatives considered**:
- Widget-local `useState` for transport — breaks palette, vibes, and a second widget instance.
- Stop audio on unmount — surprising if the user tiled another dashboard.

## Decision: Simple Spotify-style transport; visualization optional via `ActivityWaveform`

**Rationale**: Spotify already solved TUI transport glyphs (`▶` / `▮` / `◀◀` / `▶▶`, compact `«` `»`) that are one cell wide. Reuse that treatment with `Toolbar` + `Button`/`IconButton`. Clip **name** is the hero text.

SDK `ActivityWaveform` is documented as a pulse strip for ambient activity — a natural fit. Mixer publishes a short RMS (or peak) ring buffer on the entity at ~10 Hz, not every sample. Compact layout omits it (P3).

**Alternatives considered**:
- ASCII spectrum FFT — heavy, easy to overflow a cell, not requested.
- New UI primitive — 007 already shipped `ActivityWaveform`.

## Decision: Testing strategy

**Rationale**:

| Layer | How |
|-------|-----|
| WAV parse | Fixture buffers (header + a few frames); reject truncated/non-PCM |
| Mixer | Deterministic: known buffers, assert loop wrap, equal-power mix during fade, pause zeros output |
| Catalog | Temp dir with `clips.json` + wav; missing file → skip/unavailable |
| `setup()` | Fake `PluginContext` (weather/focus pattern); mock sink; assert commands write entity |
| Widget | `testRender` + FFI skipIf; assert name + play/pause labels at compact vs regular sizes |

No sleeps: mixer `tick(sampleCount)` is pull-based in tests; production uses sink backpressure/`setInterval` unref'd and owned.

## Decision: Bundled CLI wiring, no extra permissions

**Rationale**: Same checklist as system-monitor: `apps/cli` workspace dep, `DEFAULT_CONFIG.plugins`, `CONFIG_VERSION` 9 → 10 + migrate, changeset, README bullet. No `pluginPermissions` entry.

**Alternatives considered**:
- Discover-only (drop in config `plugins/`) — user asked for a fully featured bundled app.
