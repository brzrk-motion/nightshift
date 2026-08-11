# Quickstart: User-friendly vibe editor validation

**Feature**: `003-vibe-editor`  
**Purpose**: Prove the friendlier Vibes editor works end-to-end after implementation. Not an implementation guide.

## Prerequisites

- Repo root: `pnpm install`
- Node 22+ (Node 26.4+ or Bun for live dashboard)
- Feature dir: [plan.md](./plan.md), [contracts/vibe-editor-surface.md](./contracts/vibe-editor-surface.md)

## Setup

```bash
pnpm install
pnpm --filter @nightshift/vibes build
pnpm --filter @nightshift/ui build
pnpm --filter @nightshift/cli build
```

Confirm config vibes directory exists (created on first Nightshift run): `%APPDATA%\nightshift\vibes\` on Windows, `$XDG_CONFIG_HOME/nightshift/vibes/` elsewhere.

## Automated checks

```bash
pnpm --filter @nightshift/vibes test
pnpm --filter @nightshift/vibes typecheck
pnpm --filter @nightshift/ui test
pnpm --filter @nightshift/ui typecheck
pnpm --filter @nightshift/cli typecheck
```

Expected:

- `serializeVibe` / `saveVibe` / `deleteVibe` round-trips and delete behavior per [data-model.md](./data-model.md)
- `vibeDraft` tests: pickers’ drafts → save args; invalid args rejected; entities preserved
- No `@nightshift/vibes` import under `packages/ui`

## Manual checks (live shell)

```bash
pnpm start
```

1. Open **Vibes** (nav / key `2`).
2. Confirm full-width action bar and catalog columns (title, theme, dashboard, source, active).
3. **Add vibe**: pick a theme from the list, pick a dashboard, add `focus.start` via command search with `{"minutes":25}`, save.
4. Confirm `vibes/<name>.yaml` on disk matches [contracts/vibe-editor-surface.md](./contracts/vibe-editor-surface.md).
5. **Edit** the same vibe; confirm fields round-trip; summary mentions theme + command.
6. **Activate**; header shows active vibe; theme/dashboard side effects apply when those resources exist.
7. **Duplicate** → change name → save → two user files.
8. **Delete** the copy → file gone, catalog updates.
9. Attempt **Delete** on a pure built-in → refused with a clear toast/message.
10. While typing in a field, digit keys must not switch nav screens (`keyboardCapture`).

## Done when

- SC-001–SC-005 in [spec.md](./spec.md) are demonstrably met
- Automated checks above are green
