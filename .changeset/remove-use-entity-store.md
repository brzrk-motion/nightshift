---
'@nightshift/ui': patch
---

Remove the unused `useEntityStore` hook from the `@nightshift/ui` package entrypoint.

Callers that need the entity store can use `useRequiredRuntime().entities` instead. Runtime behavior is unchanged.
