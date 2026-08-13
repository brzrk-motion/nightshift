# Quickstart: Themes sidebar page validation

**Feature**: `006-themes-sidebar-page`  
**Purpose**: Prove the Themes screen works end-to-end after implementation. Not an implementation guide.

## Prerequisites

- Repo root: `pnpm install`
- Node 22+ (Node 26.4+ or Bun for live shell)
- Feature dir: [plan.md](./plan.md), [contracts/themes-surface.md](./contracts/themes-surface.md)

## Setup

```bash
pnpm install
pnpm --filter @nightshift/ui build
pnpm --filter @nightshift/services build
pnpm --filter @nightshift/cli build
```

Confirm config themes directory exists (created on first theme save): `$XDG_CONFIG_HOME/nightshift/themes/` (or platform equivalent).

## Automated checks

```bash
pnpm --filter @nightshift/ui test
pnpm --filter @nightshift/ui typecheck
pnpm --filter @nightshift/services test
pnpm --filter @nightshift/cli test
pnpm --filter @nightshift/cli typecheck
```

Expected:

- `parseTheme` / `deleteTheme` / hex validation per [data-model.md](./data-model.md)
- `themeDraft` tests: drafts → save args; invalid hex rejected
- `ColorField` renders swatch for valid hex
- No `theme/parse` import under `packages/ui/src/app/screens/Themes*.tsx`
- Runtime tests: `theme.save` registers theme; `theme.delete` removes user file; activate persists config

## Manual checks (live shell)

```bash
pnpm start
```

1. Confirm sidebar order: **Home**, **Dashboards**, **Vibes**, **Themes**, **Apps**, …
2. Open **Themes** — table lists `midnight`, `ember`, `daylight` with active ● on current theme.
3. **Activate** `ember` — shell colors warm immediately; quit and restart → still `ember` (`config.json` `theme`).
4. **Add theme**: name `forest`, appearance dark, change `accent` to `#5ad19b`, save.
5. Confirm `themes/forest.yaml` on disk matches [contracts/themes-surface.md](./contracts/themes-surface.md) shape (all 11 color keys).
6. **Activate** `forest` from list — palette updates.
7. Open **Vibes** → Add/Edit → theme picker includes `forest`.
8. Open **Dashboards** → Add/Edit → theme picker includes `forest`.
9. Open command palette → `Use the forest theme` command exists.
10. **Duplicate** `forest` → save as `forest-alt` → two files exist.
11. **Delete** `forest-alt` → file gone; list and pickers update.
12. Attempt **Delete** on built-in `midnight` without user file → refused with clear toast.
13. **Settings** screen no longer lists themes; shows hint to Themes screen.
14. While typing hex in Theme editor, digit keys must not switch nav screens (`keyboardCapture`).

## Done when

- SC-001–SC-005 in [spec.md](./spec.md) are demonstrably met
- Automated checks above are green
- Nav labels and order match the contract
