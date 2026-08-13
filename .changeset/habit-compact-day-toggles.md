---
'@nightshift/plugin-habit': patch
'@nightshift/dashboard': patch
---

Habit tracker compact cells show the habit name and all seven day marks, and
dashboard reload waits until the files are actually read.

Compact width used bordered `Button`s for each day, which are ~7 columns
wide and overflowed the widget (clipping the name to a single letter). Day
toggles in compact density are now one-row `[ ]`/`[x]` marks. `dashboard.reload`
returns the load promise so callers (and tests) can wait for disk I/O.
