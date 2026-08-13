# Research: User-Friendly Vibe Editor

**Feature**: `003-vibe-editor` | **Date**: 2026-08-11

## Decision: Improve the existing Vibes screen; do not move editing into a plugin

**Rationale**: Vibes are core workspace orchestration (like dashboards). The shell already owns the Vibes nav destination and the CLI already bridges `nightshift.vibes` + `vibe.save`. A plugin would duplicate the host write path and tempt SDK reach into vibes dirs.

**Alternatives considered**:

- `@nightshift/plugin-vibes` — fights “vibes are host concepts”; more capability surface.
- External web editor — out of product shape (terminal-first).

## Decision: Keep list ↔ in-screen form (no AppShell stack)

**Rationale**: Spec and current code already use local view state. AppShell push navigation would be a cross-cutting shell change for one screen. Modal overlays fight long forms (actions lists).

**Alternatives considered**:

- Modal editor — poor fit for multi-section forms + pickers.
- New nav-rail “Vibe editor” screen — pollutes global nav; worse for create/edit ephemeral flow.

## Decision: Theme picker from `runtime.themes`; dashboard picker from a published catalog entity

**Rationale**: Themes already live on `AppRuntime` (`themes.list()` / Settings screen pattern). Dashboards are assembled in CLI runtime today and are not on a well-known entity; publish `nightshift.dashboards` (name + title) snapshot at startup (and on reload if added later) so the UI stays on entities/commands and stays consistent with `nightshift.plugins` / `nightshift.vibes`.

**Alternatives considered**:

- Free text only — status quo; fails friendliness goal.
- UI imports `@nightshift/dashboard` — breaks package direction / shell isolation.
- Pass dashboards via React context prop from CLI only — works but invents a second channel beside entities.

## Decision: Command picker from `runtime.commands.list()` / `search()`

**Rationale**: Command registry is already on `AppRuntime` and powers the palette. Filter out `hidden` commands by default; allow free-type override for advanced/hidden ids used in vibes.

**Alternatives considered**:

- Hard-coded common commands — incomplete as plugins grow.
- Only free-type with autocomplete ghosts — weaker than explicit search list in TUI.

## Decision: Action args remain JSON text with validation for this feature; per-command forms later

**Rationale**: Commands have heterogeneous args. Spec allows JSON + validation as the friendly-enough step when paired with command picker. A minutes spinner for `focus.start` alone is premature specialization.

**Alternatives considered**:

- Per-command arg schemas in SDK — large design; defer.
- No args UI — blocks real vibes like `focus.start` with minutes.

## Decision: Add `deleteVibe` + `vibe.delete`; duplicate is UI-only prefill

**Rationale**: Symmetric with `saveVibe`. Duplicate = copy catalog row into create draft with cleared name; save creates the file. Deleting a built-in with no user file is refused; deleting a user override removes the file and re-registers the built-in if one exists.

**Alternatives considered**:

- Delete only via filesystem outside app — unfriendly.
- Soft-delete / trash — YAGNI.

## Decision: Live summary is pure derivation from draft

**Rationale**: One function `summariseDraft(draft) → string[]` keeps the summary testable and dumb. No extra entity.

**Alternatives considered**:

- Preview by dry-running activate — side effects / needs engine; unsafe in editor.

## Decision: Sectioned editor layout (Identity → Look → On activate → On deactivate → Summary)

**Rationale**: Matches mental model of the YAML file and reduces wall-of-fields fatigue vs the current flat form.

**Alternatives considered**:

- Multi-step wizard with Next/Back — more state; harder to edit one field later.
- Tabs — OK alternative; sections in one scrollable column fit OpenTUI better initially.

## Decision: Baseline code to extend

**Rationale**: Already landed: `serializeVibe` / `saveVibe`, `vibe.save`, `nightshift.vibes`, `VibesScreen` / `VibeEditor` / `vibeDraft`. This feature is UX + delete + pickers + summary on that base, not a greenfield rewrite.

**Alternatives considered**:

- Rewrite editor from scratch — waste; keep draft helpers and save path.
