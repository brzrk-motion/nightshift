---
'@nightshift/cli': minor
'@nightshift/sdk': minor
'@nightshift/ui': minor
---

Shared form layout primitives and responsive helpers for shell screens and plugins.

- **Form components** — `FormSection`, `FormField`, `ActionBar`, `ScreenLayout`, `FooterHint`, and `ConfirmModal` replace duplicated editor/list layout code across Vibes, Dashboards, and Themes screens.
- **Responsive helpers** — `formLayout.ts` generalizes editor scale flags (`useFormScale`, `formScale`); `useListKeyboard` deduplicates catalog list navigation.
- **SDK** — re-exports `SelectField`, `resolveBreakpoint`, and `useShellContentSize` so plugin settings UI can match shell responsive behavior without importing `@nightshift/ui` directly.
