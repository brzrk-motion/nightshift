# Quickstart: UI Component System Overhaul

**Feature**: `007-ui-component-system`  
**Purpose**: Validate new form/responsive primitives and screen migrations without a full manual terminal session checklist.

See also: [data-model.md](./data-model.md), [contracts/ui-component-surface.md](./contracts/ui-component-surface.md)

## Prerequisites

- Node 22+, pnpm 11+
- Repo root: `/home/bloodmachine/Documents/Code/nightshift`

```bash
pnpm install
```

## Phase A — Foundation validation

After implementing `formLayout.ts` and form components:

```bash
# Unit tests for layout thresholds (must match old vibeEditorLayout behavior)
pnpm --filter @nightshift/ui test -- formLayout

# Full UI package
pnpm --filter @nightshift/ui test
pnpm --filter @nightshift/ui typecheck
pnpm --filter @nightshift/ui lint
```

**Expected**: All tests pass; `formLayout.test.ts` covers boundary widths 51/52, 57/58, 63/64, 67/68 and height 19/20.

### Manual scale check (optional)

```bash
pnpm start
```

1. Open **Vibes** → Add vibe
2. Resize terminal narrow (< 52 cols): labels stack above inputs
3. Resize wide (≥ 68 cols): labels inline; full footer hint visible

## Phase B — Editor migration validation

After ThemeEditor, DashboardEditor, VibeEditor migrations:

```bash
pnpm --filter @nightshift/ui test
pnpm start
```

| Screen     | Action        | Expected                                                                                          |
| ---------- | ------------- | ------------------------------------------------------------------------------------------------- |
| Themes     | Add theme     | Scroll color fields; Save/Cancel bar full width at bottom, surface background                     |
| Themes     | Edit theme    | Name locked; same footer bar                                                                      |
| Dashboards | Add dashboard | Save button same size as Vibe Save (not compact default)                                          |
| Vibes      | Add vibe      | Esc cancels only when no TextInput focused; typing in name field does not trigger shell shortcuts |

**Keyboard capture check**:

1. Focus vibe name TextInput, type characters — no nav/dashboard shortcuts fire
2. Press Esc — cancels editor (when capture released on blur)

## Phase C — List screen validation

After `useListKeyboard` + list migrations:

```bash
pnpm --filter @nightshift/ui test
pnpm start
```

| Screen   | Keys                             | Expected                                    |
| -------- | -------------------------------- | ------------------------------------------- |
| Themes   | j/k or ↓/↑                       | Row selection moves                         |
| Themes   | Enter                            | Edit selected (or documented action)        |
| Themes   | a                                | Add theme                                   |
| Vibes    | Same                             | Parity with pre-refactor                    |
| Any list | Type in filter/search if present | List keys inactive while TextInput captured |

## Phase D — SDK export validation

After SDK re-exports:

```bash
pnpm --filter @nightshift/sdk typecheck
pnpm --filter @nightshift/plugin-spotify typecheck   # if SelectField used in tests
pnpm test
```

Create or extend a minimal plugin dev test:

```ts
import {
  SelectField,
  resolveBreakpoint,
  useShellContentSize,
} from '@nightshift/sdk';
// compile-only smoke — no @nightshift/ui import
```

**Expected**: Typecheck passes; no direct `@nightshift/ui` import in `plugins/*/src`.

## ConfirmModal validation

After catalog screen modal refactor:

1. Themes → select user theme → Delete
2. Modal shows confirm/cancel; Esc dismisses
3. Confirm runs `theme.delete` command; list refreshes

Repeat for Vibes and Dashboards delete flows.

## Regression suite (full)

Before marking feature complete:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Success checklist

- [ ] No duplicate `Section`/`Field` in editor screen files
- [ ] Single `ActionBar` used for all Save/Cancel footers
- [ ] `ColorField` does not import from `app/screens/`
- [ ] `formLayout` tests ≥ same coverage as former `vibeEditorLayout` tests
- [ ] SDK exports `SelectField`, `resolveBreakpoint`, `useShellContentSize`
- [ ] All three catalog lists use `useListKeyboard`

## Troubleshooting

| Issue                       | Check                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Save button too narrow      | ActionBar footer buttons need `compact={false}`                                       |
| Esc cancels while typing    | Editor `useKeyboard` missing capture guard                                            |
| List keys fire during input | `useListKeyboard` capture check                                                       |
| Wrong stack/inline at width | `formContentSize` padding vs `useShellContentSize(2)` mismatch — align padding option |
