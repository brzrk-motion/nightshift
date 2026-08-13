# Contract: UI component system public surface

**Feature**: `007-ui-component-system`  
**Audience**: Shell screens (`packages/ui/src/app/screens/`), plugin authors (`@nightshift/sdk`), future shell features  
**Transport**: In-process React components and hooks (no HTTP)

## Package exports

### `@nightshift/ui` (full library)

New exports added by this feature:

| Symbol | Module | Kind |
|--------|--------|------|
| `FormSection` | `components/FormSection.tsx` | Component |
| `FormField` | `components/FormField.tsx` | Component |
| `ActionBar` | `components/ActionBar.tsx` | Component |
| `ScreenLayout` | `components/ScreenLayout.tsx` | Component |
| `ConfirmModal` | `components/ConfirmModal.tsx` | Component |
| `FooterHint` | `components/FooterHint.tsx` | Component |
| `useListKeyboard` | `components/useListKeyboard.ts` | Hook |
| `formScale` | `formLayout.ts` | Pure function |
| `formContentSize` | `formLayout.ts` | Pure function |
| `useFormScale` | `formLayout.ts` | Hook |
| `useShellContentSize` | `app/useShellContentSize.ts` | Hook (promoted from internal) |
| `FormScale` | `formLayout.ts` | Type |
| `FormLayout` | `formLayout.ts` | Type |

Existing exports unchanged. `vibeEditorLayout.ts` MAY re-export from `formLayout` as deprecated shim:

```ts
/** @deprecated Use formScale / useFormScale from formLayout */
export { formScale as vibeEditorScale, formContentSize as vibeEditorContentSize } from '../formLayout.js';
export type { FormScale as VibeEditorScale, FormLayout as VibeEditorLayout } from '../formLayout.js';
```

### `@nightshift/sdk` (plugin surface)

New re-exports:

| Symbol | Source |
|--------|--------|
| `SelectField` | `@nightshift/ui` |
| `SelectOption` | `@nightshift/ui` |
| `resolveBreakpoint` | `@nightshift/ui/layout` |
| `useShellContentSize` | `@nightshift/ui` |
| `TerminalSize` | `@nightshift/ui/layout` |
| `Breakpoint` | `@nightshift/ui/layout` |

Form primitives (`FormSection`, `ScreenLayout`, etc.) remain **shell-internal** unless a plugin needs full settings panels in a later feature.

## Component behavior contracts

### FormField

- MUST render label in accent/muted based on `focused`
- MUST call `onFocus` on label/control mouse down
- MUST stack label above control when `scale.stackFields === true`
- MUST NOT acquire keyboard capture (control handles capture)

### ActionBar

- MUST span `width: '100%'`
- MUST use `theme.colors.surface` background
- MUST set `flexShrink: 0`
- `footer` variant: buttons SHOULD use `compact={false}` for Save/Cancel parity

### ScreenLayout

- MUST use column flex with `flexGrow: 1`, `height: '100%'`
- When `scroll === true` (default), body MUST be inside `scrollbox` with `flexGrow: 1`
- `actions` slot MUST render outside scrollbox (sticky footer)

### ConfirmModal

- MUST wrap `Modal` with standard hint `y confirm · esc cancel` (or project convention)
- MUST call `onCancel` on escape via Modal keyboard handling
- MUST NOT perform side effects until confirm pressed

### useListKeyboard

- MUST check `runtime.keyboardCapture.isCaptured()` before handling keys
- MUST NOT handle keys when `enabled === false`
- Selection MUST stay in `[0, count)` when count > 0

### useFormScale / formScale

- MUST produce identical flags to pre-refactor `vibeEditorScale` for same content dimensions
- Thresholds (fixed for this contract):
  - `stackFields`: contentWidth < 52
  - `stackActionRows`: contentWidth < 58
  - `compactActionControls`: contentWidth < 64
  - `shortFooter`: contentWidth < 68
  - `tightGaps`: contentHeight < 20

## Migration contract (editors)

Editors MUST adopt this structure after migration:

```text
ScreenLayout
  title?: "New vibe" | "Edit {name}"
  scroll: true
  actions: ActionBar(footer) → Save, Cancel
  hint?: FooterHint (when applicable)
  children:
    FormSection × N
      FormField × M
```

Keyboard: global `esc` handlers MUST guard `keyboardCapture.isCaptured()`.

## Migration contract (catalog lists)

List screens MUST adopt:

```text
column
  ActionBar(toolbar) → primary actions
  Table (width from useShellContentSize(2))
  FooterHint → key hints
```

Selection state driven by `useListKeyboard` or thin wrapper preserving current key bindings.

## Breaking change policy

- No removal of existing SDK exports
- `vibeEditorLayout` shim retained ≥1 release
- Visual behavior of editors/lists MUST be unchanged at reference terminal sizes (80×24, 60×20, 132×40)

## Dependency rules

| From | Must NOT import |
|------|-----------------|
| `components/*` | `app/screens/*` |
| `components/ColorField` | `themeDraft.ts` (use `theme/validate.ts`) |
| Plugins | `@nightshift/ui` directly (SDK only) |

## Test contract

| Module | Required tests |
|--------|----------------|
| `formLayout.ts` | Threshold boundaries; parity with old vibeEditorLayout tests |
| `useListKeyboard.ts` | Capture guard; selection clamp; key mapping |
| `FormField.tsx` | Stack vs inline at scale flags (renderer test or snapshot) |
| Migrated screens | Existing screen tests pass without modification |
