---
'@nightshift/cli': minor
'@nightshift/plugin-ambient-noise': minor
'@nightshift/plugin-spotify': patch
'@nightshift/services': patch
---

Add bundled Ambient Noise plugin: looping named clips, play/pause, and crossfade skip. Starting Ambient Noise pauses Spotify, and starting Spotify pauses Ambient Noise. Ships Rainy Day, Soft Static, and Ambient Noise MP3 beds (see `test-audio/ATTRIBUTION.md`). Mixer pause keeps the incoming clip, write errors fall back to silent, and mid-chunk fade completion uses the new buffer. Playback commands ignore stale loads after pause/skip, decoded beds cap at 60s, and unused PCM is dropped.
