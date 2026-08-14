---
'@nightshift/ui': patch
---

Remove unused `SPACING`, `BORDERS`, `SpacingToken`, and `BorderToken` exports.
No callers existed in the monorepo; inline `'rounded'` / `'single'` at call sites
when spacing or border tokens are needed again.
