# Research: UI Component System Overhaul

**Feature**: `007-ui-component-system` | **Date**: 2026-08-12

## Audit Summary

Full inventory: ~35 exported components in `packages/ui/src/components/`, plus `layout.ts` (dashboard planning), `vibeEditorLayout.ts` (editor-only responsive flags), and `useShellContentSize` (internal hook). Shell form screens (VibeEditor, DashboardEditor, ThemeEditor) copy-paste `Section`/`Field`, bottom action bars, and responsive scale logic. Three catalog lists (Vibes, Dashboards, Themes) duplicate keyboard navigation and top toolbars.

---

## Decision 1: Generalize `vibeEditorLayout` rather than invent new breakpoints

**Decision**: Rename and relocate to `packages/ui/src/formLayout.ts` with API `formContentSize()`, `formScale()`, `useFormScale()`. Keep existing thresholds (52/58/64/68 cols, 20 rows height).

**Rationale**: Thresholds are battle-tested across VibeEditor; VibeEditorScale flags are already semantic (`stackFields` not raw numbers). Editors and future Settings panels share the same density needs.

**Alternatives considered**:

- Reuse dashboard `resolveBreakpoint` (`compact`/`normal`/`wide` at 72/132) — too coarse for form label stacking; forms need sub-72 behavior.
- Per-screen magic numbers — current problem; rejected.
- CSS-media-query-style tier system with many breakpoints — over-engineering for terminal cells.

---

## Decision 2: Form primitives as components, not render props only

**Decision**: `FormSection`, `FormField`, `ActionBar`, `ScreenLayout` as React components in `components/form/` (or flat `components/` if ≤4 files).

**Rationale**: Matches existing component style (`Panel`, `Modal`); editors already use render-prop `Field` pattern which maps cleanly to `FormField` with `children={(focused) => ...}`.

**Alternatives considered**:

- Hooks-only (`useFormFieldLayout`) — still leaves box styling duplicated.
- Higher-order screen generator — too abstract for 3–6 screens.

---

## Decision 3: `useListKeyboard` as hook, not a List wrapper component

**Decision**: Export `useListKeyboard(options)` returning `{ selectedIndex, setSelectedIndex, bind }` or accept callbacks; lists keep rendering `Table`/`List` themselves.

**Rationale**: VibesList uses `Table`; SelectField uses `List`; CommandPicker uses custom filtered list. Behavior shared, markup differs.

**Alternatives considered**:

- `SelectableList` component — would force Table/List unification prematurely.
- Inline duplication — rejected (3× copies today).

---

## Decision 4: SDK export scope for v1

**Decision**: Re-export from SDK: `SelectField`, `resolveBreakpoint`, `useShellContentSize`, `TerminalSize`, `Breakpoint`. Defer `ColorField` (theme-editor-specific styling) unless a plugin needs it in tasks phase.

**Rationale**: Plugin dependency rule: SDK is the only import. Spotify/Home Assistant settings benefit from SelectField. Layout hooks let widgets match shell responsive behavior.

**Alternatives considered**:

- Export entire `formLayout` module — may expose shell-specific padding assumptions; export hook only first.
- Export nothing — leaves plugins with ad-hoc width checks.

---

## Decision 5: Incremental screen migration order

**Decision**: (1) Land primitives + tests, (2) ThemeEditor (newest, smallest Field gap), (3) DashboardEditor, (4) VibeEditor (largest), (5) catalog lists, (6) ConfirmModal on catalog screens.

**Rationale**: ThemeEditor was recently added and lacks shared `Field`; good proving ground. VibeEditor last due to ActionList complexity.

**Alternatives considered**:

- Big-bang refactor all screens in one PR — high regression risk.
- Primitives only, no migration — doesn't deliver user-visible consistency.

---

## Decision 6: ColorField dependency fix

**Decision**: Move `isValidHex` to `packages/ui/src/theme/validate.ts` (or `components/colorUtils.ts`); import from ColorField and themeDraft.

**Rationale**: Components must not import from `app/screens/`. Validation is theme-domain logic.

**Alternatives considered**:

- Inline regex in ColorField — duplicates validation intent.
- Keep in themeDraft — preserves bad dependency direction.

---

## Decision 7: No web UI stack (shadcn/Tailwind)

**Decision**: Continue OpenTUI `<box>`, `<text>`, `scrollbox`, theme colors, and `SPACING` tokens. Do not introduce shadcn or Tailwind.

**Rationale**: Nightshift is terminal-first via OpenTUI; AGENTS.md and existing components establish the pattern. User rules mentioning shadcn apply to web apps, not this package.

---

## Decision 8: ConfirmModal vs generic Modal extension

**Decision**: Thin `ConfirmModal` wrapping existing `Modal` with title, body text, primary/secondary buttons, and standard hint line.

**Rationale**: Delete and override dialogs are identical across three screens; Modal already handles overlay sizing.

**Alternatives considered**:

- Extend Modal with `variant="confirm"` — couples concerns; separate component clearer.

---

## Open Questions Resolved

| Question                                   | Resolution                                               |
| ------------------------------------------ | -------------------------------------------------------- |
| Should `CatalogScreen` be generic in v1?   | Defer to P3; document interface in data-model for future |
| Export ColorField on SDK?                  | Optional; revisit when plugin needs color picking        |
| Replace magic padding with SPACING tokens? | Follow-up sweep after primitives land                    |
| Fix Tabs 120-col underline?                | Include as minor fix in tasks, not blocking              |
