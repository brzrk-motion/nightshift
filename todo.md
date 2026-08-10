Nightshift UI Transformation Roadmap — 3 Phases
Goal: Transform the completed functional MVP from a basic utilitarian TUI into the polished, dense, customizable dashboard experience from the original Nightshift concept.
Starting point: Core runtime, plugin system, entities, dashboards, vibes, commands, and one working plugin are complete.
Target: A visually rich OpenTUI dashboard with multi-column widgets, persistent navigation, charts, controls, music/focus panels, strong theming, and a dashboard editor.
Phase 7 — Build the Nightshift Visual System
7.1 Replace the current page layout
[ ] Remove the current vertically stacked “Clock / Getting Started / Entities / Commands” default dashboard (deferred to Phase 8, which redesigns the shipped dashboard's content)
[x] Build a full-screen application shell
[x] Add a persistent top header
[x] Add a persistent left navigation rail
[x] Add a persistent bottom status / shortcut bar
[x] Make the central dashboard canvas fill all remaining terminal space
[x] Add responsive behavior for narrow terminal widths
[x] Add graceful widget stacking when the terminal cannot fit the full grid
7.2 Header
[x] Add Nightshift wordmark / title
[x] Display current dashboard / vibe name
[x] Display current vibe state (example: ● locked in)
[x] Display date and local time
[x] Add compact connection / health indicators
[x] Ensure header remains visually quiet and does not steal space from widgets
7.3 Left navigation rail
[x] Add icon + keyboard navigation for:
[x] Dashboard
[x] Vibes
[x] Apps / Plugins
[x] Entities
[x] Automations
[x] Settings
[x] Add selected state styling
[x] Add hover / focus styling
[x] Support mouse clicks
[x] Support keyboard shortcuts
[ ] Add tooltips / labels when focused (labels are always visible when expanded; collapsed/icon-only mode has no hover tooltip yet)
7.4 Bottom status bar
[x] Show active mode / context
[x] Show dashboard name
[x] Show shortcut hints
[x] Show ctrl+p command palette shortcut
[x] Show ? help shortcut
[x] Show edit-mode shortcut (built in Phase 9 along with edit mode itself —
the status bar's key hints switch to the editing set while active)
[x] Show quit / back shortcut
[x] Make shortcut labels update based on current screen
7.5 Nightshift design tokens
[x] Create centralized theme tokens for:
[x] Background
[x] Panel background
[x] Border
[x] Muted border
[x] Primary accent
[x] Secondary accent
[x] Success
[x] Warning
[x] Error
[x] Primary text
[x] Muted text
[x] Add spacing scale
[x] Add border styles
[x] Add typography hierarchy
[x] Add widget title styling
[x] Add selected / focused styling
[x] Add dimmed / disabled styling
[x] Ensure the default theme matches the original dark blue / purple concept
7.6 Upgrade the UI component library
[x] Rebuild Panel / Card to match the concept
[x] Add panel titles integrated into borders
[x] Add compact and spacious panel variants
[x] Add reusable StatRow
[x] Add reusable Metric
[x] Add reusable StatusDot
[x] Add reusable IconButton
[x] Add reusable Toolbar
[x] Add reusable Divider
[x] Add reusable EmptyState
[x] Add reusable LoadingState
[x] Add reusable ErrorState
[x] Add reusable KeyHint
7.7 Terminal-native visual primitives
[x] Create reusable progress bar component
[x] Create compact horizontal meter
[x] Create sparkline component
[x] Create line chart component using Unicode / Braille blocks
[x] Create bar chart component
[x] Create timeline component
[x] Create mini waveform / activity component
[x] Add terminal-safe icon abstraction with text fallback
[ ] Verify visuals render correctly across common terminal emulators (tested via xterm-256color in a pty; real Terminal.app/iTerm2/Windows Terminal/Alacritty checks are manual QA beyond what this can automate)
Phase 7 Acceptance Criteria
[x] Nightshift launches into a full-screen shell resembling the original concept
[x] Header, nav rail, dashboard canvas, and footer are persistent
[x] Theme is recognizably Nightshift rather than default terminal UI
[x] Core visual primitives are reusable by plugins
[x] Layout remains usable when resizing the terminal
Phase 8 — Build the Concept Dashboard
(Skipped by explicit request — see Phase 9's notes for what that means for
items below that assumed it shipped: no Now Playing / Weather / Ambient
Sound / Goals / Activity widgets exist. Phase 9 was built on the four
widgets Nightshift already had — clock, note, entities, commands — plus
whatever a plugin contributes, not this concept dashboard's content.)
8.1 Dashboard grid system
[ ] Add a real multi-column dashboard grid
[ ] Support row / column spans
[ ] Support minimum widget width / height
[ ] Support fixed-height and flexible-height widgets
[ ] Support responsive breakpoints based on terminal columns
[ ] Support dashboard-level padding and gaps
[ ] Ensure widgets cannot overlap
[ ] Add fallback layout for small terminals
8.2 Replace developer/debug panels with real user-facing widgets
[ ] Move raw entity inspection out of the default dashboard
[ ] Move raw command listing out of the default dashboard
[ ] Keep both available in dedicated developer / diagnostic screens
8.3 Build the default Nightshift dashboard
Row 1
[ ] Now Playing widget
[ ] Track title
[ ] Artist
[ ] Album
[ ] Playback source
[ ] Progress bar
[ ] Elapsed / total time
[ ] Previous
[ ] Play / pause
[ ] Next
[ ] Like / favorite action
[ ] Optional terminal album-art placeholder / visualizer
[ ] Focus Session widget
[ ] Current mode
[ ] Large timer
[ ] Session target
[ ] Progress bar
[ ] Pomodoro / session count
[ ] Pause
[ ] Stop
[ ] Reset
[ ] System widget
[ ] CPU
[ ] RAM
[ ] Battery when available
[ ] Temperature when available
[ ] Compact meters
[ ] Historical sparkline
Row 2
[ ] Ambient Sound widget
[ ] Current sound
[ ] Playing / paused state
[ ] Volume control
[ ] Preset selection
[ ] Simple visual activity indicator
[ ] Weather widget
[ ] Current condition
[ ] Temperature
[ ] Feels-like temperature
[ ] Humidity
[ ] Wind
[ ] Sunrise / sunset
[ ] Compact condition icon
[ ] Today’s Goals widget
[ ] Task list
[ ] Completed state
[ ] Current / active task
[ ] Keyboard toggle
[ ] Mouse toggle
[ ] Empty-state handling
Row 3
[ ] Activity widget
[ ] Focus time over the last seven days
[ ] Bar chart
[ ] Current week total
[ ] Today highlight
[ ] Up Next widget
[ ] Timeline layout
[ ] Upcoming focus / break events
[ ] Time-until labels
[ ] Highlight next event
[ ] Quote / Atmosphere widget
[ ] Rotating quote or short message
[ ] Vibe-aware content source
[ ] Optional plugin-provided content
8.4 Make the first plugin feel native
[ ] Refactor the existing plugin widgets to use the new UI kit
[ ] Ensure plugin widgets declare minimum and preferred size
[ ] Ensure plugin widgets respond to focus / mouse events
[ ] Ensure plugin widgets can expose toolbar actions
[ ] Ensure plugin widgets render loading, empty, and error states
[ ] Ensure plugins cannot bypass theme tokens with hard-coded styling
8.5 Interaction polish
[ ] Add keyboard focus traversal between widgets
[ ] Add visible focus ring / border state
[ ] Add mouse selection
[ ] Add direct keyboard controls for focused widgets
[ ] Add global command palette commands to focus specific widgets
[ ] Add contextual widget actions
[ ] Add modal / popover support for secondary controls
[ ] Add toast notifications for actions
[ ] Add confirmation UI for destructive actions
8.6 Motion and live updates
[ ] Smooth timer updates
[ ] Smooth progress updates
[ ] Animated loading indicators
[ ] Subtle state-change animation where OpenTUI permits
[ ] Avoid excessive redraw / CPU usage
[ ] Verify dashboard remains responsive under frequent entity updates
Phase 8 Acceptance Criteria
[ ] Default dashboard visually matches the density and hierarchy of the original concept
[ ] At least one complete plugin occupies a polished dashboard widget
[ ] Charts, meters, progress bars, buttons, and interactive controls all work
[ ] Debug information is no longer the primary user experience
[ ] Keyboard and mouse interaction both feel intentional
Phase 9 — Make Dashboards Feel Programmable
9.1 Dashboard configuration schema
[x] Expand dashboard YAML schema to support:
[ ] Columns (the layout model is rows of widgets with a relative `span`, not a
column grid — deliberate, matches the architecture from Phase 2/3; not
revisited here)
[x] Rows
[x] Widget placement
[x] Row span (a row's `height`)
[x] Column span (a widget's `span`)
[x] Minimum size (`minWidth`, `minHeight` — `layout.ts`'s `distribute()` now
takes a per-child minimum, not just a uniform one)
[x] Widget-specific options (`options`, pre-existing)
[x] Conditional visibility (`when`, reusing `@nightshift/automations`'
`checkCondition` rather than reimplementing equals/above/below)
[x] Add schema validation
[x] Add readable validation errors
[x] Add version field for future migrations (`version`, validated against
`DASHBOARD_SCHEMA_VERSION`; a file from a newer Nightshift is refused
with an explicit hint rather than misread)
9.2 Default dashboard config
[ ] Recreate the shipped concept dashboard entirely from config (there is no
concept dashboard — Phase 8 was skipped; what ships is `DEFAULT_DASHBOARD`,
itself entirely config, just not that content)
[x] Ensure no layout is hard-coded into the application shell (was already
true before this phase — `Dashboard.tsx` has always solved layout from
`DashboardSpec`, never from JSX)
[x] Make every concept widget removable / replaceable (edit mode's
add/swap/remove work on whatever widgets a dashboard has)
[x] Ship at least:
[x] default (`home`)
[x] minimal
[x] nightshift
9.3 Dashboard edit mode
[x] Add e / command palette action to enter edit mode
[x] Show selected widget (active border; a hidden one shows as a dimmed,
still-selectable placeholder rather than disappearing)
[x] Move widget with arrow keys
[x] Resize widget with modified arrow keys (shift+arrows)
[x] Add widget
[x] Remove widget
[x] Swap widget (`w`, via the same picker "add" uses — keeps span, drops the
old widget's title/options/when since none of it is guaranteed to mean
anything to the new type)
[ ] Change widget settings (editing an existing widget's `options` in place
is not built — `options` is an arbitrary per-type bag with no schema a
generic editor could render a form from; swap it out and back in as the
workaround)
[x] Save layout
[x] Cancel changes
[x] Reset dashboard to defaults (reverts in-progress edits to the last saved
version, the standard "reset" an editor offers — not a wipe back to the
shipped built-in, which `rm`ing the file and reloading does instead)
[x] Support mouse selection where practical (click a widget to select it)
9.4 Widget picker
[x] List all installed plugin widgets
[ ] Group widgets by plugin (sorted by plugin then type, and each row shows
its source, but there is no visual group header between plugins)
[x] Search widgets
[x] Show widget description
[ ] Show minimum / preferred size (`WidgetDefinition` — the type-level
registration a plugin contributes — carries no size hint today; only a
dashboard's own `WidgetSpec` does, per placement, which the picker has no
placement for yet)
[ ] Preview widget where feasible (not built — would need a widget to render
against a synthetic runtime with no real data)
[x] Insert selected widget into current dashboard
9.5 Vibe-driven presentation
[x] Allow vibes to switch dashboards (pre-existing since Phase 2/3's
`vibe.dashboard`, not new to this phase)
[x] Allow vibes to switch themes (pre-existing, `vibe.theme`)
[x] Allow vibes to alter widget settings (pre-existing, via `vibe.entities` —
a vibe changes what a widget shows by changing the entity state it reads,
not the dashboard file's `options`)
[x] Allow vibe activation to update dashboard state immediately (pre-existing)
[x] Add default Locked In vibe that demonstrates:
[x] Dashboard switch (updated to open `nightshift` rather than `home`, so it
is an actual demonstration rather than a no-op switch to the same one)
[x] Focus timer start
[x] Theme / accent change
[x] Plugin action (`focus.start`)
9.6 Dashboard persistence
[x] Store user dashboards in Nightshift config directory (pre-existing)
[x] Auto-create default config on first run (pre-existing)
[x] Load changes without reinstalling / rebuilding (`saveDashboard` writes;
the running dashboard reflects a save immediately with no reload needed)
[x] Add dashboard reload command (`dashboard.reload`, re-reads the directory
and re-merges against the built-ins)
[ ] Watch config file for changes if practical (not built — reload is
command-triggered, not filesystem-watched)
[x] Preserve user dashboards during upgrades (inherent to living in the
config directory, untouched by a package upgrade — nothing to build)
9.7 Final UX cleanup
[x] First-run experience lands directly on the polished dashboard (the
welcome modal is an overlay on top of the real dashboard, not a separate
screen blocking it)
[x] Remove "Getting Started" panel from normal use (dropped from
`DEFAULT_DASHBOARD`'s permanent widget layout)
[x] Move onboarding into a one-time modal / help view (`OnboardingModal`,
gated by `config.onboarded`)
[ ] Add useful empty states when plugins are not configured (not built this
phase — `EmptyState` exists as a component from Phase 7 but nothing
surfaces "no plugins installed" with it yet)
[x] Ensure configuration failures do not break the dashboard (verified: a
malformed `config.json` reports `CONFIG_INVALID` and exits cleanly rather
than crashing; a malformed dashboard file is reported as a warning and
skipped, same as before this phase)
[x] Add nightshift doctor checks for terminal capabilities (`capabilities`
check: UTF-8 locale detection and colour depth, both warn-only)
[ ] Test at common terminal sizes (only what the OpenTUI test harness and
ad-hoc pty runs at 100×24–30 covered; no systematic size sweep)
[x] Test on Linux (this environment)
[ ] Test on macOS (not available in this environment)
[ ] Test on Windows terminals if supported by the MVP (not available in this
environment)
[ ] Profile CPU / memory under continuous dashboard updates (not done)
[ ] Capture final screenshots / demo GIFs (not done)
Phase 9 Acceptance Criteria
[ ] The shipped dashboard can be recreated entirely from user config (true of
`DEFAULT_DASHBOARD` as it exists; there is no concept dashboard to
recreate, per Phase 8 being skipped)
[x] Users can visually edit their dashboard from inside Nightshift
[x] Installed plugins automatically contribute available widgets (pre-existing)
[x] Vibes can change both behavior and presentation (pre-existing, and now
demonstrated by `locked-in` actually switching dashboards)
[ ] Nightshift looks and feels like the original programmable flow-workspace
concept (the _programmable_ half is real — dashboards are genuinely
config, editable, reloadable; the _flow-workspace_ visual richness is
Phase 8's content, which was skipped)
[x] The product is ready to demo without explaining away the UI (for what it
is: four built-in widgets, edit mode, and three example layouts — not
the richer concept dashboard)
Final Definition of Done
Nightshift should no longer feel like a terminal debugging interface.
Launching:
nightshift
should immediately present a polished, high-density control surface with:
music / media
focus state
ambient controls
weather
system status
goals
activity
upcoming events
atmosphere
The layout must be configurable, plugin-driven, keyboard-first, mouse-capable, and entirely achievable with OpenTUI.
Nightshift manages everything around the work — never the work itself.
