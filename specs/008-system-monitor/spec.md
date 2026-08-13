# Feature Specification: System Monitor

**Feature Branch**: `008-system-monitor`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "System monitor plugin with CPU, GPU, network activity and RAM usage. Basic graphics for each metric. Settings page where we can turn graphs on or off."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See live system metrics at a glance (Priority: P1)

A user adds the system monitor widget to a dashboard and immediately sees current CPU and RAM usage with small trend graphics that update while Nightshift is open. Network activity shows as a throughput trend (not a static number only).

**Why this priority**: Core value — without live metrics and graphics, there is no monitor.

**Independent Test**: Add the widget on a Linux host; confirm CPU and RAM labels update within a few seconds and each enabled metric shows a sparkline or line chart with a recent history window.

**Acceptance Scenarios**:

1. **Given** the widget is on a dashboard with default settings, **When** the host is running, **Then** CPU and RAM show a current value and a trend graphic that refreshes periodically.
2. **Given** the widget has been open for at least one minute, **When** the user loads the CPU heavily, **Then** the CPU graphic and percentage reflect the increase within two refresh cycles.
3. **Given** network traffic occurs on the machine, **When** the widget is visible, **Then** network activity shows a non-zero throughput trend (or a clear idle state when traffic is negligible).
4. **Given** metrics cannot be read (unsupported platform), **When** the widget renders, **Then** affected sections show a recoverable unavailable state and Nightshift keeps running.

---

### User Story 2 - Toggle which graphs appear (Priority: P1)

A user opens the widget settings and turns individual graphs on or off (CPU, GPU, network, RAM). Disabled graphs are hidden from the main view; enabled graphs remain. Choices persist across restarts.

**Why this priority**: Explicit product requirement; lets users keep a minimal dashboard or focus on one metric.

**Independent Test**: Open settings, disable RAM and GPU, enable only CPU and network; confirm the main view shows exactly those two sections; restart Nightshift and confirm the same toggles apply.

**Acceptance Scenarios**:

1. **Given** the widget is showing metrics, **When** the user opens settings and toggles a graph off, **Then** that metric section disappears from the main view immediately.
2. **Given** a graph is toggled off, **When** the user toggles it on again, **Then** the section reappears and begins updating.
3. **Given** saved toggle preferences, **When** Nightshift restarts, **Then** the same graphs remain enabled or disabled without reconfiguration.
4. **Given** all graphs are toggled off, **When** the main view renders, **Then** an empty-state message explains that no graphs are enabled and points the user to settings.

---

### User Story 3 - GPU when the host exposes it (Priority: P2)

On hosts where GPU utilization can be read without external setup, the user sees a GPU section with the same graphic treatment as CPU/RAM. When GPU data is unavailable, the section is omitted or shows unavailable — not an error that breaks the widget.

**Why this priority**: GPU was requested but varies widely by driver; best-effort keeps v1 shippable on CPU/RAM/network alone.

**Independent Test**: On a machine with readable GPU stats (or a mocked collector in tests), enable GPU in settings and confirm a utilization graphic appears; on a host without GPU probes, confirm soft unavailable copy and no crash.

**Acceptance Scenarios**:

1. **Given** GPU metrics are available on the host, **When** GPU is enabled in settings, **Then** the widget shows GPU utilization with a trend graphic.
2. **Given** GPU metrics are not available, **When** GPU is enabled, **Then** the widget shows a brief unavailable message for GPU only.
3. **Given** GPU is disabled in settings, **When** the widget renders, **Then** no GPU section appears regardless of host capability.

---

### User Story 4 - Usable in compact and wide dashboard slots (Priority: P2)

In a narrow widget slot the monitor stays readable (metric label + value + one-line sparkline). In a taller slot it can show taller line charts for clearer trends.

**Why this priority**: Dashboard widgets must work across layouts; graphics should scale like other Nightshift widgets.

**Independent Test**: Place the widget in a short row and a tall panel; confirm no clipping of the settings Done control and that at least one enabled metric remains readable in the compact layout.

**Acceptance Scenarios**:

1. **Given** widget height below the compact threshold, **When** metrics render, **Then** each section uses a one-line sparkline and abbreviated labels where needed.
2. **Given** sufficient widget height, **When** metrics render, **Then** at least one enabled metric may use a multi-row line chart for clearer history.
3. **Given** the settings panel is open in a compact slot, **When** the user toggles graphs, **Then** all toggles remain reachable and the Done control stays visible.

---

### Edge Cases

- First poll before history exists: graphics show empty or placeholder until enough samples accumulate.
- `/proc` or sysfs read failure (permissions, container without mounts): metric shows unavailable; other metrics continue.
- Very fast polling should not block the UI thread; missed ticks coalesce to the latest sample.
- Network counters wrap or interface list changes: collector resets delta safely without negative spikes.
- Multi-core CPU reported as 0–100% aggregate utilization, not per-core rows in v1.
- GPU name/label optional; utilization percentage is sufficient for v1.
- Corrupt storage for settings loads defaults (all graphs on except GPU off by default if unavailable — or all on with GPU soft-fail).
- Container/chroot environments without `/proc/stat` behave like unsupported platform for affected metrics.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Plugin MUST expose a dashboard widget showing system resource metrics with basic trend graphics.
- **FR-002**: Plugin MUST sample and display CPU utilization as an aggregate percentage (0–100%).
- **FR-003**: Plugin MUST sample and display RAM utilization as used vs total memory (percentage and human-readable sizes).
- **FR-004**: Plugin MUST sample and display network activity as combined send+receive throughput (bytes per second or human-readable rate).
- **FR-005**: Plugin MUST attempt GPU utilization when enabled; MUST soft-fail when the host does not expose GPU stats.
- **FR-006**: Plugin MUST provide a settings view where the user toggles each graph (CPU, GPU, network, RAM) on or off independently.
- **FR-007**: Plugin MUST persist graph visibility preferences across restarts using plugin storage.
- **FR-008**: Plugin MUST keep a rolling history buffer per metric suitable for sparkline/line chart rendering (default window ~60 samples).
- **FR-009**: Plugin MUST refresh metrics on a fixed interval while the widget is mounted (default ~1–2 s); MUST stop polling when no widget consumers need updates (ref-count or mount/unmount commands like weather).
- **FR-010**: Failures reading any single metric MUST NOT crash plugin setup, the widget, or Nightshift startup.
- **FR-011**: Plugin MUST use only the public SDK for runtime imports and register entities, commands, and widgets per Nightshift plugin conventions.
- **FR-012**: Automated tests MUST cover metric parsing/normalization, settings hydration, history rolling, toggle filtering, and setup against a fake context with mocked collectors.

### Key Entities *(include if feature involves data)*

- **Monitor settings**: Per-graph enable flags for CPU, GPU, network, RAM (durable).
- **Monitor snapshot**: Latest sampled values and availability flags per metric (live entity).
- **Metric history**: Rolling numeric arrays per metric for charts (live entity or derived in widget from snapshot stream).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add the widget and see updating CPU and RAM graphics within 5 seconds on a supported Linux host.
- **SC-002**: Disabling a graph in settings removes it from the main view on the next render and persists after restart.
- **SC-003**: Under sustained load, CPU graphic reflects a visible increase within 4 seconds of load starting (two refresh cycles at default interval).
- **SC-004**: Automated tests cover parser edge cases, corrupt settings → safe defaults, and unavailable GPU/CPU paths without throwing (≥ scenarios in FR-012).
- **SC-005**: Metric read failures never prevent Nightshift or other plugins from loading.

## Assumptions

- **Primary platform v1**: Linux with standard `/proc` and optional `/sys` GPU probes (matches Nightshift’s terminal-first, developer-machine audience).
- macOS and Windows are out of scope for v1; widget may show platform-unavailable messaging rather than partial support.
- “Basic graphics” means SDK `Sparkline` / `LineChart` components (block/braille terminal charts), not a full graphing library.
- One combined widget (`system-monitor.overview`) with configurable sections — not four separate widget types in v1.
- Default interval ~1 s; history ~60 points (~1 minute at 1 s polling).
- GPU is best-effort via sysfs where available; no `shell` / `nvidia-smi` dependency in v1 (SDK shell surface not implemented).
- No historical persistence beyond the in-memory rolling window while Nightshift runs.
- Plugin ships bundled with the CLI like `clock` / `focus` (default plugins list); no extra permissions beyond auto-granted storage/entities/widgets/commands.
- Settings UI follows the clock widget pattern (toolbar Settings/Done, toggles in-panel).
