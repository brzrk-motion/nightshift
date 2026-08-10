import { access, constants, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { NIGHTSHIFT_VERSION } from '@nightshift/core';
import { BUILT_IN_DASHBOARDS, loadDashboards, mergeDashboards } from '@nightshift/dashboard';
import { discoverPlugins } from '@nightshift/services';
import { detectRuntime, getTheme } from '@nightshift/ui';
import { BUILT_IN_VIBES, loadVibes } from '@nightshift/vibes';
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

async function checkVibes(context: CliContext): Promise<Check> {
  const { vibes, failed } = await loadVibes(context.paths.vibesDir);
  const names = new Set([
    ...BUILT_IN_VIBES.map((vibe) => vibe.name),
    ...vibes.map((vibe) => vibe.name),
  ]);
  const detail = `${names.size} available`;

  const { defaultVibe } = context.config;
  if (defaultVibe !== null && !names.has(defaultVibe)) {
    return {
      name: 'vibes',
      status: 'warn',
      detail: `${detail}, default "${defaultVibe}" not found`,
      hint: 'Run `nightshift vibe --list` to see what is available.',
    };
  }

  if (failed.length === 0) return { name: 'vibes', status: 'ok', detail };
  return {
    name: 'vibes',
    status: 'warn',
    detail: `${detail}, ${failed.length} unreadable`,
    hint: failed
      .map((entry) => `${entry.path}: ${entry.error instanceof Error ? entry.error.message : ''}`)
      .join('; '),
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
  // Discovery only reads the filesystem; nothing is imported, so a broken
  // plugin cannot make `doctor` fail the way it would make startup fail.
  const sources = await discoverPlugins({
    plugins: context.config.plugins,
    pluginsDir: context.paths.pluginsDir,
  });
  const local = sources.filter((source) => source.origin === 'local').length;

  return {
    name: 'plugins',
    status: 'ok',
    detail:
      sources.length === 0
        ? 'none found'
        : `${sources.length} found${local > 0 ? ` (${local} local)` : ''}`,
  };
}

/** Whether the terminal UI can run here at all. */
function checkRenderer(): Check {
  const support = detectRuntime();
  if (support.ffi) {
    return { name: 'renderer', status: 'ok', detail: `${support.runtime} ${support.version}` };
  }
  return {
    name: 'renderer',
    status: 'warn',
    detail: support.reason ?? `${support.runtime} ${support.version}`,
    ...(support.hint === undefined ? {} : { hint: support.hint }),
  };
}

async function checkDashboards(context: CliContext): Promise<Check> {
  const { dashboards, failed } = await loadDashboards(context.paths.dashboardsDir);
  const detail = `${mergeDashboards(dashboards, BUILT_IN_DASHBOARDS).length} available`;

  if (failed.length === 0) return { name: 'dashboards', status: 'ok', detail };
  return {
    name: 'dashboards',
    status: 'warn',
    detail: `${detail}, ${failed.length} unreadable`,
    hint: failed
      .map((entry) => `${entry.path}: ${entry.error instanceof Error ? entry.error.message : ''}`)
      .join('; '),
  };
}

/** Whether the environment says it can render Unicode box-drawing and glyph
 * characters — the terminal itself cannot be asked directly, so this reads
 * the same locale signal every other line-mode tool relies on. */
function detectUnicodeSupport(): boolean {
  const locale = process.env['LC_ALL'] ?? process.env['LC_CTYPE'] ?? process.env['LANG'] ?? '';
  return /utf-?8/i.test(locale);
}

function detectColorDepth(): 'none' | 'basic' | 'truecolor' {
  if (!shouldUseColor()) return 'none';
  return /truecolor|24bit/i.test(process.env['COLORTERM'] ?? '') ? 'truecolor' : 'basic';
}

/** Nightshift draws with box-drawing borders and coloured text; a terminal
 * missing either still runs, just less legibly, so this only ever warns. */
function checkCapabilities(): Check {
  const unicode = detectUnicodeSupport();
  const color = detectColorDepth();
  const detail = `unicode ${unicode ? 'yes' : 'no'}, colour ${color}`;

  if (!unicode) {
    return {
      name: 'capabilities',
      status: 'warn',
      detail,
      hint: 'No UTF-8 locale detected (LANG/LC_ALL/LC_CTYPE). Borders and icons may not render correctly.',
    };
  }
  if (color === 'none') {
    return {
      name: 'capabilities',
      status: 'warn',
      detail,
      hint: 'Colour is disabled (NO_COLOR set, or not a colour terminal). Nightshift will draw in monochrome.',
    };
  }
  return { name: 'capabilities', status: 'ok', detail };
}

function worst(checks: Check[]): CheckStatus {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'ok';
}

export async function collectReport(context: CliContext): Promise<DoctorReport> {
  const checks: Check[] = [
    await checkNode(),
    checkRenderer(),
    await checkTerminal(),
    checkCapabilities(),
    await checkConfigDir(context),
    await checkConfigFile(context),
    await checkLogDir(context),
    checkTheme(context),
    await checkVibes(context),
    await checkDashboards(context),
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
