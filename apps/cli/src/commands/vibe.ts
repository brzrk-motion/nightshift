import { createElement } from 'react';
import { BUILT_IN_DASHBOARDS, DashboardApp } from '@nightshift/dashboard';
import { saveConfig } from '@nightshift/services';
import { detectRuntime, startApp, type CommandRegistry } from '@nightshift/ui';
import { initConfigDirs, type CliContext } from '../context.js';
import { createNightshiftRuntime } from '../runtime.js';
import { createStyle, shouldUseColor } from '../lib/output.js';

/**
 * `DashboardApp` registers its `dashboard.open.<name>` commands from a React
 * effect, which does not run synchronously inside `startApp()`. Without this,
 * activating a vibe right after opening the dashboard would race that effect
 * and report the dashboard "not available" even though it is already showing
 * — a false warning on every single `nightshift vibe` invocation, since the
 * race is the same size every time, not a rare timing fluke.
 */
function waitForCommand(commands: CommandRegistry, id: string, timeoutMs = 2000): Promise<void> {
  if (commands.get(id)) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      off();
      resolve();
    }, timeoutMs);
    const off = commands.events.on('registered', (command) => {
      if (command.id !== id) return;
      clearTimeout(timer);
      off();
      resolve();
    });
  });
}

export interface VibeOptions {
  list?: boolean | undefined;
  /** Records the vibe as the startup default. */
  setDefault?: boolean | undefined;
  color?: boolean | undefined;
  /** Prints what would be activated without taking over the terminal. */
  check?: boolean | undefined;
}

/**
 * `nightshift vibe [name]` — opens the dashboard with a vibe already active.
 *
 * A vibe is not something a headless process can meaningfully "run": its
 * `onActivate` actions are commands like `focus.start`, which only mean
 * anything once a dashboard is open to show the result. So this command opens
 * one — the vibe's own, or the configured default — and activates the vibe
 * right after, the same way switching vibes from the command palette does.
 */
export async function runVibe(
  context: CliContext,
  name: string | undefined,
  options: VibeOptions = {},
): Promise<number> {
  await initConfigDirs(context);
  const style = createStyle(shouldUseColor(options.color));
  const runtime = await createNightshiftRuntime(context);

  try {
    const available = runtime.vibes.list();

    if (options.list || name === undefined) {
      if (context.json) {
        process.stdout.write(
          `${JSON.stringify({ vibes: available, default: context.config.defaultVibe }, null, 2)}\n`,
        );
        return 0;
      }
      const width = available.reduce((max, vibe) => Math.max(max, vibe.name.length), 0);
      const lines = available.map((vibe) => {
        const marker =
          vibe.name === context.config.defaultVibe ? style.accent('●') : style.dim('○');
        const title = vibe.title ?? vibe.name;
        const description = vibe.description ? ` ${style.dim(`— ${vibe.description}`)}` : '';
        return `  ${marker} ${vibe.name.padEnd(width)}  ${title}${description}`;
      });
      process.stdout.write(`\n${lines.join('\n')}\n\n`);
      return 0;
    }

    const target = name;
    const vibe = runtime.vibes.get(target);

    if (!vibe) {
      context.log.error('No such vibe', { vibe: target });
      if (!context.json) {
        process.stderr.write(
          `\n  ${style.danger(`No vibe named "${target}".`)}\n` +
            `  ${style.dim('Available:')} ${available.map((entry) => entry.name).join(', ')}\n\n`,
        );
      }
      return 1;
    }

    if (options.setDefault) {
      await saveConfig(
        { ...context.config, defaultVibe: vibe.name },
        { configDir: context.paths.configDir },
      );
      context.log.info('Default vibe updated', { vibe: vibe.name });
    }

    // A vibe naming a dashboard that does not exist should not sink the whole
    // command — fall back to the configured default and let the activation
    // warning explain why.
    const dashboardNames = new Set(runtime.dashboards.map((dashboard) => dashboard.name));
    const dashboard =
      vibe.dashboard !== undefined && dashboardNames.has(vibe.dashboard)
        ? vibe.dashboard
        : context.config.defaultDashboard;

    if (!context.configExists) {
      await saveConfig(context.config, { configDir: context.paths.configDir });
      context.log.info('Wrote default configuration', { path: context.paths.configFile });
    }

    for (const warning of runtime.warnings) context.log.warn(warning);

    const support = detectRuntime();
    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;
    const canRender = support.ffi && interactive && !context.json && options.check !== true;

    if (context.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            vibe: vibe.name,
            dashboard,
            theme: vibe.theme ?? context.config.theme,
            actions: vibe.onActivate?.length ?? 0,
            warnings: runtime.warnings,
            renderer: { ...support, interactive },
            rendered: false,
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    if (!canRender) {
      const reason = options.check
        ? 'Checked without activating the vibe.'
        : !interactive
          ? 'Nightshift needs an interactive terminal to activate a vibe.'
          : (support.reason ?? 'The terminal renderer is unavailable.');

      process.stdout.write(
        `\n  ${style.bold(vibe.title ?? vibe.name)}\n` +
          (vibe.description ? `  ${style.dim(vibe.description)}\n` : '') +
          '\n' +
          `  ${style.dim('theme:    ')} ${vibe.theme ?? context.config.theme}\n` +
          `  ${style.dim('dashboard:')} ${dashboard}\n` +
          `  ${style.dim('actions:  ')} ${vibe.onActivate?.length ?? 0}\n\n` +
          (options.setDefault ? `  ${style.success('Saved as the default vibe.')}\n` : '') +
          runtime.warnings.map((warning) => `  ${style.warning('!')} ${warning}\n`).join('') +
          `  ${options.check ? style.dim(reason) : style.warning(reason)}\n` +
          (support.hint && !options.check ? `  ${style.dim(support.hint)}\n` : '') +
          '\n',
      );
      return options.check || support.ffi ? 0 : 1;
    }

    context.log.info('Activating vibe', { vibe: vibe.name, dashboard });

    const app = await startApp({
      title: `nightshift · ${vibe.title ?? vibe.name}`,
      render: () =>
        createElement(DashboardApp, {
          runtime: runtime.app,
          dashboards: runtime.dashboards,
          registry: runtime.widgets,
          initial: dashboard,
          dashboardsDir: context.paths.dashboardsDir,
          builtInDashboards: BUILT_IN_DASHBOARDS,
          onboarding: !context.config.onboarded,
          onOnboardingDismissed: () => {
            void saveConfig(
              { ...context.config, onboarded: true },
              { configDir: context.paths.configDir },
            );
          },
        }),
      onExit: () => context.log.info('Dashboard closed'),
    });

    runtime.app.quit = () => void app.stop();

    for (const warning of runtime.warnings) {
      runtime.app.toasts.push(warning, { tone: 'warning', timeout: 8000 });
    }

    // The dashboard named above is already showing, so this is here for the
    // vibe's other effects — the theme, the entity state, `onActivate` — not
    // to open it a second time. Only wait for the command if the vibe names a
    // dashboard that actually exists; otherwise the engine's own warning is
    // the right outcome, and waiting would just delay it.
    if (vibe.dashboard !== undefined && dashboardNames.has(vibe.dashboard)) {
      await waitForCommand(runtime.app.commands, `dashboard.open.${vibe.dashboard}`);
    }
    await runtime.vibes.activate(vibe.name);

    await app.waitUntilExit();
    return 0;
  } finally {
    await runtime.dispose();
  }
}
