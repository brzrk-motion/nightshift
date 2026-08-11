# Feature Specification: Habit Tracker

**Feature Branch**: `001-habit-tracker`

**Created**: 2026-08-11

**Status**: Draft

**Input**: User description: "Our next app for nightshift will be a simple habit tracker, we should be able to add habits, and click boxes or check boxes for each day of the week we performed this habit, it should be a rolling 7 day window that we display for this interface, and we should program some basic streaks, etc. It needs to be simple, but intuitive, and the interface should be fully responsive and scalable."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track habits across a rolling week (Priority: P1)

A user opens their dashboard, sees a habit tracker widget with each habit as a row and seven day columns (a rolling window ending today). They click a day cell to mark that habit done for that date, or click again to clear it. Completions persist across restarts.

**Why this priority**: Core value — without add + check + persist, there is no habit tracker.

**Independent Test**: Add one habit, toggle today and yesterday, restart Nightshift, confirm both marks remain and the seven-day headers still end on today.

**Acceptance Scenarios**:

1. **Given** no habits exist, **When** the user adds a habit with a non-empty name, **Then** the habit appears as a new row with seven unchecked day cells.
2. **Given** a habit exists, **When** the user activates an unchecked day cell, **Then** that cell shows completed and the completion is saved.
3. **Given** a day cell is completed, **When** the user activates it again, **Then** the completion is cleared and the streak updates accordingly.
4. **Given** completions from prior days, **When** the calendar day changes, **Then** the visible window shifts so the rightmost (or last) day is today and older days outside the window are no longer shown (history for streaks may still exist).

---

### User Story 2 - See basic streaks (Priority: P2)

While viewing the habit list, the user sees a current streak (and a best/longest streak) per habit so they can tell at a glance whether they are on a run.

**Why this priority**: Streaks are the motivational feedback called out in the request; secondary to being able to check days off.

**Independent Test**: Seed completions for three consecutive days ending today for one habit; confirm current streak is 3. Clear today; confirm current streak becomes 0 (or ends at yesterday per streak rules) and longest streak is retained if higher.

**Acceptance Scenarios**:

1. **Given** a habit completed on consecutive calendar days ending today, **When** the widget renders, **Then** the current streak equals the length of that run.
2. **Given** a longer historical consecutive run than the current one, **When** the widget renders, **Then** the longest streak shows that historical maximum.
3. **Given** today is not completed and yesterday was not completed, **When** the widget renders, **Then** the current streak is 0.

---

### User Story 3 - Manage habits simply (Priority: P3)

The user can rename or remove a habit without leaving the widget, keeping the surface small and intuitive.

**Why this priority**: Needed for a usable tracker over time; not required for the first demo of checkmarks.

**Independent Test**: Add two habits, rename one, delete the other; confirm only the renamed habit remains with its completions intact.

**Acceptance Scenarios**:

1. **Given** an existing habit, **When** the user renames it, **Then** the new name is shown and completions are unchanged.
2. **Given** an existing habit, **When** the user deletes it, **Then** the habit and its completion history are removed from the tracker.

---

### User Story 4 - Responsive, scalable widget layout (Priority: P2)

In narrow dashboard slots the tracker remains usable (habit name + day cells readable/activatable). In wider slots it uses the extra space (clearer day labels, streak columns) without overflowing or clipping into unusable noise.

**Why this priority**: Explicit product requirement; pairs with P1 for a shippable UI.

**Independent Test**: Place the widget in a compact dashboard column and a wide full-width row; confirm both layouts show all seven days and allow toggling without horizontal overflow of interactive controls.

**Acceptance Scenarios**:

1. **Given** a compact widget width, **When** the tracker renders, **Then** day headers use a short form (e.g. single letter or numeric day) and habit rows still fit seven toggles.
2. **Given** a wide widget width, **When** the tracker renders, **Then** day headers use a clearer label (e.g. weekday abbreviation + date) and streak values remain visible.
3. **Given** many habits, **When** the list exceeds the widget height, **Then** the list scrolls or truncates gracefully without breaking the day header alignment.

### Edge Cases

- Empty habit name on add/rename is rejected; existing list unchanged.
- Duplicate names are allowed (identity is by id, not name).
- Completions outside the visible 7-day window still count toward streak calculation.
- Future dates are never shown or toggleable in the rolling window.
- Midnight rollover: the window advances; a completion recorded for "yesterday" stays on that calendar date.
- Corrupted or partial persisted data loads as a safe empty/partial list without crashing Nightshift or other plugins.
- Zero habits shows an empty state with a clear affordance to add the first habit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add a habit with a display name.
- **FR-002**: Users MUST be able to toggle completion for each habit on each day in a rolling 7-day window ending on the local calendar "today".
- **FR-003**: The interface MUST display exactly seven day columns for that rolling window (not a fixed Mon–Sun calendar week unless today happens to land such that they coincide).
- **FR-004**: Completions and habit definitions MUST persist across Nightshift restarts.
- **FR-005**: The system MUST compute and display a current streak and a longest streak per habit.
- **FR-006**: Current streak MUST count consecutive completed local calendar days ending at today if today is complete, otherwise ending at yesterday if yesterday is complete; otherwise 0.
- **FR-007**: Longest streak MUST be the maximum consecutive completed-day run observed for that habit (at least as high as the current streak).
- **FR-008**: Users MUST be able to rename and delete habits.
- **FR-009**: The widget UI MUST adapt layout density to available width (compact vs roomy day labels / streak presentation) and remain usable down to Nightshift’s minimum dashboard size.
- **FR-010**: Habit tracker failures (bad storage, bad input) MUST NOT prevent the rest of Nightshift from starting or other widgets from rendering.
- **FR-011**: Habit mutations MUST be available as commands (so the palette / automations / tests can drive the same behavior as the widget).

### Key Entities

- **Habit**: A named tracked practice with a stable id, display name, creation time, and optional archived flag (v1 uses delete rather than archive).
- **Completion**: A record that a habit was performed on a specific local calendar date (`YYYY-MM-DD`).
- **Rolling window**: The set of seven local dates `[today-6 … today]` used for display and toggling.
- **Streak summary**: Derived view of current and longest consecutive completion runs for a habit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can add a habit and mark today complete in under 30 seconds without reading docs.
- **SC-002**: After restart, 100% of previously saved habits and completions in the last 7 days reappear correctly.
- **SC-003**: Streak values match the consecutive-day rules in FR-006/FR-007 for scripted fixture cases (unit-testable).
- **SC-004**: The tracker remains operable (add + toggle visible) at Nightshift minimum terminal size (40×12) when the widget is given a reasonable share of the dashboard.
- **SC-005**: A broken or empty habit store does not crash startup; the widget shows empty/safe state instead.

## Assumptions

- Delivered as a **bundled Nightshift plugin** (`@nightshift/plugin-habit` or similar), not a new host package — Nightshift “apps” in the shell sense list plugins; feature work ships as a plugin + dashboard widget.
- Local calendar dates use the machine’s local timezone (same convention as the focus plugin’s `todayKey()`).
- One completion per habit per day (binary checkbox), not counts or multiple check-ins.
- History retained beyond seven days as needed for longest-streak accuracy; UI only shows seven days.
- No reminders, notifications, or social sharing in v1 (streaks only).
- No cloud sync; persistence is local via the plugin storage capability (or equivalent local store).
- Bundled and listed in default CLI config like other first-party plugins.
- Habit names are free text; no categories/tags in v1.
