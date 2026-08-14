---
'@nightshift/sdk': patch
'@nightshift/plugin-ambient-noise': patch
'@nightshift/plugin-habit': patch
'@nightshift/plugin-spotify': patch
---

Add `clipText` to the SDK for terminal label clipping. Habit, Spotify, and ambient-noise drop their local truncate/clip helpers in favor of the shared function.
