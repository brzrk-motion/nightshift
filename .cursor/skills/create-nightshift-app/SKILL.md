---
name: create-nightshift-app
description: Builds a new Nightshift app (plugin) end to end — scaffolding the workspace package, writing definePlugin setup with entities, commands, widgets and automations against @nightshift/sdk, making widgets scale to the cells they are given, testing them, and wiring them into the CLI. Use when creating, scaffolding, extending or reviewing a Nightshift plugin, app or dashboard widget, when working under plugins/ in the nightshift repo, or when the user mentions definePlugin, PluginContext, registerWidget, PluginWidget, WidgetProps, or @nightshift/sdk.
---

# Creating a Nightshift App

In Nightshift an "app" is a **plugin**: a workspace package under `plugins/<name>/`
that default-exports `definePlugin(...)`. Everything a user sees — clock, weather,
Spotify, todo — is one. There is no other extension point.

Read `AGENTS.md` first (architecture, dependency direction, conventions). This skill
covers what it does not: the exact build order, the widget/state patterns the bundled
plugins converged on, how to make a widget survive being resized, and everything that
must change outside `plugins/` for the app to ship with the CLI.

Two plugins are the references. Copy from them rather than inventing:

- `plugins/pomodoro` — the minimal shape: entity, commands, two widgets, automations.
- `plugins/weather` — the full shape: network, storage, per-slot options, in-widget
  configuration, and the responsive scaling ladder in `scale.ts`.

## Workflow

Copy this checklist into the todo list and work it in order. Do not skip to widgets:
the entity and command layer is what a widget is allowed to be a thin skin over.

```
- [ ] 1. Plan: entities, commands, widgets, capabilities, options
- [ ] 2. Scaffold the package (package.json, tsconfigs, vitest.config.ts)
- [ ] 3. Pure logic + state modules with tests (no SDK imports)
- [ ] 4. src/index.ts — definePlugin: entities, commands, automations, timers
- [ ] 5. src/widgets.tsx — render functions, scaled to WidgetProps width/height
- [ ] 6. Tests: setup() against a fake context, widgets against the real renderer
- [ ] 7. Integrate with the CLI (see "CLI integration checklist")
- [ ] 8. pnpm lint && pnpm typecheck && pnpm test, then pnpm start
- [ ] 9. pnpm changeset
```

### 1. Plan

Decide and write down, before any code:

| Decision          | Rule                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| Plugin id         | `/^[a-z][a-z0-9-]*$/`, matches the directory: `plugins/<id>/`                     |
| Entity ids        | `<id>.<thing>`, e.g. `weather.locations`. One per shape of state a widget reads   |
| Command ids       | `<id>.<verb>`, e.g. `spotify.play`. Every mutation is a command                   |
| Widget types      | `<id>.<view>`, e.g. `clock.now`. This is the name a dashboard YAML file uses      |
| Capabilities      | Ask for the least that works; `network`/`shell` need a config grant               |
| Dashboard options | Per-instance config only (`options.location`); user settings belong in the widget |

### 2. Scaffold

```
plugins/<id>/
  package.json          # @nightshift/plugin-<id>; only dependency: @nightshift/sdk (+ react, @opentui/react)
  tsconfig.json         # extends ../../tsconfig.base.json, jsx: react-jsx, jsxImportSource: @opentui/react
  tsconfig.typecheck.json
  vitest.config.ts      # copy plugins/weather/vitest.config.ts verbatim — it gates the FFI renderer
  src/
    index.ts            # definePlugin
    entity.ts           # optional: state types, initial state, hydration guards (weather/habit/todo)
    <domain>.ts         # pure reducers / formatting / client; colocate entity id here when that's all you need (pomodoro)
    widgets.tsx         # render functions
    scale.ts            # only if the widget has a hero that must shrink
    *.test.ts(x)        # co-located
```

Copy `plugins/weather/package.json`, `tsconfig.json`, `tsconfig.typecheck.json` and
`vitest.config.ts` and change the name/description. `pnpm-workspace.yaml` already globs
`plugins/*`, so `pnpm install` picks the package up once it exists.

`@nightshift/entities` and `@nightshift/ui` may appear in `devDependencies` (for types in
tests) but **never** in `dependencies` — a third-party plugin only gets the SDK.

### 3. Pure logic first

Everything that is not I/O or JSX goes in its own module as pure functions, tested
without a renderer: reducers over state (`plugins/todo/src/todos.ts`), formatting
(`plugins/clock/src/format.ts`), API clients that take `fetch` as their first argument
(`plugins/weather/src/client.ts`), size decisions (`plugins/weather/src/scale.ts`).

Client modules throw plain `Error`s — `NightshiftError` is host-side and not exported by
the SDK. `setup()` catches and turns them into entity state, a log line, or `notify`.

### 4. `src/index.ts`

```ts
import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';

export default definePlugin({
  id: 'thing',
  name: 'Thing',
  version: '0.1.0',
  description: 'One line, shown in the Apps screen.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    const stored = await context.storage.get('settings');
    const initial = hydrate(stored);

    context.registerEntity(THING_ENTITY, initial, {
      title: 'Thing',
      owner: 'thing',
    });

    const read = (): ThingState =>
      context.entities.get<ThingState>(THING_ENTITY)?.state ?? initialState();
    const write = (next: ThingState): void => {
      context.entities.set(THING_ENTITY, next);
      context.storage.set('settings', next).catch((error: unknown) => {
        context.log.warn('Could not save thing settings', {
          error: `${error}`,
        });
      });
    };

    context.registerCommand({
      id: 'thing.toggle',
      title: 'Toggle the thing',
      run: (args) => write(toggle(read(), boolArg(args, 'on'))),
    });

    context.registerWidget({
      type: 'thing.now',
      title: 'Thing',
      entities: [THING_ENTITY],
      description: 'Shown in the widget picker when the user searches.',
      render: ThingWidget,
    });

    const timer = setInterval(() => void refresh(), POLL_MS);
    timer.unref?.();
    context.own(() => clearInterval(timer));

    context.log.info('Thing plugin ready');
  },
});
```

Rules this shape encodes:

- **`read`/`write` closures.** The entity store is the single source of truth; never
  keep domain state in a module-level variable or in widget `useState`.
- **Commands are the only mutation path.** A widget calls `commands.run('thing.x', args)`;
  it never writes an entity. That is what makes every action reachable from the palette,
  a keybinding, a vibe's `onActivate` and an automation's `then` for free.
- **Validate command args.** They arrive as `Record<string, Json> | undefined` from YAML
  or a widget. Use narrow helpers (`stringArg`, `boolArg`) and return silently on bad
  input — a bad arg is not a crash.
- **`context.own()` everything with a lifetime**, and call `timer.unref?.()` so a timer
  never holds the process open.
- **Persist through `context.storage`**, fire-and-forget with a `.catch` that logs.
  Entities are not persisted between runs; storage is. Secrets go in storage and _never_
  on an entity — only status flags derived from them (`spotify`'s session entity).
- **Re-export the public surface** at the bottom of `index.ts` (entity ids, state types,
  pure helpers, widgets) so tests and the CLI can import them.
- Register an automation only for behaviour that should react to state rather than be
  invoked: `pomodoro.notify-work-complete` is the model. Actions reference command ids.

### 5. `src/widgets.tsx`

A widget is a plain component receiving `WidgetProps`: `{ options, width, height, title? }`.
The dashboard has already wrapped it in a titled `Panel`, so render _content_, not a frame.
`width`/`height` are the whole slot in terminal cells, panel border and padding included
(4 columns, 4 rows).

```tsx
export function ThingWidget({
  options,
  width,
  height,
}: WidgetProps): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const entity = useEntity<ThingState>(THING_ENTITY);
  const state = entity?.state ?? initialState();
  // ...
}
```

- Call `useEntity` for every entity read. The `entities` array on `registerWidget` is
  metadata for the picker and prefetch, not a subscription.
- Never hardcode colours. Everything comes from `useTheme().colors`: `text`, `muted`,
  `accent`, `accentSecondary`, `border`, `borderMuted`, `surface`, `success`, `warning`,
  `danger`.
- Widget-local `useState` is for view state only: which tab is open, whether the settings
  panel is showing, which row is mid-edit.
- Cover every state the entity can be in, in this order: needs-configuration form →
  `LoadingState` → `ErrorState` → `EmptyState` → content. `plugins/weather/src/widgets.tsx`
  and `plugins/spotify/src/widgets.tsx` both read as exactly that sequence of early returns.
- For text entry use the SDK's `TextInput` with `focused` — it acquires the shell's
  keyboard capture so typing `e` does not also open dashboard edit mode. Mount it only
  while editing. Do not add a global `useKeyboard` handler in a widget; those fire on
  every keypress regardless of focus.
- Long lists go in `<scrollbox style={{ flexGrow: 1 }}>` (no `flexDirection`), never a
  plain `<box>`, which grows past the widget instead of clipping.
- In-widget configuration beats dashboard `options` for anything a user changes at
  runtime (clock's Settings toggle, Spotify's credentials form, weather's location
  editor). Reserve `options` for binding one widget instance to one slot of data.

See [reference.md](reference.md) for the full SDK surface, component catalogue and
OpenTUI intrinsic elements.

### 6. Responsive by construction

A widget can be handed anything from 20x4 to 200x50 and must not draw outside its slot —
OpenTUI boxes do not clip by default. Nothing is responsive automatically.

The rule: **decide the treatment from `width`/`height` in a pure, tested module, then
render it.** Do not scatter `width < 40` checks through JSX.

```ts
export function resolveLayout(width: number, height: number): SpotifyLayout {
  if (width < 44 || height < 8) return 'compact';
  if (width >= 72 && height >= 14) return 'wide';
  return 'regular';
}
```

For a widget with a hero that must shrink, use the ladder pattern from
`plugins/weather/src/scale.ts`: rungs ordered richest-first, each measured against the
cells available, take the first that fits. Read [responsive.md](responsive.md) before
building anything with large type, ASCII art, charts or a toolbar — it has the row/column
costs of every SDK component and the OpenTUI clipping traps.

### 7. Tests

- `index.test.ts` — drive `setup()` against a fake `PluginContext` from
  `createPluginTestContext()` (`@nightshift/sdk/testing`). It collects entities, commands,
  widgets, automations, storage, disposers and `notify` so assertions read as "running this
  command wrote that state". Pass `manifest: plugin.manifest`, seed `storageData` / `fetch`
  as needed. Use `vi.useFakeTimers()` for polling, and a stub `fetch` returning
  `new Response(JSON.stringify(...))` for network.
- `widgets.test.tsx` — render for real with `testRender` from `@opentui/react/test-utils`,
  wrapped in `ThemeProvider` + `RuntimeProvider`, then assert on `captureCharFrame()`.
  Gate the suite with `describe.skipIf(!detectRuntime().ffi)`.
- Assert the responsive behaviour: render the same widget at two or three sizes and check
  that the small one dropped what it should and kept what it must
  (`plugins/weather/src/widgets.test.tsx` is the model).
- Pure modules get plain unit tests; that is where edge cases belong.

## CLI integration checklist

Everything below is outside `plugins/`. A plugin only ships with the CLI when all of it is
done. Skip the last three only for a plugin that is deliberately not bundled (installed
via `config.json`'s `plugins` array or dropped in the config directory's `plugins/`).

```
- [ ] apps/cli/package.json — add "@nightshift/plugin-<id>": "workspace:*" to dependencies
      (this is what makes the bare specifier resolvable from the CLI)
- [ ] packages/services/src/config.ts — add '@nightshift/plugin-<id>' to DEFAULT_CONFIG.plugins
- [ ] packages/services/src/config.ts — if it needs network/shell, add the grant to
      DEFAULT_CONFIG.pluginPermissions
- [ ] packages/services/src/config.ts — bump CONFIG_VERSION and add a migrateConfig step
      that adds the plugin (and its grant) to an existing on-disk config
- [ ] packages/services/src/config.test.ts — extend the migration tests for the new version
- [ ] packages/dashboard/src/schema.ts — add the widget to DEFAULT_DASHBOARD only if a
      fresh install should see it (keep `minimal`/`nightshift` free of plugin widgets)
- [ ] README.md — add the plugin to the bundled list, and to the pluginPermissions example
      if it needs a grant
- [ ] pnpm install (links the new workspace member), then pnpm build
- [ ] pnpm changeset — all @nightshift/* packages are version-locked
```

Nothing else needs to change. Commands, widgets, automations and entities all reach the
shell through the host: `apps/cli/src/runtime.ts` registers plugin commands as app
commands, feeds plugin widgets to the widget registry, hands automations to the engine,
and pipes `context.notify` into the toast stack. Do not add plugin-specific code there.

## Verify

```bash
pnpm --filter @nightshift/plugin-<id> lint typecheck test   # while iterating
pnpm lint && pnpm typecheck && pnpm test                    # before calling it done
pnpm start                                                  # build + launch, see it draw
```

Then resize the terminal narrow and short with the widget on screen. If content spills over
the panel border or a control becomes unreachable, the scaling in step 6 is wrong.

## Failure philosophy

Match the rest of the codebase: **one bad input must never break startup.**

- A plugin that throws in `setup()` is caught, reported and skipped — but its partial work
  is rolled back, so leave nothing global behind that `context.own()` does not cover.
- A widget renders a state for every failure instead of throwing: `ErrorState` with the
  message, and a way out (a "Change location" button).
- Use `context.notify(message, { tone, key })` for a transient failure the user needs to
  know about _now_ — a failing poll, a device that is not there. Dedupe with a stable
  `key` and remember the last announced message so an hour of failures costs one toast.
- Use `context.log.warn` for the log file, an entity for state a widget draws, and
  `notify` for a human at the keyboard. Never all three for the same event.
- `console.*` is an ESLint error outside `apps/cli/**`.

## Additional resources

- [reference.md](reference.md) — the full `@nightshift/sdk` surface, component and hook
  catalogue, OpenTUI intrinsics, plugin host lifecycle, dashboard YAML for widget authors.
- [responsive.md](responsive.md) — the scaling methodology: cell budgets per component,
  the ladder pattern, breakpoints the bundled plugins use, and OpenTUI layout traps.
