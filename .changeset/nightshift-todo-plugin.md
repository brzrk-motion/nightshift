---
'@nightshift/plugin-todo': minor
'@nightshift/services': minor
'@nightshift/ui': minor
'@nightshift/cli': minor
---

A todo list plugin, bundled and loaded by default alongside `focus`.

- **No backend** — `todo.md` in the user's home directory is the whole
  database, in the same checkbox format (`- [ ]` / `- [x]`) you'd write by
  hand. The plugin owns the file outright: a save regenerates it from
  in-memory state rather than patching it, so hand-editing between runs is
  fine but any prose added alongside the checklist won't survive the next
  save.
- **Everything is a button** — add, check off, edit and hide-completed all go
  through the `todo.list` widget's buttons, not keyboard shortcuts. There is
  no delete; check an item off and filter it out of view instead.
- **`@nightshift/ui`'s `TextInput`** gained the `flexGrow` it was missing on
  its own wrapping box — needed for the field to actually claim its row's
  remaining width next to fixed-size siblings like a button, which nothing
  had exercised before this plugin.
