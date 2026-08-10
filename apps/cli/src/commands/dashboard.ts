import { readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { DEFAULT_DASHBOARD } from '@nightshift/dashboard';
import { saveConfig } from '@nightshift/services';
import { initConfigDirs, type CliContext } from '../context.js';
import { createStyle, shouldUseColor } from '../lib/output.js';

export interface DashboardOptions {
  list?: boolean | undefined;
  color?: boolean | undefined;
}

/** Dashboards available: the built-in one plus any YAML files in the config dir. */
export async function listDashboards(context: CliContext): Promise<string[]> {
  const names = new Set<string>([DEFAULT_DASHBOARD.name]);
  try {
    for (const entry of await readdir(context.paths.dashboardsDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = extname(entry.name);
      if (ext === '.yaml' || ext === '.yml') {
        names.add(entry.name.slice(0, -ext.length));
      }
    }
  } catch {
    // No dashboards directory yet — the built-in dashboard is all there is.
  }
  return [...names].sort();
}

/**
 * `nightshift dashboard [name]` — opens a dashboard. Phase 1 sets up the
 * config tree and reports what would be opened; the renderer arrives with the
 * application shell in Phase 2 and the dashboard engine in Phase 3.
 */
export async function runDashboard(
  context: CliContext,
  name: string | undefined,
  options: DashboardOptions = {},
): Promise<number> {
  await initConfigDirs(context);
  const available = await listDashboards(context);
  const style = createStyle(shouldUseColor(options.color));

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

  context.log.info('Opening dashboard', { dashboard: target });

  if (context.json) {
    process.stdout.write(
      `${JSON.stringify({ dashboard: target, rendered: false, phase: 'Phase 3' }, null, 2)}\n`,
    );
    return 0;
  }

  process.stdout.write(
    `\n  ${style.bold(`Dashboard "${target}"`)}\n` +
      `  ${style.dim('Config:')} ${context.paths.configFile}\n` +
      `  ${style.dim('Theme: ')} ${context.config.theme}\n\n` +
      `  ${style.warning('The terminal renderer lands in Phase 2–3.')}\n` +
      `  ${style.dim('Run `nightshift doctor` to verify the rest of your setup.')}\n\n`,
  );
  return 0;
}
