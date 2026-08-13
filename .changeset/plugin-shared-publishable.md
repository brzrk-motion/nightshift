---
'@nightshift/plugin-shared': patch
'@nightshift/plugin-pomodoro': patch
'@nightshift/plugin-habit': patch
---

Publish `@nightshift/plugin-shared` (countdown helpers) with the fixed release
group so pomodoro/habit can resolve it outside the monorepo, and document the
allowed `plugin-shared` dependency for bundled plugins.
