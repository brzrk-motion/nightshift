# Quickstart: Dashboards sidebar page validation

**Feature**: `005-dashboards-sidebar-page`  
**Purpose**: Prove the Dashboards screen and Home rename work end-to-end after implementation. Not an implementation guide.

## Prerequisites

- Repo root: `pnpm install`
- Node 22+ (Node 26.4+ or Bun for live dashboard)
- Feature dir: [plan.md](./plan.md), [contracts/dashboards-surface.md](./contracts/dashboards-surface.md)

## Setup

```bash
pnpm install
pnpm --filter @nightshift/dashboard build
pnpm --filter @nightshift/ui build
pnpm --filter @nightshift/cli build
```

Confirm config dashboards directory exists (created on first Nightshift run): `$XDG_CONFIG_HOME/nightshift/dashboards/` (or platform equivalent).

## Automated checks

```bash
pnpm --filter @nightshift/dashboard test
pnpm --filter @nightshift/dashboard typecheck
pnpm --filter @nightshift/ui test
pnpm --filter @nightshift/ui typecheck
pnpm --filter @nightshift/cli typecheck
```

Expected:

- `deleteDashboard` / `BLANK_DASHBOARD` behavior per [data-model.md](./data-model.md)
- `dashboardDraft` tests: drafts → save args; invalid refresh rejected; rows preserved on metadata edit
- No `@nightshift/dashboard` import under `packages/ui/src/app/screens/Dashboards*.tsx`

## Manual checks (live shell)

```bash
pnpm start
```

1. Confirm sidebar order: **Home**, **Dashboards**, **Vibes**, …
2. **Home** shows the live dashboard canvas; footer shows dashboard title (e.g. `nightshift · home`).
3. Open **Dashboards** — table lists built-in `home` (and any user dashboards) with active ● on the open one.
4. **Add dashboard**: name `work`, title `Work`, save.
5. Confirm `dashboards/work.yaml` on disk matches [contracts/dashboards-surface.md](./contracts/dashboards-surface.md) blank template shape.
6. **Open** `work` from list → switch to **Home** → Work dashboard appears (minimal/blank layout).
7. On Home press `e`, add a widget, save — layout persists in `work.yaml`.
8. Open **Vibes** → Add/Edit vibe → dashboard picker includes `work`.
9. **Duplicate** `work` → save as `work-copy` → two files exist.
10. **Delete** `work-copy` → file gone; list and vibe picker update.
11. Attempt **Delete** on built-in `home` without user file → refused with clear toast.
12. While typing in Dashboards editor, digit keys must not switch nav screens (`keyboardCapture`).

## Done when

- SC-001–SC-005 in [spec.md](./spec.md) are demonstrably met
- Automated checks above are green
- Nav labels and order match the contract
