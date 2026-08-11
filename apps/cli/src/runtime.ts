import { join } from 'node:path';
import { createEntityStore, type EntityStore } from '@nightshift/entities';
import {
  createPermissionPolicy,
  createPluginHost,
  discoverPlugins,
  type PluginFailure,
  type PluginHost,
} from '@nightshift/services';
import {
  BUILT_IN_DASHBOARDS,
  BUILT_IN_WIDGETS,
  createWidgetRegistry,
  loadDashboards,
  mergeDashboards,
  type DashboardSpec,
  type WidgetRegistry,
} from '@nightshift/dashboard';
import { createAutomationEngine, type AutomationEngine } from '@nightshift/automations';
import { BUILT_IN_VIBES, createVibeEngine, loadVibes, type VibeEngine } from '@nightshift/vibes';
import { createAppRuntime, type AppRuntime } from '@nightshift/ui';
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

export async function createNightshiftRuntime(
  context: CliContext,
  options: CreateRuntimeOptions = {},
): Promise<NightshiftRuntime> {
  const warnings: string[] = [];
  const entities = createEntityStore();

  // Built before the plugins so a notification raised inside `setup` has a
  // toast stack to land in — the shell renders it as soon as it is up.
  const app = createAppRuntime({
    entities,
    theme: context.config.theme,
    ...(options.onQuit === undefined ? {} : { onQuit: options.onQuit }),
  });

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
  const dashboards = mergeDashboards(foundDashboards.dashboards, BUILT_IN_DASHBOARDS);

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
  vibes.registerAll([
    ...BUILT_IN_VIBES.filter((vibe) => !userVibeNames.has(vibe.name)),
    ...foundVibes.vibes,
  ]);

  // One command per vibe, the same way DashboardApp gives one command per
  // dashboard — this is what makes a vibe reachable from the palette, not
  // just from `nightshift vibe <name>` at boot.
  for (const vibe of vibes.list()) {
    app.commands.register({
      id: `vibe.activate.${vibe.name}`,
      title: `Activate ${vibe.title ?? vibe.name}`,
      category: 'Vibes',
      run: async () => {
        await vibes.activate(vibe.name);
      },
    });
  }

  // The shell's header reads this to show "● locked in" — see `Header.tsx` —
  // and it is the other half of the same entity-bridge convention as
  // `nightshift.plugins` above.
  entities.register('nightshift.vibe', { active: null, title: null }, { owner: 'nightshift' });

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
    automations.notifyVibe(result.vibe.name, 'activate');
  });
  vibes.events.on('deactivated', (name, deactivateWarnings) => {
    for (const warning of deactivateWarnings) app.toasts.push(warning, { tone: 'warning' });
    entities.set('nightshift.vibe', { active: null, title: null });
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
    dashboards,
    vibes,
    automations,
    warnings,
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
