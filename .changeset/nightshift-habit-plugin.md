---
'@nightshift/cli': patch
'@nightshift/dashboard': patch
'@nightshift/plugin-habit': patch
'@nightshift/services': patch
---

Add a bundled habit tracker plugin with a rolling 7-day grid, current/longest streaks, and add/toggle/rename/delete commands. Existing v6 configs migrate to v7 and load the plugin automatically; the default `home` dashboard includes `habit.tracker`.
