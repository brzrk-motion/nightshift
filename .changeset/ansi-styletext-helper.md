---
'@nightshift/core': patch
---

Add shared `ansi` / `shouldUseColor` helpers built on Node's `util.styleText()`, and migrate the services logger and CLI output modules off hand-rolled ANSI escape codes.
