---
'@nightshift/vibes': patch
'@nightshift/automations': patch
---

Remove the `registerAll()` helpers from `VibeEngine` and `AutomationEngine`.

Call `register()` in a loop at the call site instead. Behavior is unchanged —
the wrappers only forwarded to `register()` with no extra logic.
