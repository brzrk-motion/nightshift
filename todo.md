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
[ ] Show edit-mode shortcut (deferred to Phase 9, which builds edit mode itself)
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
[ ] Expand dashboard YAML schema to support:
[ ] Columns
[ ] Rows
[ ] Widget placement
[ ] Row span
[ ] Column span
[ ] Minimum size
[ ] Widget-specific options
[ ] Conditional visibility
[ ] Add schema validation
[ ] Add readable validation errors
[ ] Add version field for future migrations
9.2 Default dashboard config
[ ] Recreate the shipped concept dashboard entirely from config
[ ] Ensure no layout is hard-coded into the application shell
[ ] Make every concept widget removable / replaceable
[ ] Ship at least:
[ ] default
[ ] minimal
[ ] nightshift
9.3 Dashboard edit mode
[ ] Add e / command palette action to enter edit mode
[ ] Show selected widget
[ ] Move widget with arrow keys
[ ] Resize widget with modified arrow keys
[ ] Add widget
[ ] Remove widget
[ ] Swap widget
[ ] Change widget settings
[ ] Save layout
[ ] Cancel changes
[ ] Reset dashboard to defaults
[ ] Support mouse selection where practical
9.4 Widget picker
[ ] List all installed plugin widgets
[ ] Group widgets by plugin
[ ] Search widgets
[ ] Show widget description
[ ] Show minimum / preferred size
[ ] Preview widget where feasible
[ ] Insert selected widget into current dashboard
9.5 Vibe-driven presentation
[ ] Allow vibes to switch dashboards
[ ] Allow vibes to switch themes
[ ] Allow vibes to alter widget settings
[ ] Allow vibe activation to update dashboard state immediately
[ ] Add default Locked In vibe that demonstrates:
[ ] Dashboard switch
[ ] Focus timer start
[ ] Theme / accent change
[ ] Plugin action
9.6 Dashboard persistence
[ ] Store user dashboards in Nightshift config directory
[ ] Auto-create default config on first run
[ ] Load changes without reinstalling / rebuilding
[ ] Add dashboard reload command
[ ] Watch config file for changes if practical
[ ] Preserve user dashboards during upgrades
9.7 Final UX cleanup
[ ] First-run experience lands directly on the polished dashboard
[ ] Remove “Getting Started” panel from normal use
[ ] Move onboarding into a one-time modal / help view
[ ] Add useful empty states when plugins are not configured
[ ] Ensure configuration failures do not break the dashboard
[ ] Add nightshift doctor checks for terminal capabilities
[ ] Test at common terminal sizes
[ ] Test on Linux
[ ] Test on macOS
[ ] Test on Windows terminals if supported by the MVP
[ ] Profile CPU / memory under continuous dashboard updates
[ ] Capture final screenshots / demo GIFs
Phase 9 Acceptance Criteria
[ ] The shipped dashboard can be recreated entirely from user config
[ ] Users can visually edit their dashboard from inside Nightshift
[ ] Installed plugins automatically contribute available widgets
[ ] Vibes can change both behavior and presentation
[ ] Nightshift looks and feels like the original programmable flow-workspace concept
[ ] The product is ready to demo without explaining away the UI
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
