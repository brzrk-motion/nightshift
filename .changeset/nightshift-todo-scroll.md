---
'@nightshift/plugin-todo': patch
---

The todo list scrolls instead of overflowing the widget, and now actually
fills the widget's full height.

A plain `<box>` grows to fit its content, so a long list pushed everything
past the widget's own height off the bottom of the dashboard rather than
being clipped. The list now renders inside a `<scrollbox>` — OpenTUI's real
scrolling container — so it scrolls with the mouse wheel like any other
overflowing list.

The first pass at this also set `flexDirection: 'column'` on the `<scrollbox>`
itself, which fights its internal layout — a scrollbox's own top-level box is
`row` (content pane beside its vertical scrollbar strip) — and starved the
content pane of most of the widget's height instead of stacking rows inside
it (which happens regardless, since the content pane it's built from already
forces `column`). Dropping that fixed it: the list now fills the full height
available, not just the first handful of rows.
