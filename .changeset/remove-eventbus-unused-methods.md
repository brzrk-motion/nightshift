---
'@nightshift/core': patch
---

Remove unused `EventBus` methods `off()`, `once()`, and `listenerCount()` from the
`@nightshift/core` package entrypoint.

Unsubscribe with the function returned by `on()`, and use `clear()` to drop
listeners. Runtime behavior of the remaining methods is unchanged.
