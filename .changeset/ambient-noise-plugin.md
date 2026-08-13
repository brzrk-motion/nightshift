---
'@nightshift/cli': minor
'@nightshift/plugin-ambient-noise': minor
'@nightshift/plugin-spotify': patch
'@nightshift/services': patch
---

Add bundled Ambient Noise plugin: looping named clips, play/pause, and crossfade skip. Starting Ambient Noise pauses Spotify when output is a real device, and starting Spotify pauses Ambient Noise. Ships ~60s Rainy Day, Soft Static, and Ambient Noise MP3 loops (see `test-audio/ATTRIBUTION.md`). Mixer pause keeps the incoming clip, write errors fall back to silent, overlapping device writes are skipped until the in-flight write settles, and mid-chunk fade completion uses the new buffer. Playback commands ignore stale loads after pause/skip, catalog setup only stats clip files, decode reads a bounded window (long WAVs keep a 60s PCM prefix), failed play/toggle stay paused with a toast, a stored unavailable clip id falls through to the next playable bed, and unused PCM is dropped.
