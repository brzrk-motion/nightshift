---
'@nightshift/ui': patch
---

Remove unused `mergeThemes()` from `@nightshift/ui`.

Runtime already overlays user themes via `createThemeEngine`; the helper was only
referenced by its unit test and the public package export.
