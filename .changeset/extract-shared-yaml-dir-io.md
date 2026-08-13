---
'@nightshift/core': patch
---

Extract shared YAML directory load/save/delete helpers into `@nightshift/core`
(`loadYamlDir`, `saveYamlResource`, `deleteYamlResource`). Dashboard, vibe, and
theme parsers now use them; resource names that contain path separators are
rejected.
