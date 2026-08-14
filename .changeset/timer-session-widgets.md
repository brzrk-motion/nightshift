---
'@nightshift/plugin-shared': patch
'@nightshift/plugin-pomodoro': patch
---

Extract shared `TimerSessionWidget` / `TimerTodayWidget` behind the
`@nightshift/plugin-shared/timer-session` subpath so pomodoro (and future timer
plugins) can reuse the session layout without pulling React into the pure
helper entry point.
