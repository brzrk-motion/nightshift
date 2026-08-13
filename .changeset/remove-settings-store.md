---
'@nightshift/services': patch
---

Remove the unused `createSettingsStore` API from the `@nightshift/services` package entrypoint.

Callers already use `loadConfig` / `saveConfig` (and in-memory `context.config` mutation in the CLI) directly. Runtime behavior is unchanged.
