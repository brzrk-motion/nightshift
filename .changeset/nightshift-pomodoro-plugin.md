---
'@nightshift/cli': patch
'@nightshift/plugin-pomodoro': patch
'@nightshift/services': patch
---

Add a bundled Pomodoro plugin with work, short-break and long-break phases (25/5/15 by default, long break every four pomodoros). Two widgets — `pomodoro.session` and `pomodoro.today` — plus start/pause/stop/reset/skip commands and toast automations when a phase completes. Existing v5 configs migrate to v6 and load the plugin automatically.
