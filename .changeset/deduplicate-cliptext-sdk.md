---
'@nightshift/ui': patch
'@nightshift/sdk': patch
'@nightshift/plugin-ambient-noise': patch
'@nightshift/plugin-habit': patch
'@nightshift/plugin-spotify': patch
---

Expose UI `truncate` as SDK `clipText` for terminal label clipping. Habit, Spotify, and ambient-noise drop their local truncate/clip helpers in favor of the shared function.
