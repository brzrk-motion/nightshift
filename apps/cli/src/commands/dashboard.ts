import { createElement } from 'react';
import { BUILT_IN_DASHBOARDS, DashboardApp } from '@nightshift/dashboard';
import { saveConfig } from '@nightshift/services';
import { detectRuntime, startApp } from '@nightshift/ui';
import { initConfigDirs, type CliContext } from '../context.js';
import { createNightshiftRuntime } from '../runtime.js';
import { createStyle, shouldUseColor } from '../lib/output.js';
import { attachLogToasts } from '../lib/toastLog.js';

export interface DashboardOptions {
  list?: boolean | undefined;
  color?: boolean | undefined;
  /** Prints what would be opened instead of taking over the terminal. */
  check?: boolean | undefined;
}

/** Dashboards available: the built-in one plus any YAML files in the config dir. */
export async function listDashboards(context: CliContext): Promise<string[]> {
  const runtime = await createNightshiftRuntime(context);
  try {
    return runtime.dashboards.map((dashboard) => dashboard.name);
  } finally {
    await runtime.dispose();
  }
}

/**
 * `nightshift dashboard [name]` — opens a dashboard.
 *
 * The terminal UI needs an interactive terminal and a runtime with FFI. When
 * either is missing the command still does something useful: it reports what
 * it *would* have opened, and why it could not.
 */
export async function runDashboard(
  context: CliContext,
  name: string | undefined,
  options: DashboardOptions = {},
): Promise<number> {
  await initConfigDirs(context);
  const style = createStyle(shouldUseColor(options.color));
  const runtime = await createNightshiftRuntime(context);
  let detachLog: (() => void) | undefined;

  try {
    const available = runtime.dashboards.map((dashboard) => dashboard.name);

    if (options.list) {
      if (context.json) {
        process.stdout.write(
          `${JSON.stringify({ dashboards: available, default: context.config.defaultDashboard }, null, 2)}\n`,
        );
        return 0;
      }
      process.stdout.write(
        `\n${available
          .map((entry) =>
            entry === context.config.defaultDashboard
              ? `  ${style.accent('●')} ${entry} ${style.dim('(default)')}`
              : `  ${style.dim('○')} ${entry}`,
          )
          .join('\n')}\n\n`,
      );
      return 0;
    }

    const target = name ?? context.config.defaultDashboard;

    if (!available.includes(target)) {
      context.log.error('No such dashboard', { dashboard: target });
      if (!context.json) {
        process.stderr.write(
          `\n  ${style.danger(`No dashboard named "${target}".`)}\n` +
            `  ${style.dim('Available:')} ${available.join(', ')}\n\n`,
        );
      }
      return 1;
    }

    // Persist the config on first run so the user has a file to edit.
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
            dashboard: target,
            dashboards: available,
            widgets: runtime.widgets.list().map((widget) => widget.type),
            plugins: runtime.plugins.list().map((plugin) => plugin.manifest.id),
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
        ? 'Checked without opening the dashboard.'
        : !interactive
          ? 'Nightshift needs an interactive terminal to draw a dashboard.'
          : (support.reason ?? 'The terminal renderer is unavailable.');

      process.stdout.write(
        `\n  ${style.bold(`Dashboard "${target}"`)}\n` +
          `  ${style.dim('config: ')} ${context.paths.configFile}\n` +
          `  ${style.dim('theme:  ')} ${context.config.theme}\n` +
          `  ${style.dim('widgets:')} ${runtime.widgets.list().length}\n` +
          `  ${style.dim('plugins:')} ${runtime.plugins.list().length}\n\n` +
          runtime.warnings.map((warning) => `  ${style.warning('!')} ${warning}\n`).join('') +
          `  ${options.check ? style.dim(reason) : style.warning(reason)}\n` +
          (support.hint && !options.check ? `  ${style.dim(support.hint)}\n` : '') +
          '\n',
      );
      return options.check || support.ffi ? 0 : 1;
    }

    context.log.info('Opening dashboard', { dashboard: target });

    // From here the renderer owns the terminal: log lines go to the file, and
    // the ones a user needs to see come back as toasts.
    detachLog = attachLogToasts({ log: context.log, toasts: runtime.app.toasts });

    const app = await startApp({
      title: `nightshift · ${target}`,
      render: () =>
        createElement(DashboardApp, {
          runtime: runtime.app,
          dashboards: runtime.dashboards,
          registry: runtime.widgets,
          initial: target,
          onSwitch: (next: string) => context.log.debug('Dashboard switched', { dashboard: next }),
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

    // `quit` is what every exit path goes through — the command, the
    // keybinding and Ctrl+C alike — so shutdown happens exactly once.
    runtime.app.quit = () => void app.stop();

    for (const warning of runtime.warnings) {
      runtime.app.toasts.push(warning, { tone: 'warning', timeout: 8000 });
    }

    await app.waitUntilExit();
    return 0;
  } finally {
    detachLog?.();
    await runtime.dispose();
  }
}
