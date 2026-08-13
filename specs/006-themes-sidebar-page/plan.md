# Implementation Plan: Themes Sidebar Page

**Branch**: `006-themes-sidebar-page` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-themes-sidebar-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a **Themes** nav screen (mirroring Dashboards/Vibes catalog/editor UX) for browsing built-in and user themes, creating/editing palettes via a simple hex color editor with live swatches, activating themes immediately, and persisting user themes as YAML under `themes/`. Extend the CLI runtime with `theme.save` / `theme.delete`, `nightshift.themes` catalog entity, dynamic `theme.activate.*` command registration, and `config.json` persistence on activate. Move theme command registration out of `AppShell` so user themes are reachable from the palette. Slim down Settings to avoid duplicate theme UX.

## Technical Context

**Language/Version**: TypeScript (strict, `NodeNext`), Node 22+ (Node 26.4+ or Bun for OpenTUI FFI)

**Primary Dependencies**: `@nightshift/ui` (Theme model, screens, ColorField), `@nightshift/services` (paths, config save), `@nightshift/cli` (runtime wiring), `yaml` (theme file I/O in ui package), OpenTUI React

**Storage**: User theme YAML under `paths.themesDir` (`themes/<name>.yaml`); `config.json` `theme` updated on activate

**Testing**: Vitest co-located — `themeDraft` shaping, `parseTheme`/`deleteTheme` round-trips in `packages/ui`, CLI command registration tests, ColorField unit tests; shell tests where FFI available

**Target Platform**: Nightshift terminal shell (new Themes nav + simplified Settings)

**Project Type**: Shell UX feature spanning `packages/ui`, `packages/services`, `apps/cli` (not a plugin)

**Performance Goals**: Catalog refresh within one command tick after save/delete; no filesystem polling; live preview on active theme save is synchronous via theme engine

**Constraints**: UI ↔ entities/commands only; soft-fail on bad YAML; keyboardCapture on TextInput; built-in delete refused; user file overrides built-in by name; hex colors `#rrggbb` lowercase; unknown YAML keys ignored; no graphical HSV picker in v1

**Scale/Scope**: Tens of themes; 11 color fields + appearance; editor grouped into Background / Surfaces / Text / Accents / Status sections

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the Speckit placeholder. Gates from `AGENTS.md` / README:

| Gate | Status | Notes |
|------|--------|-------|
| Everything is a plugin | N/A / PASS | Themes are core shell + ui package |
| Public SDK only for plugins | PASS | No plugin changes; `Theme` types already in ui/sdk re-exports |
| Dashboards consume widgets | PASS | Unchanged |
| Vibes orchestrate actions | PASS | Vibe theme picker reads refreshed `runtime.themes.list()` |
| Entities provide shared state | PASS | New `nightshift.themes` catalog |
| UI must not import parse/save directly | PASS | Save/delete via commands |
| Never let one bad input break startup | PASS | Soft-fail load/save/delete; broken YAML skipped |
| No console outside CLI | PASS | Toasts via AppRuntime |
| Tests co-located | PASS | Draft + parse/delete + ColorField tests |

**Post-design re-check**: Still PASS — contracts are command/entity surfaces; theme engine registration stays in runtime; UI screens remain decoupled from filesystem.

## Project Structure

### Documentation (this feature)

```text
specs/006-themes-sidebar-page/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/services/src/
├── paths.ts             # add themesDir
└── config.ts            # ensureConfigDirs includes themesDir

packages/ui/src/
├── theme.ts             # export THEME_COLOR_KEYS, HEX_COLOR regex helper
├── theme/
│   ├── parse.ts         # loadThemes, parseTheme, serializeTheme, saveTheme, deleteTheme, mergeThemes
│   ├── parse.test.ts
│   └── schema.ts        # ThemeSpec type alias, DEFAULT_THEME_TEMPLATE from midnight
├── components/
│   └── ColorField.tsx   # hex TextInput + swatch block + validation hint
└── app/screens/
    ├── index.ts         # ThemesScreen after Vibes in DEFAULT_SCREENS
    ├── ThemesScreen.tsx
    ├── ThemesList.tsx
    ├── ThemeEditor.tsx
    ├── themeDraft.ts
    └── themeDraft.test.ts

packages/ui/src/app/
├── AppShell.tsx         # remove static theme.activate.* registration (moved to runtime)
└── screens/
    └── SettingsScreen.tsx  # remove theme list; show terminal stats + hint to Themes

apps/cli/src/
├── runtime.ts           # theme.save, theme.delete, load/register user themes,
                         # publishThemesCatalog, refresh theme.activate.*, persist config on activate
└── runtime.test.ts      # save/delete/activate/catalog tests
```

**Structure Decision**: Mirror the 005-dashboards-sidebar-page split (`*Screen`, `*List`, `*Editor`, `*Draft`) under `packages/ui/src/app/screens/`. Theme file I/O lives in `packages/ui/src/theme/` because `Theme` / `ThemeColors` types already live in `@nightshift/ui` — no new package. Host commands live in `runtime.ts` beside `dashboard.save` / `vibe.save`. Move per-theme activate command registration from `AppShell` to runtime so catalog mutations stay in sync (fixes today's gap where user themes would not get palette commands).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

**Baseline audit (T001)**: Theme engine + 3 built-ins exist; Settings has session-only theme list; `theme.activate.*` registered in AppShell at mount (no config persist, no user themes). Missing: `themesDir`, parse/save, `nightshift.themes`, Themes screen, runtime `theme.save`/`theme.delete`, dynamic activate refresh.
