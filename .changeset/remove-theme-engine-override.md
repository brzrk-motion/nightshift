---
'@nightshift/ui': patch
---

Remove unused `ThemeEngine.override()` from `@nightshift/ui`.

Callers that need to tint a theme can use `extendTheme(current, patch)` instead. Runtime behavior is unchanged for existing theme activate/register flows.
