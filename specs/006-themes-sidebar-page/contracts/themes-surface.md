# Contract: Themes host surface

**Feature**: `006-themes-sidebar-page`  
**Audience**: Themes screen (`packages/ui`), CLI runtime, theme YAML authors, vibe/dashboard editors  
**Transport**: In-process commands + entity store (no HTTP)

## Entities

| Id | Publisher | Shape | Consumers |
|----|-----------|-------|-----------|
| `nightshift.themes` | CLI runtime | `{ themes: ThemeCatalogRow[] }` | ThemesScreen list + edit load |

UI MUST NOT import theme parse/save from `@nightshift/ui/theme/parse` or read `themesDir` directly.

### ThemeCatalogRow (JSON)

```typescript
{
  name: string;
  source: 'built-in' | 'user';
  active: boolean;
  appearance: 'dark' | 'light';
  colors: {
    background: string;
    surface: string;
    border: string;
    borderMuted: string;
    text: string;
    muted: string;
    accent: string;
    accentSecondary: string;
    success: string;
    warning: string;
    danger: string;
  };
}
```

## Commands

### `theme.save` (new; hidden)

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | yes | `/^[a-z][a-z0-9-]*$/` |
| `appearance` | string | yes | `'dark'` or `'light'` |
| `colors` | object | yes | All ThemeColors keys, `#rrggbb` hex strings |

**Effect**: Validate via serialize→parse → `saveTheme(themesDir)` → `app.themes.register(spec)` → re-register `theme.activate.*` commands → `publishThemesCatalog` → if saved theme is currently active, re-activate to refresh subscribers → success toast.

**Errors**: `CONFIG_INVALID` / `CONFIG_UNWRITABLE` → command failed → danger toast.

### `theme.delete` (new; hidden)

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | yes | Theme name |

**Effect**: If no user file → error "built-in themes cannot be deleted". Else delete file → unregister from engine if user-only → re-merge built-in → if deleted was active, activate fallback → persist `config.json` → refresh activate commands → refresh catalog → toast.

### `theme.activate.<name>` (moved registration to runtime)

Registered dynamically for every theme in merged catalog (built-in + user). **Activate** / Enter on Themes list runs this id.

**Effect**:
1. `app.themes.activate(name)`
2. `saveConfig({ ...config, theme: name })`
3. `publishThemesCatalog` (update `active` flags)

Previously registered in `AppShell` at mount — registration moves to runtime with refresh on catalog mutations.

### `theme.next` (unchanged)

Remains in `AppShell`. Cycles `runtime.themes.list()` order.

## UI flow contract

```text
Nav order: Home | Dashboards | Vibes | Themes | Apps | Entities | Automations | Settings

ThemesScreen view:
  list | create(draft) | edit(draft)

Toolbar (list, full-width bar): Add | Edit | Activate | Duplicate | Delete
Editor sections:
  Identity (name, appearance)
  Colors grouped: Background | Surfaces | Text | Accents | Status
  Each color: ColorField (swatch + hex input)
  Save/Cancel bar

Save → theme.save(draftToSaveArgs(draft))
Cancel → list
Activate → theme.activate.<selected.name>
```

## Shell changes

| Location | Change |
|----------|--------|
| `DEFAULT_SCREENS` | Insert `{ id: 'themes', label: 'Themes', icon: 'themes', render: ThemesScreen }` after Vibes |
| `AppShell.tsx` | Remove static `theme.activate.*` registration block |
| `SettingsScreen.tsx` | Remove theme List; keep terminal stats + hint to Themes screen |
| `NavRail` / icons | Add `themes` icon glyph (match existing icon set pattern) |

## Picker data sources

| Field | Source |
|-------|--------|
| Theme dropdown (Vibe/Dashboard editors) | `runtime.themes.list()` after engine refresh |
| List rows | `nightshift.themes` |
| Active indicator | `row.active` |

## File format

YAML mapping:

```yaml
name: <kebab-case>
appearance: dark | light
colors:
  <ThemeColorKey>: '#rrggbb'
  # all 11 keys required
```

Machine writes via `serializeTheme`. Unknown keys ignored on parse (forward-compatible).

## Paths

| Path | Added |
|------|-------|
| `NightshiftPaths.themesDir` | `join(configDir, 'themes')` |
| `ensureConfigDirs` | creates `themesDir` |

## ColorField component contract

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Field name shown to user |
| `value` | string | Hex string (may be invalid while typing) |
| `focused` | boolean | Focus ring |
| `onFocus` | () => void | |
| `onChange` | (hex: string) => void | |
| `disabled` | boolean? | Edit locked name row only |

Renders: `[swatch] #rrggbb ▏` using `TextInput` with `keyboardCapture`. Swatch uses parsed color when valid, `theme.colors.border` when invalid.
