import { join } from 'node:path';
import { createEntityStore, type EntityStore } from '@nightshift/entities';
import {
  createPermissionPolicy,
  createPluginHost,
  discoverPlugins,
  saveConfig,
  type PluginFailure,
  type PluginHost,
} from '@nightshift/services';
import {
  BLANK_DASHBOARD,
  BUILT_IN_DASHBOARDS,
  BUILT_IN_WIDGETS,
  createWidgetRegistry,
  deleteDashboard,
  loadDashboards,
  mergeDashboards,
  parseDashboard,
  saveDashboard,
  serializeDashboard,
  type DashboardSpec,
  type RowSpec,
  type WidgetRegistry,
} from '@nightshift/dashboard';
import { createAutomationEngine, type AutomationEngine } from '@nightshift/automations';
import { NightshiftError, type Json } from '@nightshift/core';
import {
  BUILT_IN_VIBES,
  createVibeEngine,
  deleteVibe,
  findVibe,
  loadVibes,
  parseVibe,
  saveVibe,
  serializeVibe,
  type VibeEngine,
  type VibeSpec,
} from '@nightshift/vibes';
import {
  BUILT_IN_THEMES,
  createAppRuntime,
  createThemeEngine,
  deleteTheme,
  loadThemes,
  parseTheme,
  saveTheme,
  serializeTheme,
  type AppRuntime,
  type ThemeColors,
  type ThemeSpec,
} from '@nightshift/ui';
import type { CliContext } from './context.js';

/**
 * Assembling the runtime: the entity store, the plugins, the widgets they
 * contribute, and the dashboards that arrange them.
 *
 * This is the only place the pieces are wired together. Everything below it
 * knows about the layer beneath and nothing about the CLI, which is what keeps
 * the same runtime usable from a test, a script, or a future daemon.
 */
export interface NightshiftRuntime {
  app: AppRuntime;
  entities: EntityStore;
  plugins: PluginHost;
  widgets: WidgetRegistry;
  dashboards: DashboardSpec[];
  vibes: VibeEngine;
  automations: AutomationEngine;
  /** Problems that did not stop startup, reported once the UI is up. */
  warnings: string[];
  /** Called when Home switches dashboards — updates catalog active flags. */
  setActiveDashboard(name: string): void;
  /** Notified when the merged dashboard list changes after save/delete. */
  subscribeDashboards(listener: (dashboards: readonly DashboardSpec[]) => void): () => void;
  dispose(): Promise<void>;
}

export interface CreateRuntimeOptions {
  /** Called by the app's quit command. */
  onQuit?: () => void;
}

function describe(failure: PluginFailure): string {
  const reason = failure.error instanceof Error ? failure.error.message : String(failure.error);
  return `Plugin "${failure.source.id}" did not load: ${reason}`;
}

const VIBE_NAME = /^[a-z][a-z0-9-]*$/;
const DASHBOARD_NAME = /^[a-z][a-z0-9-]*$/;
const THEME_NAME = /^[a-z][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsFromJson(value: Json | undefined): RowSpec[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new NightshiftError('CONFIG_INVALID', 'dashboard.save rows must be a list.');
  }
  return value as unknown as RowSpec[];
}

/** Turns a command-args blob into a validated DashboardSpec. */
function dashboardFromArgs(
  args: Record<string, Json> | undefined,
  existingRows?: RowSpec[],
): DashboardSpec {
  if (args === undefined || typeof args['name'] !== 'string' || !DASHBOARD_NAME.test(args['name'])) {
    throw new NightshiftError(
      'CONFIG_INVALID',
      'dashboard.save needs a name like `work-board` (lowercase letters, digits, hyphens).',
    );
  }
  const name = args['name'];
  const title = typeof args['title'] === 'string' ? args['title'] : undefined;
  const theme = typeof args['theme'] === 'string' ? args['theme'] : undefined;
  const refresh = args['refresh'];
  const rowsArg = rowsFromJson(args['rows']);
  const rows = rowsArg ?? existingRows ?? BLANK_DASHBOARD(name, title).rows;

  const draft: DashboardSpec = {
    version: 1,
    name,
    rows,
    ...(title === undefined || title === '' ? {} : { title }),
    ...(theme === undefined || theme === '' ? {} : { theme }),
  };
  if (refresh !== undefined) {
    if (typeof refresh !== 'number' || !Number.isFinite(refresh) || refresh < 0) {
      throw new NightshiftError('CONFIG_INVALID', 'dashboard.save refresh must be a number.');
    }
    draft.refresh = refresh;
  }

  return parseDashboard(serializeDashboard(draft), { source: 'dashboard.save' });
}

/** Turns a command-args blob into a validated VibeSpec. */
function vibeFromArgs(args: Record<string, Json> | undefined): VibeSpec {
  if (args === undefined || typeof args['name'] !== 'string' || !VIBE_NAME.test(args['name'])) {
    throw new NightshiftError(
      'CONFIG_INVALID',
      'vibe.save needs a name like `locked-in` (lowercase letters, digits, hyphens).',
    );
  }
  // Round-trip through serialize/parse so the same rules hand-edited YAML
  // gets applied to the form — one validator, two entry points.
  return parseVibe(serializeVibe(args as unknown as VibeSpec), { source: 'vibe.save' });
}

/** Turns a command-args blob into a validated ThemeSpec. */
function themeFromArgs(args: Record<string, Json> | undefined): ThemeSpec {
  if (args === undefined || typeof args['name'] !== 'string' || !THEME_NAME.test(args['name'])) {
    throw new NightshiftError(
      'CONFIG_INVALID',
      'theme.save needs a name like `forest` (lowercase letters, digits, hyphens).',
    );
  }
  const appearance = args['appearance'];
  if (appearance !== 'dark' && appearance !== 'light') {
    throw new NightshiftError('CONFIG_INVALID', "theme.save appearance must be 'dark' or 'light'.");
  }
  const colorsInput = args['colors'];
  if (!isRecord(colorsInput)) {
    throw new NightshiftError('CONFIG_INVALID', 'theme.save needs a colors object.');
  }
  const draft: ThemeSpec = {
    name: args['name'],
    appearance,
    colors: colorsInput as unknown as ThemeColors,
  };
  return parseTheme(serializeTheme(draft), { source: 'theme.save' });
}

function publishThemesCatalog(
  entities: EntityStore,
  themes: AppRuntime['themes'],
  userThemeNames: ReadonlySet<string>,
): void {
  const activeName = themes.current.name;
  const rows: Json[] = themes.list().map((theme) => ({
    name: theme.name,
    source: userThemeNames.has(theme.name) ? 'user' : 'built-in',
    active: theme.name === activeName,
    appearance: theme.appearance,
    colors: theme.colors as unknown as Json,
  }));
  const state: Json = { themes: rows };
  if (entities.get('nightshift.themes')) {
    entities.set('nightshift.themes', state);
  } else {
    entities.register('nightshift.themes', state, {
      owner: 'nightshift',
      title: 'Registered themes',
    });
  }
}

function publishVibesCatalog(
  entities: EntityStore,
  vibes: VibeEngine,
  userVibeNames: ReadonlySet<string>,
): void {
  const active = entities.get<{ active: string | null }>('nightshift.vibe')?.state.active ?? null;
  const rows: Json[] = vibes.list().map((vibe) => {
    const row: Record<string, Json> = {
      name: vibe.name,
      title: vibe.title ?? vibe.name,
      description: vibe.description ?? '',
      theme: vibe.theme ?? '',
      dashboard: vibe.dashboard ?? '',
      source: userVibeNames.has(vibe.name) ? 'user' : 'built-in',
      active: vibe.name === active,
    };
    if (vibe.entities !== undefined) row['entities'] = vibe.entities;
    if (vibe.onActivate !== undefined) {
      row['onActivate'] = vibe.onActivate.map((action) => {
        const entry: Record<string, Json> = { command: action.command };
        if (action.args !== undefined) entry['args'] = action.args;
        return entry;
      });
    }
    if (vibe.onDeactivate !== undefined) {
      row['onDeactivate'] = vibe.onDeactivate.map((action) => {
        const entry: Record<string, Json> = { command: action.command };
        if (action.args !== undefined) entry['args'] = action.args;
        return entry;
      });
    }
    return row;
  });

  const state: Json = { vibes: rows };
  if (entities.get('nightshift.vibes')) {
    entities.set('nightshift.vibes', state);
  } else {
    entities.register('nightshift.vibes', state, {
      owner: 'nightshift',
      title: 'Registered vibes',
    });
  }
}

function publishDashboardsCatalog(
  entities: EntityStore,
  dashboards: readonly DashboardSpec[],
  userDashboardNames: ReadonlySet<string>,
): void {
  const active =
    entities.get<{ active: string | null }>('nightshift.dashboard')?.state.active ?? null;
  const rows: Json[] = dashboards.map((dashboard) => {
    const row: Record<string, Json> = {
      name: dashboard.name,
      title: dashboard.title ?? dashboard.name,
      source: userDashboardNames.has(dashboard.name) ? 'user' : 'built-in',
      active: dashboard.name === active,
    };
    if (dashboard.theme !== undefined) row['theme'] = dashboard.theme;
    if (dashboard.refresh !== undefined) row['refresh'] = dashboard.refresh;
    row['rows'] = dashboard.rows as unknown as Json;
    return row;
  });
  const state: Json = { dashboards: rows };
  if (entities.get('nightshift.dashboards')) {
    entities.set('nightshift.dashboards', state);
  } else {
    entities.register('nightshift.dashboards', state, {
      owner: 'nightshift',
      title: 'Registered dashboards',
    });
  }
}

export async function createNightshiftRuntime(
  context: CliContext,
  options: CreateRuntimeOptions = {},
): Promise<NightshiftRuntime> {
  const warnings: string[] = [];
  const entities = createEntityStore();

  const foundThemes = await loadThemes(context.paths.themesDir);
  warnings.push(
    ...foundThemes.failed.map(
      (entry) =>
        `${entry.path} could not be read: ${
          entry.error instanceof Error ? entry.error.message : String(entry.error)
        }`,
    ),
  );
  const userThemeNames = new Set(foundThemes.themes.map((theme) => theme.name));

  // Built before the plugins so a notification raised inside `setup` has a
  // toast stack to land in — the shell renders it as soon as it is up.
  const app = createAppRuntime({
    entities,
    themes: createThemeEngine({
      initial: context.config.theme,
      themes: foundThemes.themes,
    }),
    ...(options.onQuit === undefined ? {} : { onQuit: options.onQuit }),
  });

  const registeredThemeCommands = new Set<string>();

  const refreshThemeActivateCommands = (): void => {
    for (const name of registeredThemeCommands) {
      app.commands.unregister(`theme.activate.${name}`);
    }
    registeredThemeCommands.clear();
    for (const theme of app.themes.list()) {
      registeredThemeCommands.add(theme.name);
      app.commands.register({
        id: `theme.activate.${theme.name}`,
        title: `Use the ${theme.name} theme`,
        category: 'Theme',
        run: async () => {
          app.themes.activate(theme.name);
          await saveConfig(
            { ...context.config, theme: theme.name },
            { configDir: context.paths.configDir },
          );
          context.config.theme = theme.name;
          publishThemesCatalog(entities, app.themes, userThemeNames);
        },
      });
    }
  };

  refreshThemeActivateCommands();
  publishThemesCatalog(entities, app.themes, userThemeNames);

  const plugins = createPluginHost({
    entities,
    dataDir: context.paths.dataDir,
    log: context.log.child('plugins'),
    policy: createPermissionPolicy({ grants: context.config.pluginPermissions }),
    // A plugin installed into the config directory wins over one that ships
    // with Nightshift, so a user can replace a bundled plugin without a fork.
    resolveFrom: [join(context.paths.configDir, 'package.json'), import.meta.url],
  });

  // A plugin's own voice: `context.notify` reaches the user through the same
  // toast stack the shell, vibes and automations use, so a plugin never has to
  // draw its own warning line inside a widget to be heard.
  plugins.events.on('notification', (notification) => {
    app.toasts.push(notification.message, {
      tone: notification.tone,
      ...(notification.timeout === undefined ? {} : { timeout: notification.timeout }),
      ...(notification.key === undefined ? {} : { key: notification.key }),
    });
  });

  const sources = await discoverPlugins({
    plugins: context.config.plugins,
    pluginsDir: context.paths.pluginsDir,
  });
  const { loaded, failed } = await plugins.loadAll(sources);
  warnings.push(...failed.map(describe));

  const widgets = createWidgetRegistry(BUILT_IN_WIDGETS);
  for (const plugin of loaded) widgets.registerPlugin(plugin.manifest.id, plugin.widgets);

  const foundDashboards = await loadDashboards(context.paths.dashboardsDir);
  warnings.push(
    ...foundDashboards.failed.map(
      (entry) =>
        `${entry.path} could not be read: ${
          entry.error instanceof Error ? entry.error.message : String(entry.error)
        }`,
    ),
  );

  // A user dashboard replaces the built-in of the same name rather than
  // appearing alongside it.
  let dashboards = mergeDashboards(foundDashboards.dashboards, BUILT_IN_DASHBOARDS);
  const userDashboardNames = new Set(foundDashboards.dashboards.map((dashboard) => dashboard.name));
  const dashboardListeners = new Set<(dashboards: readonly DashboardSpec[]) => void>();

  const syncDashboards = (next: DashboardSpec[]): void => {
    dashboards = next;
    publishDashboardsCatalog(entities, dashboards, userDashboardNames);
    for (const listener of dashboardListeners) listener(dashboards);
  };

  const setActiveDashboard = (name: string): void => {
    const spec = dashboards.find((dashboard) => dashboard.name === name);
    entities.set('nightshift.dashboard', {
      active: name,
      title: spec?.title ?? name,
    });
    publishDashboardsCatalog(entities, dashboards, userDashboardNames);
  };

  // Plugin commands become app commands, so a keybinding, the palette and a
  // vibe all reach them the same way. Tagging each with `source` is what lets
  // the Apps screen show which plugin contributed what, without needing its
  // own channel back to the plugin host.
  for (const plugin of loaded) {
    for (const command of plugin.commands) {
      const [category] = command.id.split('.');
      app.commands.register({
        id: command.id,
        title: command.title,
        run: command.run,
        source: plugin.manifest.id,
        ...(command.hidden === undefined ? {} : { hidden: command.hidden }),
        ...(category === undefined ? {} : { category }),
      });
    }
  }

  // A read-only snapshot of what loaded, for the shell's Apps screen. This is
  // the entity-based bridge described in `packages/ui/src/app/screens.tsx` —
  // the UI package reads it by a well-known id rather than depending on the
  // plugin host directly.
  entities.register(
    'nightshift.plugins',
    {
      plugins: loaded.map((plugin) => ({
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        commands: plugin.commands.length,
        widgets: plugin.widgets.length,
      })),
    },
    { owner: 'nightshift', title: 'Loaded plugins' },
  );

  // Same merge rule as dashboards: a user vibe file replaces a built-in of the
  // same name rather than sitting alongside it.
  const foundVibes = await loadVibes(context.paths.vibesDir);
  warnings.push(
    ...foundVibes.failed.map(
      (entry) =>
        `${entry.path} could not be read: ${
          entry.error instanceof Error ? entry.error.message : String(entry.error)
        }`,
    ),
  );
  const userVibeNames = new Set(foundVibes.vibes.map((vibe) => vibe.name));
  const vibes = createVibeEngine({ themes: app.themes, entities, commands: app.commands });
  const vibeDisposers = new Map<string, () => void>();

  const registerActivateCommand = (vibe: VibeSpec): void => {
    app.commands.register({
      id: `vibe.activate.${vibe.name}`,
      title: `Activate ${vibe.title ?? vibe.name}`,
      category: 'Vibes',
      run: async () => {
        await vibes.activate(vibe.name);
      },
    });
  };

  const installVibe = (vibe: VibeSpec): void => {
    vibeDisposers.get(vibe.name)?.();
    vibeDisposers.set(vibe.name, vibes.register(vibe));
    registerActivateCommand(vibe);
  };

  for (const vibe of BUILT_IN_VIBES.filter((entry) => !userVibeNames.has(entry.name))) {
    installVibe(vibe);
  }
  for (const vibe of foundVibes.vibes) installVibe(vibe);

  publishDashboardsCatalog(entities, dashboards, userDashboardNames);

  entities.register('nightshift.dashboard', { active: null, title: null }, { owner: 'nightshift' });
  publishVibesCatalog(entities, vibes, userVibeNames);

  app.commands.register({
    id: 'dashboard.save',
    title: 'Save dashboard',
    category: 'Dashboard',
    hidden: true,
    run: async (args) => {
      const existing = dashboards.find(
        (dashboard) => dashboard.name === (typeof args?.['name'] === 'string' ? args['name'] : ''),
      );
      const spec = dashboardFromArgs(args, existing?.rows);
      await saveDashboard(context.paths.dashboardsDir, spec);
      userDashboardNames.add(spec.name);
      const exists = dashboards.some((dashboard) => dashboard.name === spec.name);
      const next = exists
        ? dashboards.map((dashboard) => (dashboard.name === spec.name ? spec : dashboard))
        : [...dashboards, spec];
      syncDashboards([...next].sort((a, b) => a.name.localeCompare(b.name)));
      const active =
        entities.get<{ active: string | null }>('nightshift.dashboard')?.state.active ?? null;
      if (active === spec.name) setActiveDashboard(spec.name);
      app.toasts.push(`Saved dashboard "${spec.title ?? spec.name}"`, { tone: 'success' });
    },
  });

  app.commands.register({
    id: 'dashboard.delete',
    title: 'Delete dashboard',
    category: 'Dashboard',
    hidden: true,
    run: async (args) => {
      const name = args?.['name'];
      if (typeof name !== 'string' || !DASHBOARD_NAME.test(name)) {
        throw new NightshiftError(
          'CONFIG_INVALID',
          'dashboard.delete needs a dashboard name like `work-board`.',
        );
      }
      if (!userDashboardNames.has(name)) {
        throw new NightshiftError(
          'CONFIG_INVALID',
          `Built-in dashboard "${name}" cannot be deleted.`,
          { hint: 'Only user dashboard files in your dashboards/ directory can be removed.' },
        );
      }
      const active =
        entities.get<{ active: string | null }>('nightshift.dashboard')?.state.active ?? null;
      await deleteDashboard(context.paths.dashboardsDir, name);
      userDashboardNames.delete(name);
      const loaded = await loadDashboards(context.paths.dashboardsDir);
      const next = mergeDashboards(loaded.dashboards, BUILT_IN_DASHBOARDS);
      syncDashboards(next);
      app.commands.unregister(`dashboard.open.${name}`);
      if (active === name) {
        const fallback =
          (context.config.defaultDashboard &&
          next.some((dashboard) => dashboard.name === context.config.defaultDashboard)
            ? context.config.defaultDashboard
            : undefined) ?? next[0]?.name;
        if (fallback) await app.commands.run(`dashboard.open.${fallback}`);
        else entities.set('nightshift.dashboard', { active: null, title: null });
      }
      app.toasts.push(`Deleted dashboard "${name}"`, { tone: 'success' });
    },
  });

  // The shell's header reads this to show "● locked in" — see `Header.tsx` —
  // and it is the other half of the same entity-bridge convention as
  // `nightshift.plugins` above.
  entities.register('nightshift.vibe', { active: null, title: null }, { owner: 'nightshift' });

  app.commands.register({
    id: 'vibe.save',
    title: 'Save vibe',
    category: 'Vibes',
    hidden: true,
    run: async (args) => {
      const spec = vibeFromArgs(args);
      await saveVibe(context.paths.vibesDir, spec);
      installVibe(spec);
      userVibeNames.add(spec.name);
      publishVibesCatalog(entities, vibes, userVibeNames);
      app.toasts.push(`Saved vibe "${spec.title ?? spec.name}"`, { tone: 'success' });
    },
  });

  app.commands.register({
    id: 'vibe.delete',
    title: 'Delete vibe',
    category: 'Vibes',
    hidden: true,
    run: async (args) => {
      const name = args?.['name'];
      if (typeof name !== 'string' || !VIBE_NAME.test(name)) {
        throw new NightshiftError(
          'CONFIG_INVALID',
          'vibe.delete needs a vibe name like `locked-in`.',
        );
      }
      if (!userVibeNames.has(name)) {
        throw new NightshiftError(
          'CONFIG_INVALID',
          `Built-in vibe "${name}" cannot be deleted.`,
          { hint: 'Only user vibe files in your vibes/ directory can be removed.' },
        );
      }
      const active = entities.get<{ active: string | null }>('nightshift.vibe')?.state.active;
      if (active === name) await vibes.deactivate();
      await deleteVibe(context.paths.vibesDir, name);
      userVibeNames.delete(name);
      vibeDisposers.get(name)?.();
      vibeDisposers.delete(name);
      app.commands.unregister(`vibe.activate.${name}`);
      const builtIn = findVibe(name);
      if (builtIn) installVibe(builtIn);
      publishVibesCatalog(entities, vibes, userVibeNames);
      app.toasts.push(`Deleted vibe "${name}"`, { tone: 'success' });
    },
  });

  app.commands.register({
    id: 'theme.save',
    title: 'Save theme',
    category: 'Theme',
    hidden: true,
    run: async (args) => {
      const spec = themeFromArgs(args);
      await saveTheme(context.paths.themesDir, spec);
      app.themes.register(spec);
      userThemeNames.add(spec.name);
      refreshThemeActivateCommands();
      publishThemesCatalog(entities, app.themes, userThemeNames);
      if (app.themes.current.name === spec.name) {
        app.themes.activate(spec.name);
      }
      app.toasts.push(`Saved theme "${spec.name}"`, { tone: 'success' });
    },
  });

  app.commands.register({
    id: 'theme.delete',
    title: 'Delete theme',
    category: 'Theme',
    hidden: true,
    run: async (args) => {
      const name = args?.['name'];
      if (typeof name !== 'string' || !THEME_NAME.test(name)) {
        throw new NightshiftError(
          'CONFIG_INVALID',
          'theme.delete needs a theme name like `forest`.',
        );
      }
      if (!userThemeNames.has(name)) {
        throw new NightshiftError(
          'CONFIG_INVALID',
          `Built-in theme "${name}" cannot be deleted.`,
          { hint: 'Only user theme files in your themes/ directory can be removed.' },
        );
      }
      const wasActive = app.themes.current.name === name;
      await deleteTheme(context.paths.themesDir, name);
      userThemeNames.delete(name);
      app.themes.unregister(name);
      refreshThemeActivateCommands();
      if (wasActive) {
        const fallback =
          (app.themes.resolve(context.config.theme)?.name === context.config.theme &&
          context.config.theme !== name
            ? context.config.theme
            : undefined) ?? 'midnight';
        app.themes.activate(fallback);
        await saveConfig(
          { ...context.config, theme: fallback },
          { configDir: context.paths.configDir },
        );
        context.config.theme = fallback;
      }
      publishThemesCatalog(entities, app.themes, userThemeNames);
      app.toasts.push(`Deleted theme "${name}"`, { tone: 'success' });
    },
  });

  const automations = createAutomationEngine({ entities, commands: app.commands });
  automations.registerAll(plugins.automations());
  automations.events.on('fired', (result) => {
    for (const warning of result.warnings) app.toasts.push(warning, { tone: 'warning' });
  });

  // A vibe orchestrates the workspace by name; an automation reacts to it the
  // same way it reacts to an entity or a timer, without either package knowing
  // the other exists.
  vibes.events.on('activated', (result) => {
    for (const warning of result.warnings) app.toasts.push(warning, { tone: 'warning' });
    entities.set('nightshift.vibe', {
      active: result.vibe.name,
      title: result.vibe.title ?? result.vibe.name,
    });
    publishVibesCatalog(entities, vibes, userVibeNames);
    automations.notifyVibe(result.vibe.name, 'activate');
  });
  vibes.events.on('deactivated', (name, deactivateWarnings) => {
    for (const warning of deactivateWarnings) app.toasts.push(warning, { tone: 'warning' });
    entities.set('nightshift.vibe', { active: null, title: null });
    publishVibesCatalog(entities, vibes, userVibeNames);
    automations.notifyVibe(name, 'deactivate');
  });

  // A read-only snapshot for the Automations screen, the same convention as
  // `nightshift.plugins`. Automations are all registered by this point, and
  // nothing currently adds one later, so a snapshot is enough — a future
  // dynamic registration path would need this to become a subscription.
  entities.register(
    'nightshift.automations',
    {
      automations: automations.list().map((automation) => ({
        name: automation.name,
        trigger: automation.when.type,
        enabled: automation.enabled !== false,
      })),
    },
    { owner: 'nightshift', title: 'Registered automations' },
  );

  automations.start();

  return {
    app,
    entities,
    plugins,
    widgets,
    get dashboards() {
      return dashboards;
    },
    vibes,
    automations,
    warnings,
    setActiveDashboard,
    subscribeDashboards(listener) {
      dashboardListeners.add(listener);
      return () => dashboardListeners.delete(listener);
    },
    async dispose() {
      automations.stop();
      // The outgoing vibe's onDeactivate actions may reference plugin
      // commands, so this has to run before the plugins that own them unload.
      await vibes.deactivate();
      await plugins.unloadAll();
      app.toasts.dispose();
    },
  };
}
