---
'@nightshift/automations': minor
'@nightshift/dashboard': minor
'@nightshift/services': minor
'@nightshift/ui': minor
'@nightshift/vibes': minor
'@nightshift/cli': minor
---

Phase 9: dashboards as config you can edit, not just author.

Phase 8 (a richer shipped "concept" dashboard — Now Playing, Weather, Ambient
Sound, Goals, Activity) was skipped by explicit request; everything below is
built on the four widgets Nightshift already had.

- **Schema** — a widget gained `minWidth`/`minHeight` (below which it falls
  to its own row, or its row grows to fit it — `layout.ts`'s `distribute()`
  now takes a per-child minimum) and `when`, a condition checked against the
  entity store that hides a widget without reflowing its neighbours. A
  dashboard gained `version`, validated against the current schema so a file
  from a newer Nightshift is refused with an explicit hint rather than
  misread. `checkCondition` moved from a private helper in
  `@nightshift/automations`' engine to an export, so `when` reuses the same
  equals/above/below logic an automation's `and` does instead of
  reimplementing it.
- **Edit mode** — `e` inside a dashboard (or `dashboard.edit.toggle` from the
  palette) enters an in-place editor: select a widget by tab, arrow keys or a
  click; move or resize it; add one from a searchable picker (`a`); swap the
  selected one for a different type (`w`); remove it (`d`); save (`ctrl+s`),
  cancel (`esc`) or reset to the last saved version (`r`). All of it is pure
  functions (`edit.ts`) driving a draft `DashboardSpec`, the same
  pure-function-first shape as `layout.ts` and the focus timer's reducer.
  Saving writes fully-explicit YAML back through the same parser that reads
  it, so a hand-edited file and one saved from edit mode are interchangeable.
- **Three dashboards ship by default** — `home`, `minimal`, `nightshift` —
  all built from `core.note`/`core.entities`/`core.commands`.
  `dashboard.reload` re-reads the dashboards directory and re-merges it
  against the built-ins without restarting. The `locked-in` vibe now opens
  `nightshift` instead of `home`, so activating it demonstrates a vibe
  actually switching the dashboard, not just the theme.
- **Onboarding** — the "getting started" note is no longer a permanent widget
  on the default dashboard; a one-time welcome modal explains the palette,
  the shortcuts and where dashboards live, dismissed by any key and tracked
  by a new `onboarded` config flag.
- **`nightshift doctor`** gained a `capabilities` check — UTF-8 locale
  detection and colour depth, both warn-only — and its `dashboards` check now
  counts the real merged total instead of a hardcoded `+1`.

Not built this phase: editing an existing widget's `options` in place (swap
it out and back in as the workaround — `options` has no schema a generic form
could render), a widget picker preview or size hint, filesystem-watched
reload, and empty states for an unconfigured plugin screen.
