---
'@nightshift/ui': patch
'@nightshift/dashboard': patch
'@nightshift/services': patch
---

Fix global keyboard shortcuts firing while typing into a plugin widget's text field.

OpenTUI does not make a focused `<input>` swallow keystrokes the way a
browser would — every global shortcut (`e` for edit mode, digit keys for
nav, `q` to quit, ...) fired on every keypress regardless of what had native
focus, so typing "e" into the todo plugin's Add/Edit field also toggled
dashboard edit mode.

`@nightshift/ui` gained a ref-counted `keyboardCapture` on `AppRuntime`:
`TextInput` acquires it for as long as its own `focused` prop is true and
releases it on blur/unmount, and the global `useKeyboard` handlers in
`AppShell` and `DashboardApp` now bail out first when it's held. This is
automatic for any plugin built on the SDK's `TextInput` — nothing a plugin
author has to opt into.

Also fixed in passing: two unrelated `exactOptionalPropertyTypes`/mock-typing
compile errors in `@nightshift/services`' plugin host and its tests, and a
stale `pnpm-lock.yaml` entry that resolved `@nightshift/plugin-focus` to the
wrong directory.
