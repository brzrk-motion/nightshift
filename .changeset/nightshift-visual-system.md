---
'@nightshift/cli': minor
'@nightshift/dashboard': minor
'@nightshift/sdk': minor
'@nightshift/ui': minor
---

Phase 7: the Nightshift visual system — a persistent shell, design tokens, and an expanded component library.

- **Application shell** — a persistent header (wordmark, active screen, the
  running vibe, the clock, a plugin count) and a left nav rail sit around the
  dashboard canvas and a status bar that now shows real key hints. The rail
  has six destinations — Dashboard, Vibes, Apps, Entities, Automations,
  Settings — each reachable by mouse, by a `1`–`9` digit key, and as a
  `Go to <name>` palette command, and collapses to icons on a narrow
  terminal. `AppShell`'s new `screens` prop is how they're supplied; it
  defaults to the five built-in ones, so existing callers get the new shell
  for free.
- **Design tokens** — `ThemeColors` gained `accentSecondary` (a violet, to
  make the "dark blue and purple" concept literal) and `borderMuted`; a new
  `tokens.ts` adds a spacing scale and named border styles. Every built-in
  theme was updated.
- **Component library** — `StatusDot`, `Divider`, `KeyHint`, `StatRow`,
  `Metric`, `IconButton`, `Toolbar`, `EmptyState`, `LoadingState`,
  `ErrorState`, `Icon`, `Meter`, `Timeline` and `ActivityWaveform` join the
  library, all re-exported from `@nightshift/sdk` so a plugin's widgets can
  be built from the same pieces the shell is. `Panel` gained a `density`
  prop (`compact`/`normal`/`spacious`).
- **CLI → UI entity bridge** — `apps/cli`'s runtime now publishes
  `nightshift.vibe`, `nightshift.plugins` and `nightshift.automations` as
  read-only entities, and tags every plugin command with `source`. This is
  what lets the Vibes/Apps/Automations screens show real data without
  `packages/ui` depending on the vibe engine, the plugin host, or the
  automation engine.

The shipped dashboard's own widget content is unchanged — replacing it with
the richer Phase 8 concept dashboard, and building a visual editor, are their
own phases.
