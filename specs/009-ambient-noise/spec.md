# Feature Specification: Ambient Noise

**Feature Branch**: `009-ambient-noise`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "We want a fully featured app that plays and cycles through a few ambient sound clips, these clips should loop when they are finished, and cross fade into one another when the track is changed. The controls should be simple, we need play and pause, as well as the ability to cycle forward and backward to different clips. Some type of audio visualization is a nice to have but is optional given the TUI interface. We do however want to give each clip a simple name like "Rainy Day" or "White Noise" in the player interface. Audio samples live in the plugin's test-audio folder."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Play a looping named clip (Priority: P1)

A user adds the Ambient Noise widget to a dashboard and sees the current clip's display name (for example "Rainy Day"). They press play and hear that clip through the local speakers. When the clip reaches the end it starts again without the user touching anything. They press pause and the sound stops; pressing play resumes the same clip.

**Why this priority**: Without named playback, looping, and play/pause there is no ambient player.

**Independent Test**: Start Nightshift with the widget on a dashboard, confirm the clip name is visible, press play, hear looping audio, press pause, confirm silence, press play again and hear the same clip continue.

**Acceptance Scenarios**:

1. **Given** the widget is on a dashboard and clips are available, **When** it first renders, **Then** it shows a human-readable clip name (not a raw filename) and a play control.
2. **Given** the player is stopped on a clip, **When** the user activates play, **Then** that clip plays through the local audio output and the UI shows a playing state.
3. **Given** a clip is playing, **When** it reaches the end, **Then** it loops from the beginning of the same clip without requiring a new play action.
4. **Given** a clip is playing, **When** the user activates pause, **Then** audio output stops and the UI shows a paused state with the same clip still selected.
5. **Given** the player is paused mid-clip, **When** the user activates play, **Then** playback resumes (same clip; starting over the clip is acceptable if resume-from-offset is not implemented).
6. **Given** no audio device is available (headless host), **When** the user activates play, **Then** the widget shows a recoverable unavailable/silent message and Nightshift keeps running.

---

### User Story 2 - Cycle clips with a crossfade (Priority: P1)

While a clip is playing (or paused), the user cycles forward or backward through the bundled set. The selected clip's name updates immediately. If audio is playing, the outgoing clip fades out while the incoming clip fades in so the change is not an abrupt cut. Cycling wraps: next on the last clip returns to the first, previous on the first returns to the last.

**Why this priority**: Explicit product requirement; cycling plus crossfade is the other half of a fully featured player.

**Independent Test**: With at least two clips, play one, press next, confirm the name changes and the audio crossfades rather than cutting; press previous and return to the original clip the same way. From the last clip, next wraps to the first.

**Acceptance Scenarios**:

1. **Given** two or more clips and the player showing clip A, **When** the user activates next, **Then** the UI shows clip B's display name.
2. **Given** clip A is playing, **When** the user activates next to clip B, **Then** A fades out and B fades in over a short overlap (about one to two seconds) instead of an instant cut.
3. **Given** the last clip is selected, **When** the user activates next, **Then** the first clip is selected (wrap).
4. **Given** the first clip is selected, **When** the user activates previous, **Then** the last clip is selected (wrap).
5. **Given** the player is paused, **When** the user activates next or previous, **Then** the selected clip and displayed name change and no audio is emitted until play.
6. **Given** only one clip is available, **When** the user activates next or previous, **Then** the same clip remains selected (no error).

---

### User Story 3 - Simple transport in compact and wide slots (Priority: P2)

The widget stays usable in a small dashboard cell: clip name plus play/pause remain readable and activatable. In a wider or taller slot it can show previous/next more clearly. Controls stay simple — play, pause, previous, next — with no extra panels required for v1.

**Why this priority**: Dashboard widgets must survive resize; transport is the whole UI.

**Independent Test**: Place the widget in a short/narrow slot and a wide slot; confirm the current name is visible in both, play/pause works in both, and previous/next are available in the regular layout (they may collapse to a smaller treatment when space is tight, but must remain reachable in the regular size).

**Acceptance Scenarios**:

1. **Given** a compact widget slot, **When** it renders, **Then** the current clip name and a play/pause control are visible and usable.
2. **Given** a regular or wide slot, **When** it renders, **Then** previous, play/pause, and next are all visible.
3. **Given** the widget is resized, **When** it re-renders, **Then** content does not overflow the panel and transport remains reachable.

---

### User Story 4 - Optional activity visualization (Priority: P3)

When there is enough space and audio is playing, the widget may show a simple activity waveform (or similar one-line visualization) driven by the playing signal. When paused, too small, or visualization is skipped, the player still works.

**Why this priority**: Requested as nice-to-have in a TUI; must not block P1.

**Independent Test**: In a wide enough slot, play a clip and confirm a waveform or pulse strip moves; pause and confirm it stills or hides; in a compact slot the player works without it.

**Acceptance Scenarios**:

1. **Given** sufficient width/height and a clip playing, **When** the widget renders, **Then** it may show a one-line activity visualization that updates while audio is playing.
2. **Given** the player is paused or compact, **When** the widget renders, **Then** missing visualization is not an error; name and transport remain.

---

### Edge Cases

- Empty or missing `test-audio` catalog: widget shows an empty state explaining that no clips are bundled; play/next/previous are no-ops (no crash).
- Unreadable or corrupt clip file: that clip is skipped or marked unavailable; other clips still play; a short error is logged and optionally toasted once.
- Unsupported audio format for a file: treat as unreadable (v1 ships WAV PCM; see Assumptions).
- Rapid next/previous during a crossfade: a new cycle cancels the in-progress fade and starts a new fade to the newly selected clip (no stacked overlapping tracks beyond the two-mix).
- Plugin unload / Nightshift quit: playback stops and the audio device is released.
- Playback continues if the widget is removed from the dashboard while playing (ambient sound is process-wide); it stops on plugin teardown.
- Corrupt persisted "last clip" id: fall back to the first catalog clip.
- Multiple widget instances share one player (one set of commands, one entity).
- Very short clips shorter than the crossfade window: fade duration is clamped so both clips can still be heard; never hang.
- Click/pop at loop seam: a brief intra-clip seam fade is allowed; it is not the same as the track-change crossfade.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Plugin MUST ship as a bundled Nightshift app (`plugins/ambient-noise`, id `ambient-noise`) that registers a dashboard widget, entities, and commands through `@nightshift/sdk` only.
- **FR-002**: Plugin MUST load a small catalog of ambient clips from the plugin's `test-audio` folder (plus a name mapping), each with a stable id and a simple display name such as "Rainy Day" or "White Noise".
- **FR-003**: The player widget MUST show the current clip's display name (never only a basename like `rain.wav`).
- **FR-004**: Plugin MUST provide play and pause (or a single play/pause toggle plus distinct commands) that start and stop local audio output.
- **FR-005**: While a clip is playing, it MUST loop when it finishes so playback continues until pause or teardown.
- **FR-006**: Plugin MUST provide cycle-forward and cycle-backward commands/controls that wrap around the catalog.
- **FR-007**: When the current clip changes while audio is playing, the plugin MUST crossfade (outgoing fade-out overlapping incoming fade-in) rather than cutting.
- **FR-008**: Failures (missing files, no audio device, decode errors) MUST NOT crash plugin setup, the widget, or Nightshift startup; they MUST surface as empty/error/unavailable UI state.
- **FR-009**: Automated tests MUST cover catalog loading, loop wrap, next/previous wrap, crossfade mix math, play/pause state, corrupt/missing clip handling, and setup against a fake context with a mock audio sink (no real device required in CI).
- **FR-010**: Widget layout MUST remain usable in compact and regular dashboard slots (name + transport; visualization optional).
- **FR-011**: An activity visualization MAY be shown when space allows; it MUST NOT be required for play, pause, or cycling.
- **FR-012**: Last selected clip id SHOULD persist across restarts via plugin storage; playback MUST NOT auto-start on launch.

### Key Entities _(include if feature involves data)_

- **Clip catalog**: Bundled ambient clips — id, display name, file path, duration once decoded.
- **Player state**: Current clip, playing/paused/unavailable, optional playhead, optional visualization samples, output health.
- **Mixer internals**: In-memory playheads, gains, and crossfade progress (not persisted).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can add the widget, see a named clip, press play, and hear looping audio within a few seconds on a host with a working audio device.
- **SC-002**: Next/previous change the displayed name immediately and, when playing, complete a crossfade without an audible hard cut (overlap on the order of 1–2 seconds).
- **SC-003**: Pause stops audible output promptly (within one mixer buffer, well under 250 ms of the pause action being handled).
- **SC-004**: Automated tests cover FR-009 without opening a real audio device.
- **SC-005**: Missing clips or missing audio output never prevent Nightshift or other plugins from loading.

## Assumptions

- This is a Nightshift **plugin** (app), not a host package; it ships bundled with the CLI like `focus` / `clock` / `system-monitor`.
- Clip files live under `plugins/ambient-noise/test-audio/` (as provided for testing). A small catalog file maps files to display names. If that folder is empty in a checkout, implementation adds short fixture WAVs for tests and documents how to drop in real samples.
- v1 playback format is **WAV PCM** (typically 16-bit). If supplied samples are another format, they are converted to WAV as part of implementation rather than adding an MP3/OGG decoder.
- Local speakers only — no streaming, no Spotify, no network. No new SDK capability; audio is local output with a mockable sink so CI stays silent.
- Crossfade duration is a fixed default (~1.5 s), not user-configurable in v1.
- No volume slider, playlist editor, or user-import of extra files in v1 — catalog is bundled.
- Visualization uses existing SDK `ActivityWaveform` (or Sparkline) from mixer RMS; not a full spectrum analyzer.
- Transport UI follows the Spotify widget's simple glyph pattern (play / pause / prev / next) so controls stay one row.
- Auto-play on startup is out of scope (would surprise users). Last clip selection may persist.
- Commands are the mutation path so vibes and the palette can play/pause/skip without extra work.
- `shell` is not used; `network` is not required.
