---
'@nightshift/sdk': patch
'@nightshift/plugin-ambient-noise': patch
'@nightshift/plugin-clock': patch
'@nightshift/plugin-habit': patch
'@nightshift/plugin-home-assistant': patch
'@nightshift/plugin-spotify': patch
'@nightshift/plugin-weather': patch
---

Add `argString` to the SDK for trimmed command/vibe string arguments. Six command-heavy plugins drop their local `stringArg` helpers in favor of the shared helper.
