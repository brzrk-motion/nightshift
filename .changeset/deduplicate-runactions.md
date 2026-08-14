---
'@nightshift/automations': patch
'@nightshift/vibes': patch
---

Export `runActions` from `@nightshift/automations` and reuse it in the vibe engine, removing the duplicated helper and `CommandRunner` interface from `@nightshift/vibes`.
