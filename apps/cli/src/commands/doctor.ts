import { access, constants, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NIGHTSHIFT_VERSION } from '@nightshift/core';
import { getTheme } from '@nightshift/ui';
import { findVibe } from '@nightshift/vibes';
import type { CliContext } from '../context.js';
import { createStyle, renderPairs, shouldUseColor, type Style } from '../lib/output.js';

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
  /** What to do about it, when the check did not pass. */
  hint?: string;
}

export interface DoctorReport {
  version: string;
  node: string;
  platform: string;
  configDir: string;
  checks: Check[];
  /** Worst status across all checks. */
  status: CheckStatus;
}

const MIN_NODE_MAJOR = 22;

async function isWritable(dir: string): Promise<boolean> {
  const probe = join(dir, `.nightshift-write-probe-${process.pid}`);
  try {
    await mkdir(dir, { recursive: true });
    await mkdir(probe);
    await rm(probe, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function checkNode(): Promise<Check> {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (major >= MIN_NODE_MAJOR) {
    return { name: 'node', status: 'ok', detail: `v${process.versions.node}` };
  }
  return {
    name: 'node',
    status: 'fail',
    detail: `v${process.versions.node}`,
    hint: `Nightshift needs Node ${MIN_NODE_MAJOR} or newer.`,
  };
}

async function checkConfigDir(context: CliContext): Promise<Check> {
  const { configDir } = context.paths;
  if (await isWritable(configDir)) {
    return { name: 'config directory', status: 'ok', detail: configDir };
  }
  return {
    name: 'config directory',
    status: 'fail',
    detail: configDir,
    hint: 'The directory is not writable. Check its permissions or set NIGHTSHIFT_CONFIG_DIR.',
  };
}

async function checkConfigFile(context: CliContext): Promise<Check> {
  if (!context.configExists) {
    return {
      name: 'config file',
      status: 'warn',
      detail: `${context.paths.configFile} (not created yet)`,
      hint: 'Run `nightshift dashboard` once, or write the file yourself; defaults are in use.',
    };
  }
  try {
    await access(context.paths.configFile, constants.R_OK | constants.W_OK);
    return { name: 'config file', status: 'ok', detail: context.paths.configFile };
  } catch {
    return {
      name: 'config file',
      status: 'warn',
      detail: context.paths.configFile,
      hint: 'The file exists but is not readable and writable.',
    };
  }
}

async function checkLogDir(context: CliContext): Promise<Check> {
  if (await isWritable(context.paths.logDir)) {
    return { name: 'log directory', status: 'ok', detail: context.paths.logDir };
  }
  return {
    name: 'log directory',
    status: 'warn',
    detail: context.paths.logDir,
    hint: 'Logs will only go to the terminal.',
  };
}

function checkTheme(context: CliContext): Check {
  const theme = getTheme(context.config.theme);
  return theme
    ? { name: 'theme', status: 'ok', detail: theme.name }
    : {
        name: 'theme',
        status: 'warn',
        detail: context.config.theme,
        hint: 'No such built-in theme; the default will be used.',
      };
}

function checkDefaultVibe(context: CliContext): Check {
  const { defaultVibe } = context.config;
  if (defaultVibe === null) {
    return { name: 'default vibe', status: 'ok', detail: 'none' };
  }
  return findVibe(defaultVibe)
    ? { name: 'default vibe', status: 'ok', detail: defaultVibe }
    : {
        name: 'default vibe',
        status: 'warn',
        detail: defaultVibe,
        hint: 'No vibe by that name. Run `nightshift vibe --list` to see what is available.',
      };
}

async function checkTerminal(): Promise<Check> {
  if (process.stdout.isTTY !== true) {
    return {
      name: 'terminal',
      status: 'warn',
      detail: 'not a TTY',
      hint: 'The dashboard needs an interactive terminal. Other commands work fine.',
    };
  }
  const columns = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;
  if (columns < 60 || rows < 16) {
    return {
      name: 'terminal',
      status: 'warn',
      detail: `${columns}x${rows}`,
      hint: 'Nightshift is designed for at least 60x16.',
    };
  }
  return { name: 'terminal', status: 'ok', detail: `${columns}x${rows}` };
}

async function checkPlugins(context: CliContext): Promise<Check> {
  const count = context.config.plugins.length;
  let local = 0;
  try {
    const info = await stat(context.paths.pluginsDir);
    if (info.isDirectory()) local = 1;
  } catch {
    local = 0;
  }
  return {
    name: 'plugins',
    status: 'ok',
    detail: `${count} configured${local ? `, local dir present` : ''}`,
  };
}

function worst(checks: Check[]): CheckStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'ok';
}

export async function collectReport(context: CliContext): Promise<DoctorReport> {
  const checks: Check[] = [
    await checkNode(),
    await checkTerminal(),
    await checkConfigDir(context),
    await checkConfigFile(context),
    await checkLogDir(context),
    checkTheme(context),
    checkDefaultVibe(context),
    await checkPlugins(context),
  ];

  return {
    version: NIGHTSHIFT_VERSION,
    node: process.versions.node,
    platform: `${process.platform}-${process.arch}`,
    configDir: context.paths.configDir,
    checks,
    status: worst(checks),
  };
}

function symbol(status: CheckStatus, style: Style): string {
  if (status === 'ok') return style.success('✔');
  if (status === 'warn') return style.warning('!');
  return style.danger('✖');
}

/**
 * `nightshift doctor` — the first thing to run when something is off. Exits
 * non-zero on a hard failure so it is usable in scripts and in CI.
 */
export async function runDoctor(
  context: CliContext,
  options: { color?: boolean } = {},
): Promise<number> {
  const report = await collectReport(context);

  if (context.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === 'fail' ? 1 : 0;
  }

  const style = createStyle(shouldUseColor(options.color));
  const lines: string[] = [
    '',
    `${style.bold('Nightshift')} ${style.dim(`v${report.version}`)}`,
    renderPairs(
      [
        ['node', report.node],
        ['platform', report.platform],
        ['config', report.configDir],
      ],
      style,
    ),
    '',
  ];

  for (const check of report.checks) {
    lines.push(
      `  ${symbol(check.status, style)} ${check.name.padEnd(18)} ${style.dim(check.detail)}`,
    );
    if (check.hint) lines.push(`      ${style.dim('→')} ${check.hint}`);
  }

  lines.push('');
  if (report.status === 'ok') {
    lines.push(`  ${style.success('Everything checks out.')}`);
  } else if (report.status === 'warn') {
    lines.push(`  ${style.warning('Usable, with warnings above.')}`);
  } else {
    lines.push(`  ${style.danger('Nightshift cannot start until the failures above are fixed.')}`);
  }
  lines.push('');

  process.stdout.write(`${lines.join('\n')}\n`);
  return report.status === 'fail' ? 1 : 0;
}
