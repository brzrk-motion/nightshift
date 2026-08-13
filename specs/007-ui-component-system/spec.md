# Feature Specification: UI Component System Overhaul

**Feature Branch**: `007-ui-component-system`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Overhaul UI component system: audit existing components, identify gaps, build responsive UI helpers"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consistent form screens (Priority: P1)

As a Nightshift maintainer building or editing shell screens (Vibes, Dashboards, Themes, Settings), I want shared form layout primitives (`FormSection`, `FormField`, `ActionBar`, `ScreenLayout`) so I don't copy-paste the same box styling and responsive branching into every editor.

**Why this priority**: Three editors and three catalog lists already duplicate the same patterns; every new screen repeats the cost and introduces inconsistencies (e.g. DashboardEditor Save button `compact` default differs from VibeEditor).

**Independent Test**: Refactor one editor (ThemeEditor) onto the new primitives; verify Save/Cancel bar, section headings, and stacked vs inline labels match VibeEditor behavior at compact and regular terminal widths.

**Acceptance Scenarios**:

1. **Given** a terminal width below 52 columns, **When** viewing any editor using `FormField`, **Then** labels stack above controls instead of beside them.
2. **Given** an editor with unsaved changes, **When** the user scrolls through many fields, **Then** the Save/Cancel `ActionBar` remains pinned at the bottom with full-width surface background.
3. **Given** ThemeEditor identity rows, **When** refactored to `FormField`, **Then** label alignment matches VibeEditor/DashboardEditor.

---

### User Story 2 - Responsive scale hook (Priority: P1)

As a plugin or shell author, I want a single `useFormScale()` / `formScale()` helper derived from terminal size so responsive decisions use named flags (`stackFields`, `tightGaps`, etc.) instead of ad-hoc width arithmetic scattered across screens.

**Why this priority**: `vibeEditorLayout.ts` already solves this for one screen family but is screen-local; EntitiesScreen uses `(width ?? 60) - 20`, lists use `useShellContentSize(2)` with different padding, and plugins have no equivalent.

**Independent Test**: Replace direct `vibeEditorScale` calls in VibeEditor with generalized `useFormScale()`; run existing `vibeEditorLayout.test.ts` equivalents against the new module.

**Acceptance Scenarios**:

1. **Given** terminal size from `useRuntime().size`, **When** `useFormScale()` is called, **Then** it returns the same flags as today's `vibeEditorScale` for equivalent content width/height.
2. **Given** a plugin widget calling `resolveBreakpoint(width)`, **When** width crosses `COMPACT_WIDTH`, **Then** it receives `'compact'` without importing shell internals.

---

### User Story 3 - Catalog list keyboard helper (Priority: P2)

As a maintainer of list screens (Vibes, Dashboards, Themes), I want a shared `useListKeyboard` hook so up/down/enter/edit/add navigation and `keyboardCapture` guarding are implemented once.

**Why this priority**: Three list screens and two picker list-key handlers duplicate nearly identical keyboard logic; bugs (missing capture checks) have already appeared in VibeEditor vs other editors.

**Independent Test**: Refactor ThemesList onto `useListKeyboard`; keyboard navigation and capture behavior unchanged from before.

**Acceptance Scenarios**:

1. **Given** a focused TextInput elsewhere in the app, **When** list keyboard handler runs, **Then** it bails when `keyboardCapture.isCaptured()` is true.
2. **Given** a list with N items, **When** user presses `j`/`↓`, **Then** selection wraps or clamps consistently via the shared hook API.

---

### User Story 4 - SDK exports for form controls (Priority: P2)

As a plugin author building settings UI, I want `SelectField` (and optionally layout hooks) on `@nightshift/sdk` so I can build picker-driven forms without reimplementing list-select behavior.

**Why this priority**: Shell already has SelectField; plugins with settings (Spotify, Home Assistant) would benefit; keeps plugin dependency direction correct (SDK only).

**Independent Test**: Import `SelectField` from `@nightshift/sdk` in a plugin devDependency test; compile succeeds.

**Acceptance Scenarios**:

1. **Given** a plugin importing `SelectField` from SDK, **When** built, **Then** no `@nightshift/ui` direct import is required.
2. **Given** SDK export list, **When** documented, **Then** `useShellContentSize` and `resolveBreakpoint` are available for responsive widgets.

---

### User Story 5 - Catalog screen consolidation (Priority: P3)

As a maintainer, I want shared `ConfirmModal` and optional `CatalogScreen` scaffolding so delete/override dialogs and list↔editor view machines aren't copy-pasted across Vibes/Dashboards/Themes.

**Why this priority**: High duplication but lower risk if deferred; form primitives deliver more immediate consistency wins.

**Independent Test**: Replace duplicate delete modals in ThemesScreen with `ConfirmModal`; behavior unchanged.

**Acceptance Scenarios**:

1. **Given** a pending delete, **When** ConfirmModal opens, **Then** y/esc hints and button layout match existing modals.
2. **Given** three catalog screens after refactor, **When** counting Modal JSX blocks for delete/override, **Then** each uses the shared component.

---

### Edge Cases

- Terminal at minimum renderable size (40×12): form fields stack; action bar remains one row if possible.
- Nav rail collapsed vs expanded: `useFormScale` must account for nav width via `shellContentSize`.
- TextInput focused in editor: global `esc` handlers must respect `keyboardCapture`.
- ColorField hex validation: must not import from screen-layer `themeDraft.ts`.
- Tabs underline at narrow width: should not hardcode 120 columns (follow-up fix).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide `FormSection` and `FormField` components in `packages/ui/src/components/` with responsive stack/inline label layout driven by form scale flags.
- **FR-002**: System MUST provide `ActionBar` component supporting top-toolbar and bottom-save variants with consistent surface background and full width.
- **FR-003**: System MUST provide `ScreenLayout` composing optional title, scroll body, action bar, and footer hint.
- **FR-004**: System MUST generalize `vibeEditorLayout.ts` into `formLayout.ts` with `formScale()`, `formContentSize()`, and `useFormScale()` hook.
- **FR-005**: System MUST provide `useListKeyboard` hook encapsulating list navigation keys and capture guard.
- **FR-006**: System MUST provide `ConfirmModal` for destructive/override confirmation flows.
- **FR-007**: System MUST refactor VibeEditor, DashboardEditor, and ThemeEditor to use new form primitives without behavior regression.
- **FR-008**: System MUST refactor VibesList, DashboardsList, and ThemesList to use `useListKeyboard` and `ActionBar` where applicable.
- **FR-009**: System MUST fix keyboard capture inconsistencies (VibeEditor esc handler, CommandPickerListKeys, DashboardEditor compact button default).
- **FR-010**: System MUST move `isValidHex` out of `themeDraft.ts` into theme or components layer so ColorField has no screen dependency.
- **FR-011**: System MUST export `SelectField`, `useShellContentSize`, `resolveBreakpoint`, and form scale helpers from `@nightshift/ui` index; add SDK re-exports per FR-012.
- **FR-012**: System MUST re-export `SelectField`, `resolveBreakpoint`, and `useShellContentSize` from `@nightshift/sdk` for plugin authors.
- **FR-013**: System MUST include co-located Vitest tests for new layout helpers and components.
- **FR-014**: System MUST NOT break existing plugin widget APIs or remove current SDK exports.

### Key Entities

- **FormScale**: Named responsive flags (`stackFields`, `stackActionRows`, `compactActionControls`, `shortFooter`, `tightGaps`, `layout`) derived from content size.
- **FormField**: Label + control slot with focus ring and stack/inline layout.
- **ActionBar**: Horizontal button row with surface chrome; variants `toolbar` | `footer`.
- **ScreenLayout**: Column shell slots: `title`, `children` (scroll), `actions`, `hint`.
- **ListKeyboardOptions**: Keys, item count, selection index, callbacks, capture guard.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero duplicate `Section`/`Field` function definitions across editor screen files after refactor.
- **SC-002**: All three editors share one `ActionBar` implementation for Save/Cancel.
- **SC-003**: Existing UI test suites pass (`pnpm --filter @nightshift/ui test`) with no behavior regressions in layout tests.
- **SC-004**: New form layout module has ≥90% line coverage on scale thresholds (ported from vibeEditorLayout tests).
- **SC-005**: Plugin can import `SelectField` and `resolveBreakpoint` from SDK only; typecheck passes.
- **SC-006**: Catalog list screens each reduce inline keyboard handler code by using shared hook (measurable LOC reduction ≥30% per list file).

## Assumptions

- OpenTUI flexbox + `scrollbox` remain the layout foundation; no CSS/Tailwind/shadcn introduction (terminal UI, not web).
- Refactor is incremental: primitives land first, screen migrations follow in tasks phase.
- `CatalogScreen` generic abstraction may be deferred to P3 if form primitives consume the first implementation slice.
- ColorField SDK export is optional v1; SelectField is required for plugin settings use cases.
- SPACING/BORDERS token adoption is a follow-up sweep, not blocking for P1.
