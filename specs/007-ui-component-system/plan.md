# Implementation Plan: UI Component System Overhaul

**Branch**: `007-ui-component-system` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-ui-component-system/spec.md`

## Summary

Audit-driven refactor of `@nightshift/ui`: extract duplicated form layout patterns from shell editors and catalog lists into shared components (`FormSection`, `FormField`, `ActionBar`, `ScreenLayout`) and helpers (`formLayout.ts`, `useFormScale`, `useListKeyboard`, `ConfirmModal`). Generalize `vibeEditorLayout.ts`, fix keyboard capture inconsistencies, decouple ColorField from screen layer, and extend SDK exports for plugin settings UI. Migrate Vibe/Dashboard/Theme editors and list screens incrementally without behavior regression.

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ (Node 26.4+ or Bun for OpenTUI FFI)

**Primary Dependencies**: `@opentui/react` (`useKeyboard`, layout primitives), React 19, `@nightshift/core`, `@nightshift/entities`, existing `@nightshift/ui` component library

**Storage**: N/A — presentational refactor only; no new persistence

**Testing**: Vitest co-located — `formLayout.test.ts` (port vibeEditorLayout tests), component tests for FormField/ActionBar, existing shell tests must pass

**Target Platform**: Nightshift terminal shell (`packages/ui`) and plugin widgets via `@nightshift/sdk`

**Project Type**: Shared UI library refactor spanning `packages/ui`, `packages/sdk` re-exports

**Performance Goals**: Zero layout thrash; scale computation remains pure O(1) on terminal resize

**Constraints**: No new npm dependencies; no console outside CLI; components must not import `app/screens/`; preserve all existing SDK exports; keyboardCapture guard on global handlers; OpenTUI box model only (no web CSS)

**Scale/Scope**: ~35 existing components; 6 new primitives/hooks; 6 screen files migrated; 2 SDK export additions minimum

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the Speckit placeholder. Gates from `AGENTS.md`:

| Gate | Status | Notes |
|------|--------|-------|
| Dependency direction (`ui` ← `core`, `entities`) | PASS | New code stays in `packages/ui`; SDK re-exports only |
| Public SDK only for plugins | PASS | FR-012 adds exports; no plugin imports services |
| Never let one bad input break startup | PASS | Presentational only; no startup path changes |
| No console outside CLI | PASS | No logging added |
| Tests co-located | PASS | `*.test.ts` beside new modules |
| Minimal scope / YAGNI | PASS | Defer generic CatalogScreen to P3 |
| OpenTUI keyboard capture | PASS | FR-009 fixes gaps |

**Post-design re-check**: PASS — contracts define component props and hook APIs only; no reverse dependencies; ColorField fix removes screen import.

## Project Structure

### Documentation (this feature)

```text
specs/007-ui-component-system/
├── plan.md              # This file
├── research.md          # Phase 0 — audit decisions
├── data-model.md        # Phase 1 — component/hook types
├── quickstart.md        # Phase 1 — validation guide
├── contracts/           # Phase 1 — public APIs
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/ui/src/
├── layout.ts                    # existing — dashboard breakpoints (unchanged)
├── formLayout.ts                # NEW — formScale, formContentSize, useFormScale
├── formLayout.test.ts           # NEW — port vibeEditorLayout tests
├── theme/validate.ts            # NEW — isValidHex (moved from themeDraft)
├── app/
│   ├── useShellContentSize.ts   # existing — export from index
│   └── screens/
│       ├── vibeEditorLayout.ts  # DEPRECATE → re-export from formLayout
│       ├── VibeEditor.tsx       # migrate to form primitives
│       ├── DashboardEditor.tsx  # migrate
│       ├── ThemeEditor.tsx      # migrate
│       ├── VibesList.tsx        # useListKeyboard + ActionBar
│       ├── DashboardsList.tsx   # useListKeyboard + ActionBar
│       ├── ThemesList.tsx       # useListKeyboard + ActionBar
│       └── *Screen.tsx          # ConfirmModal for delete/override
├── components/
│   ├── FormSection.tsx          # NEW
│   ├── FormField.tsx            # NEW
│   ├── ActionBar.tsx            # NEW
│   ├── ScreenLayout.tsx         # NEW
│   ├── ConfirmModal.tsx         # NEW
│   ├── FooterHint.tsx           # NEW (optional, small)
│   ├── useListKeyboard.ts       # NEW hook
│   ├── ColorField.tsx           # fix import path
│   └── index.ts                 # export new components + hooks

packages/sdk/src/index.ts        # re-export SelectField, resolveBreakpoint, useShellContentSize
```

**Structure Decision**: Add `formLayout.ts` at UI package root alongside `layout.ts` (dashboard vs form concerns). Form components live in `components/` flat namespace matching existing exports. Deprecate `vibeEditorLayout.ts` via re-export shim for one release cycle to minimize diff noise.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two layout modules (`layout.ts` + `formLayout.ts`) | Dashboard breakpoints (72/132) vs form density (52/68) serve different consumers | Single breakpoint enum would force wrong tradeoffs in editors or dashboards |
| ScreenLayout 4-slot API | Editors need scroll + sticky footer pattern repeated 3× | Raw scrollbox in each editor preserves duplication |

## Implementation Phases (for tasks.md)

### Phase A — Foundation (P1)
1. Add `formLayout.ts` + tests (port from `vibeEditorLayout.test.ts`)
2. Add `FormSection`, `FormField`, `ActionBar`, `ScreenLayout`, `FooterHint`
3. Move `isValidHex` → `theme/validate.ts`
4. Export new modules from `components/index.ts` and `packages/ui/src/index.ts`

### Phase B — Editor migration (P1)
5. Migrate ThemeEditor → ScreenLayout + FormField + ActionBar
6. Migrate DashboardEditor (fix compact button)
7. Migrate VibeEditor (fix keyboard capture on esc)
8. Shim `vibeEditorLayout.ts` → re-export from `formLayout`

### Phase C — List screens (P2)
9. Add `useListKeyboard` + tests
10. Migrate ThemesList, DashboardsList, VibesList
11. Add `ConfirmModal`; refactor catalog screen modals

### Phase D — SDK & polish (P2–P3)
12. SDK re-exports: SelectField, resolveBreakpoint, useShellContentSize
13. Fix CommandPickerListKeys capture; Tabs responsive underline
14. Optional: CatalogScreen scaffold (P3)

## Component Audit Reference

### Existing inventory (keep)

| Category | Components |
|----------|------------|
| Containers | Panel, Card, Modal |
| Controls | Button, TextInput, Toggle, SelectField, ColorField |
| Data display | Table, List, Tabs, StatusBadge, Metric, StatRow |
| Charts | BarChart, LineChart, Sparkline, charts.js helpers |
| Chrome | Toolbar, IconButton, Icon, KeyHint, Divider, Toasts |
| States | EmptyState, ErrorState, LoadingState |
| Visuals | ProgressBar, Meter, Timeline, ActivityWaveform |
| Layout (dashboard) | planLayout, distribute, resolveBreakpoint, shellContentSize |

### Gaps to build (this feature)

| New | Replaces |
|-----|----------|
| FormSection | 3× inline Section |
| FormField | 3× inline Field |
| ActionBar | 6× inline toolbar/footer boxes |
| ScreenLayout | Editor column structure |
| formLayout / useFormScale | vibeEditorLayout + ad-hoc width math |
| useListKeyboard | 3× list key handlers |
| ConfirmModal | 6× duplicate modal bodies |
| theme/validate.isValidHex | screen-layer import in ColorField |
