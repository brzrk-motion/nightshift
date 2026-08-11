# Research: Habit Tracker

**Feature**: `001-habit-tracker` | **Date**: 2026-08-11

All Technical Context unknowns resolved against Nightshift `AGENTS.md`, sibling plugins (`focus`, `todo`), and Spec assumptions.

## 1. Delivery shape: plugin vs host “app”

**Decision**: Implement as `@nightshift/plugin-habit` under `plugins/habit/`, bundled in CLI defaults.

**Rationale**: Nightshift’s shell “Apps” screen lists loaded plugins; product features that own UI + state ship as plugins consuming `@nightshift/sdk`. A new `packages/*` host module would violate “Everything is a plugin” and widen the dependency graph without need.

**Alternatives considered**:
- New shell screen in `packages/ui` — rejected (host change; not plugin-extensible).
- Dashboard-only YAML without a plugin — rejected (no state/commands).
- Third-party-only (not bundled) — rejected for a first-party “next app” experience; still discoverable via config, but defaults should include it.

## 2. Persistence: `context.storage` vs plain file

**Decision**: Persist habits + completions in `context.storage` (JSON), gated by the `storage` capability — same pattern as focus progress.

**Rationale**: Habit grids and streak history are structured data, not meant for hand-editing like `todo.md`. Storage is opaque, per-plugin, and already the SDK contract for this.

**Alternatives considered**:
- User-facing `habits.md` — rejected for v1 (parser complexity, weak fit for date matrices).
- EntityStore only — rejected (entities are not durable across process restarts).
- Hybrid (entity live + storage durable) — **chosen operationally**: entity holds live `HabitState`; storage is the source of truth loaded in `setup` and written on mutation (focus pattern).

## 3. Rolling 7-day window semantics

**Decision**: Window = local dates `[todayKey()-6 … todayKey()]` inclusive (7 days). Not a fixed ISO week (Mon–Sun).

**Rationale**: Matches the user’s “rolling 7 day window”; always ends on today so “this week” never shows future empty cells. Align date keys with focus’s `todayKey()` local-calendar convention.

**Alternatives considered**:
- Fixed Mon–Sun week — rejected (does not roll; mid-week UX odd).
- Last 7 *completed* days — rejected (breaks empty days / checkbox grid).

## 4. Streak rules

**Decision**:
- **Current streak**: Walk backward from today if today is complete; else from yesterday if yesterday is complete; else `0`. Count consecutive completed dates.
- **Longest streak**: Max consecutive run over retained completion history for that habit; never less than current.

**Rationale**: Common habit-tracker UX (miss today before logging → still show yesterday’s run as current; miss yesterday → reset). Pure functions enable deterministic Vitest fixtures (no clock flakes: inject “today”).

**Alternatives considered**:
- Require today complete for any current streak — harsher; rejected for morning-before-check UX.
- Only compute over the visible 7 days — rejected (FR keeps history for longest streak).

## 5. UI interaction & responsiveness

**Decision**: Todo-style `[ ]`/`[x]` `Button` cells per day; add/rename via focused `TextInput` (auto keyboard capture). Density: short day headers when widget/terminal width is tight; fuller weekday+date labels when wide. Vertical scroll/overflow handled by OpenTUI flex column inside the widget.

**Rationale**: Proven plugin UX; no new SDK primitives required. Dashboard already reflows by breakpoint (`COMPACT_WIDTH` 72 / `WIDE_WIDTH` 132); widget should also react to its own allocated width via layout props/`WidgetProps` if available, else terminal width heuristics.

**Alternatives considered**:
- Custom checkbox primitive in `@nightshift/ui` — YAGNI for v1; Button labels suffice.
- Separate full-screen shell app — rejected (see §1).

## 6. Command surface

**Decision**: Register commands: `habit.add`, `habit.toggle`, `habit.rename`, `habit.remove` (ids finalizable in tasks). Widget only calls `useCommands().run(...)`.

**Rationale**: Matches focus/todo; enables palette, tests, and future automations without duplicating logic.

**Alternatives considered**: Mutate entity only from widget — rejected (untestable from CLI/palette; diverges from platform norms).

## 7. Testing strategy

**Decision**: Vitest co-located tests — pure `window`/`streaks`/`habits` reducers first; storage parse fixtures; light widget tests if sibling plugins do so. No real sleeps; inject date strings.

**Rationale**: Repo standard (`vitest run --passWithNoTests`); streak math is the highest-risk correctness surface.

**Alternatives considered**: Only E2E terminal tests — too heavy/fragile for v1 streak rules.

## 8. Packaging & defaults

**Decision**: Add workspace package; depend from `apps/cli`; append `@nightshift/plugin-habit` to `DEFAULT_CONFIG.plugins`; migrate existing configs if the repo’s config versioning pattern requires it (follow pomodoro/weather migration style in `config.ts`).

**Rationale**: First-party plugins are listed in defaults and migrated forward so existing installs pick them up.

## Resolved clarifications

| Former unknown | Resolution |
|----------------|------------|
| App vs plugin | Plugin + widget |
| Storage medium | `context.storage` JSON |
| Week meaning | Rolling 7 local days ending today |
| Streak definition | Backward consecutive from today/yesterday; track longest |
| Multi check-in/day | Binary only |
| Reminders | Out of scope v1 |
