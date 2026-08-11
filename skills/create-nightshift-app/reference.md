# Nightshift plugin reference

Everything a plugin may use, and how the host treats it. Source of truth:
`packages/sdk/src/index.ts` (the whole public interface is one file — read it when in
doubt) and `packages/services/src/plugins/host.ts`.

## `PluginContext`

Passed to `setup(context)`. Nothing else is granted.

| Member                                                             | Capability required                | Notes                                                                                                                                                |
| ------------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest`                                                         | —                                  | Frozen copy of the declared manifest                                                                                                                 |
| `log.{error,warn,info,debug}(msg, fields?)`                        | —                                  | Scoped to the plugin id; goes to the log file                                                                                                        |
| `notify(message, { tone, timeout, key })`                          | —                                  | Toast. `tone`: `info \| success \| warning \| danger`. `timeout: 0` stays until dismissed. `key` replaces instead of stacking, namespaced per plugin |
| `entities.*`                                                       | `entities:read` / `entities:write` | Wrapped store; capability asserted per call                                                                                                          |
| `registerEntity(id, state, meta?)`                                 | `entities:write`                   | `meta`: `{ title?, unit?, owner? }`; removed again on unload                                                                                         |
| `registerCommand({ id, title, run })`                              | `commands:register`                | `run(args?: Record<string, Json>)`, may be async                                                                                                     |
| `registerWidget({ type, title, entities, render?, description? })` | `widgets:register`                 | No `render` → skipped by the registry                                                                                                                |
| `registerAutomation(spec)`                                         | `automations:register`             | Data, not code; actions name command ids                                                                                                             |
| `storage.{get,set,delete}(key)`                                    | `storage`                          | Per-plugin JSON file under the data dir; `get<T>` is async                                                                                           |
| `fetch(url, init?)`                                                | `network`                          | **HTTPS only**, refuses anything else; 15s timeout unless you pass `signal`. `init`: `{ method?, headers?, body?, signal? }`                         |
| `own(disposable \| () => void)`                                    | —                                  | Disposed on unload/teardown, and on a failed `setup()`                                                                                               |

Capabilities: `entities:read`, `entities:write`, `widgets:register`,
`commands:register`, `automations:register`, `storage` are auto-granted. `network` and
`shell` require `pluginPermissions` in `config.json` (`["network"]` or `"all"`). `shell`
is declare-only — nothing on the context grants shell access. A plugin asking for an
ungranted capability is refused at load with the exact config line in the error hint.

## Entity store

```ts
entities.get<State>(id): Entity<State> | undefined   // { id, state, meta, updatedAt }
entities.has(id): boolean
entities.list(): Entity[]
entities.register<State>(id, state, meta?): Entity<State>
entities.set<State>(id, state): Entity<State>         // replace
entities.update<State>(id, partial): Entity<State>    // shallow merge
entities.remove(id): boolean
entities.subscribe<State>(id, listener): Unsubscribe
```

State must be `Json`. Add an index signature (`[key: string]: Json`) to a state interface
so it satisfies it. Entities are in-memory only — nothing survives a restart unless the
plugin writes it to `context.storage`.

Three entities the shell publishes, readable but not yours to write:
`nightshift.vibe`, `nightshift.plugins`, `nightshift.automations`.

## Automations

```ts
context.registerAutomation({
  name: 'thing.notify-done',
  when: { type: 'entity', entity: THING_ENTITY, key: 'status' },
  and: [{ type: 'equals', entity: THING_ENTITY, key: 'status', value: 'done' }],
  then: [
    { command: 'app.notify', args: { message: 'Done.', tone: 'success' } },
  ],
});
```

Triggers: `startup`, `entity` (optional `key`), `vibe` (activate/deactivate),
`interval` (`seconds`). Conditions: `equals`, `above`, `below` — all must hold.
Actions name a command id, so an automation can only do what a command already allows.

## Widget render contract

```ts
interface WidgetProps {
  options: Record<string, Json>; // straight from the dashboard file, untouched
  width: number; // cells for the whole slot, panel chrome included
  height: number;
  title?: string; // set only when the dashboard overrode the title
}
```

The dashboard wraps the return value in a `Panel` carrying the title, resolves `width`
from the row's weighted split and `height` from the row's share of the terminal, and
remounts the component when `dashboard.refresh` fires. A widget type nothing registered
draws a placeholder; a widget whose `render` throws is the one failure the host cannot
contain — guard your rendering instead of letting it throw.

## Hooks

| Hook                   | Returns                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `useEntity<State>(id)` | `Entity<State> \| undefined`, re-rendering on change                        |
| `useEntities(ids)`     | Several at once                                                             |
| `useCommands()`        | `CommandRegistry`: `run(id, args?): Promise<void>`, `get`, `list`, `search` |
| `useTheme()`           | `{ name, colors }` — see the colour list below                              |
| `useToasts()`          | `push(message, { tone, timeout, key })` — for a message raised by a click   |

Theme colours: `background`, `surface`, `border`, `borderMuted`, `text`, `muted`,
`accent`, `accentSecondary`, `success`, `warning`, `danger`. `useTheme()` also gives
`name` and `appearance`. Built-in themes: `midnight`, `ember`, `daylight`.

## Component catalogue

All re-exported from `@nightshift/sdk`. `tone` is
`accent | success | warning | danger` unless noted; `BadgeTone` adds `neutral`.

**Containers**

- `Panel { title?, footer?, active?, grow?, density: 'compact'|'normal'|'spacious', padding? }`
  — 3 rows minimum at `normal`. The dashboard already gives each widget one.
- `Card { title?, value?, subtitle?, tone: 'default'|..., active? }` — a Panel around one
  headline value. Nests a second border inside a widget; deliberate for a single big
  number (`focus.today`), wrong for anything else.
- `Modal { title?, open?, width?, height?, hint? }`
- `Tabs { items: {id,label}[], value, onChange }` — one row of tabs plus its children
- `Toolbar { orientation }` — lays out buttons/chips with gaps

**Controls**

- `Button { label, onPress, primary?, disabled?, compact? }` — **fixed 3 rows tall**
- `IconButton { icon, label?, onPress, active?, disabled? }` — 1 row
- `Toggle { label?, value, onChange, disabled? }` — 1 row
- `TextInput { value, onInput, onSubmit, focused?, placeholder?, prefix? }` — 1 row;
  acquires keyboard capture while `focused`

**Data**

- `Table<Row> { columns: {key,header,span?,align?,render?}[], rows, width?, selected?, onSelect?, empty? }`
- `List { items: {id,label,detail?,marker?}[], selected?, onSelect?, empty? }`
- `Timeline { items: {id,time,label,tone?,current?}[], empty? }`
- `StatRow { label, value, tone? }` · `Metric { label, value, tone? }` — 1 row each

**Indicators**

- `ProgressBar { value (0–1), width?, label?, showPercent?, tone? }` — 1 row
- `Meter { value, width?, label?, tone? }` · `StatusBadge { label, tone?, dot? }` ·
  `StatusDot { tone? }` · `Icon { name, fallback?, color? }` · `KeyHint { keys, label }` ·
  `Divider { orientation?, length? }` — **always pass `length`** in a column, or it
  stretches down instead of ruling across

**Charts** (they draw into the cells you give them, so pass real numbers)

- `Sparkline { values, width?, min?, max?, tone?, caption? }` — 1 row
- `LineChart { values, width, height, min?, max?, tone?, showAxis? }`
- `BarChart { data, width, labelWidth?, max?, showValues?, tone? }`
- `ActivityWaveform { values, width?, tone? }`

**States**

- `EmptyState { message, hint? }` · `ErrorState { message, hint? }` ·
  `LoadingState { message? }` — all centred, filling their parent

Icon names: `dashboard`, `vibes`, `apps`, `entities`, `automations`, `settings`, `play`,
`pause`, `stop`, `reset`, `check`, `cross`, `warning`, `info`, `dot`, `weatherClear`,
`weatherPartly`, `weatherCloudy`, `weatherFog`, `weatherRain`, `weatherSnow`,
`weatherStorm`, `weatherUnknown`. `Icon` falls back to a literal string, so a bare glyph
(`'▶'`) also works.

## OpenTUI intrinsics

JSX comes from `@opentui/react` (`jsxImportSource` in the plugin's tsconfig). Available
elements a widget legitimately uses:

- `<box style={{ ... }}>` — flexbox: `flexDirection`, `flexGrow`, `flexShrink`,
  `flexBasis`, `gap`, `padding*`, `width`, `minWidth`, `height`, `alignItems`,
  `justifyContent`, `overflow`, `backgroundColor`, `border`, `borderStyle`, `borderColor`.
  Mouse props: `onMouseDown`, `onMouseUp`, `onMouseOver`, `onMouseOut`.
- `<text fg={color} wrapMode="none">` with `<b>`, `<span fg={...}>` inside
- `<scrollbox style={{ flexGrow: 1 }}>` — the only real scrolling container
- `<input>` — use the SDK's `TextInput` instead
- `<ascii-font text font color />` — `block` (6 rows) or `tiny` (2 rows, barely legible)

`react` hooks (`useState`, `useEffect`, `useMemo`) are fine. Do not import from
`@opentui/core` or `@nightshift/ui` — reach for what the SDK re-exports.

## Load, discovery and resolution

1. `discoverPlugins()` collects sources: `config.json`'s `plugins` array (bare package
   names resolved by Node, path-like entries relative to cwd), then a scan of the config
   directory's `plugins/` folder (a subdirectory with a `package.json`, or a loose
   `.js`/`.mjs`). Config entries win on id collision.
2. `resolvePluginSpecifier` tries the user's config directory first, then the
   application — so a user can shadow a bundled plugin without forking.
3. The host imports the module, takes `default` (or a named `plugin`) export, checks
   `isCompatible(manifest)` (`apiVersion` must equal `NIGHTSHIFT_API_VERSION` — never set
   `apiVersion` yourself), checks permissions, builds the scoped context, runs `setup()`.
4. Failure at any step: rolled back, reported as a `PluginFailure`, skipped. Startup
   continues.
5. `unload()` runs `teardown?()`, disposes the `own()` bag, and removes every entity the
   plugin registered.

## Dashboard YAML, for a widget author

```yaml
rows:
  - height: 2 # relative weight, not rows
    widgets:
      - type: thing.now
        title: Override
        span: 2 # relative width within the row
        minWidth: 40 # below this many columns the widget gets its own row
        minHeight: 12 # its row grows to fit it
        options: # arrives as WidgetProps.options
          location: home
        when: # only drawn while this holds
          type: equals
          entity: thing.state
          key: status
          value: running
```

Document every option key you read in the widget's `description` and in the README entry,
and default sensibly when it is absent — unknown and missing keys are both normal.

## Package templates

`package.json` (copy `plugins/weather/package.json`): `"name": "@nightshift/plugin-<id>"`,
`"type": "module"`, `main`/`types` → `dist/`, an `exports` map, `"sideEffects": false`,
scripts `build` (`tsc -p tsconfig.json`), `typecheck` (`tsc -p tsconfig.typecheck.json`),
`lint` (`eslint src`), `test` (`vitest run --passWithNoTests`), `clean`.

`tsconfig.json`: extends `../../tsconfig.base.json`, sets `rootDir: ./src`,
`outDir: ./dist`, `jsx: react-jsx`, `jsxImportSource: @opentui/react`, excludes tests.
`tsconfig.typecheck.json`: extends `./tsconfig.json` with `noEmit`, no excludes.

`vitest.config.ts`: copy `plugins/weather/vitest.config.ts` — it includes `.test.tsx`,
sets the JSX import source for esbuild, and only enables the FFI fork pool on a Node that
supports it (26.4+), which is what lets `describe.skipIf(!detectRuntime().ffi)` work.

## Conventions ESLint and review will enforce

- Inline type imports: `import { type Foo, bar } from '...'`
- No `console.*` outside `apps/cli/**`
- Tests co-located next to the file they test
- `_`-prefixed names for intentionally unused parameters (`_props`)
- Unknown config/YAML keys are ignored, never rejected
