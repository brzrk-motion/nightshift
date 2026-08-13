# Data Model: UI Component System Overhaul

**Feature**: `007-ui-component-system` | **Date**: 2026-08-12

## Overview

This feature introduces no durable persisted entities. The data model describes **component props**, **hook options/returns**, and **layout value types** that form the public contract between shell screens, shared components, and (via SDK) plugin widgets.

## Layout Types

### TerminalSize (existing)

| Field    | Type   | Description      |
| -------- | ------ | ---------------- |
| `width`  | number | Terminal columns |
| `height` | number | Terminal rows    |

### Breakpoint (existing, dashboard)

| Value     | Condition        |
| --------- | ---------------- |
| `compact` | width < 72       |
| `normal`  | 72 ≤ width < 132 |
| `wide`    | width ≥ 132      |

### FormLayout (existing, renamed)

| Value     | Description                   |
| --------- | ----------------------------- |
| `compact` | Any compact-scale flag active |
| `regular` | All compact-scale flags false |

### FormScale

| Field                   | Type         | Description                                  |
| ----------------------- | ------------ | -------------------------------------------- |
| `layout`                | `FormLayout` | Summary label                                |
| `stackFields`           | boolean      | Label above control (width < 52)             |
| `stackActionRows`       | boolean      | Action controls on separate row (width < 58) |
| `compactActionControls` | boolean      | Glyph-only move/remove (width < 64)          |
| `shortFooter`           | boolean      | Abbreviated hint text (width < 68)           |
| `tightGaps`             | boolean      | Reduced section gaps (height < 20)           |

**Derivation**: Pure function `formScale(contentWidth, contentHeight)` — thresholds unchanged from current `vibeEditorScale`.

### ContentSizeOptions

| Field          | Type    | Default                   | Description                                          |
| -------------- | ------- | ------------------------- | ---------------------------------------------------- |
| `padding`      | number  | 2                         | Horizontal inset subtracted from shell content width |
| `navCollapsed` | boolean | from `isNavRailCollapsed` | Whether nav rail is icon-only                        |

## Component Props

### FormSection

| Prop       | Type      | Required | Description         |
| ---------- | --------- | -------- | ------------------- |
| `title`    | string    | yes      | Accent bold heading |
| `scale`    | FormScale | yes      | Gap tightening      |
| `children` | ReactNode | yes      | Section body        |

### FormField

| Prop       | Type                            | Required | Description         |
| ---------- | ------------------------------- | -------- | ------------------- |
| `label`    | string                          | yes      | Field label         |
| `scale`    | FormScale                       | yes      | Stack vs inline     |
| `focused`  | boolean                         | yes      | Highlight label     |
| `onFocus`  | () => void                      | yes      | Mouse/focus select  |
| `children` | (focused: boolean) => ReactNode | yes      | Control render prop |

**Layout rules**:

- `stackFields === false`: row with label `padEnd(12)` + control
- `stackFields === true`: column, label above control

### ActionBar

| Prop       | Type                    | Required | Description          |
| ---------- | ----------------------- | -------- | -------------------- |
| `variant`  | `'toolbar' \| 'footer'` | no       | Default `footer`     |
| `children` | ReactNode               | yes      | Typically Button row |

**Style rules**:

- `footer`: full width, surface background, flexShrink 0, horizontal padding 1
- `toolbar`: same surface treatment; used at top of list screens

### ScreenLayout

| Prop       | Type      | Required | Description                           |
| ---------- | --------- | -------- | ------------------------------------- |
| `title`    | ReactNode | no       | Header row above scroll               |
| `scroll`   | boolean   | no       | Wrap body in scrollbox (default true) |
| `actions`  | ReactNode | no       | Sticky ActionBar slot                 |
| `hint`     | string    | no       | FooterHint text                       |
| `children` | ReactNode | yes      | Main content                          |

**Structure**: column, flexGrow 1, height 100% → optional title → scrollbox(body) → actions → hint

### ConfirmModal

| Prop           | Type       | Required | Description      |
| -------------- | ---------- | -------- | ---------------- |
| `open`         | boolean    | yes      | Visibility       |
| `title`        | string     | yes      | Modal title      |
| `message`      | string     | yes      | Body text        |
| `confirmLabel` | string     | yes      | Primary button   |
| `cancelLabel`  | string     | no       | Default "Cancel" |
| `onConfirm`    | () => void | yes      | Primary action   |
| `onCancel`     | () => void | yes      | Dismiss          |
| `width`        | number     | no       | Modal width      |

### FooterHint

| Prop | Type | Required | Description |
|------|------|-------------|
| `text` | string | yes | Muted hint line |

## Hook Contracts

### useFormScale(options?)

| Option    | Type   | Default |
| --------- | ------ | ------- |
| `padding` | number | 2       |

**Returns**: `FormScale`

**Implementation**: `useRuntime().size` → `formContentSize` → `formScale`

### useShellContentSize(padding?)

| Param     | Type   | Default |
| --------- | ------ | ------- |
| `padding` | number | 0       |

**Returns**: `TerminalSize` — canvas inside AppShell after nav rail

### useListKeyboard(options)

| Option          | Type                    | Required | Description       |
| --------------- | ----------------------- | -------- | ----------------- |
| `count`         | number                  | yes      | Item count        |
| `selectedIndex` | number                  | yes      | Current selection |
| `onSelect`      | (index: number) => void | yes      | Selection change  |
| `onActivate`    | () => void              | no       | Enter/return      |
| `onEdit`        | () => void              | no       | `e` key           |
| `onAdd`         | () => void              | no       | `a` key           |
| `enabled`       | boolean                 | no       | Default true      |

**Behavior**:

- Registers `useKeyboard` handler
- Returns early if `!enabled` or `keyboardCapture.isCaptured()`
- Keys: up/k, down/j, return, e, a (when callbacks provided)
- Clamps/wraps selection via shared logic

## Validation (theme)

### isValidHex(value: string): boolean

Moved to `packages/ui/src/theme/validate.ts`. Used by ColorField and themeDraft.

## Future: CatalogScreen (P3, not v1)

| Prop       | Type          | Description              |
| ---------- | ------------- | ------------------------ |
| `entityId` | string        | e.g. `nightshift.themes` |
| `columns`  | TableColumn[] | List columns             |
| `onSave`   | command id    | Persist command          |
| `Editor`   | Component     | Create/edit form         |

Deferred — document for tasks phase optional slice.

## State Transitions

No persisted state. Editor/list view machines unchanged:

```text
[list] --create--> [editor draft] --save--> [list]
[list] --edit--> [editor draft] --cancel--> [list]
[list] --delete confirm--> command.run --> [list]
```

ConfirmModal replaces inline Modal JSX; view state remains in each `*Screen.tsx`.

## Relationships

```text
ScreenLayout
  ├── FormSection
  │     └── FormField → TextInput | SelectField | ColorField | ...
  ├── ActionBar → Button[]
  └── FooterHint

Catalog list screen
  ├── ActionBar (toolbar)
  ├── Table (selection from useListKeyboard state)
  └── FooterHint

Plugin widget (via SDK)
  ├── SelectField
  ├── resolveBreakpoint / useShellContentSize
  └── existing Card, Panel, etc.
```
