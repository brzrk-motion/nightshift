import { readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { BUILT_IN_VIBES, findVibe, type VibeSpec } from '@nightshift/vibes';
import { saveConfig } from '@nightshift/services';
import { initConfigDirs, type CliContext } from '../context.js';
import { createStyle, shouldUseColor } from '../lib/output.js';

export interface VibeOptions {
  list?: boolean | undefined;
  /** Records the vibe as the startup default. */
  setDefault?: boolean | undefined;
  color?: boolean | undefined;
}

/** Built-in vibes plus any YAML files in the config dir. */
export async function listVibes(context: CliContext): Promise<VibeSpec[]> {
  const vibes = new Map<string, VibeSpec>(BUILT_IN_VIBES.map((vibe) => [vibe.name, vibe]));
  try {
    for (const entry of await readdir(context.paths.vibesDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = extname(entry.name);
      if (ext !== '.yaml' && ext !== '.yml') continue;
      const name = entry.name.slice(0, -ext.length);
      // Parsing lands in Phase 4; for now a user file is listed by name only.
      vibes.set(name, vibes.get(name) ?? { name });
    }
  } catch {
    // No vibes directory yet — the built-ins are all there is.
  }
  return [...vibes.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * `nightshift vibe [name]` — activates a vibe. Phase 1 resolves and persists
 * the choice; the engine that applies it lands in Phase 4.
 */
export async function runVibe(
  context: CliContext,
  name: string | undefined,
  options: VibeOptions = {},
): Promise<number> {
  await initConfigDirs(context);
  const available = await listVibes(context);
  const style = createStyle(shouldUseColor(options.color));

  if (options.list || name === undefined) {
    if (context.json) {
      process.stdout.write(
        `${JSON.stringify({ vibes: available, active: context.config.defaultVibe }, null, 2)}\n`,
      );
      return 0;
    }
    const width = available.reduce((max, vibe) => Math.max(max, vibe.name.length), 0);
    const lines = available.map((vibe) => {
      const marker = vibe.name === context.config.defaultVibe ? style.accent('●') : style.dim('○');
      const title = vibe.title ?? vibe.name;
      const description = vibe.description ? ` ${style.dim(`— ${vibe.description}`)}` : '';
      return `  ${marker} ${vibe.name.padEnd(width)}  ${title}${description}`;
    });
    process.stdout.write(`\n${lines.join('\n')}\n\n`);
    return 0;
  }

  const vibe = available.find((entry) => entry.name === name) ?? findVibe(name);
  if (!vibe) {
    context.log.error('No such vibe', { vibe: name });
    if (!context.json) {
      process.stderr.write(
        `\n  ${style.danger(`No vibe named "${name}".`)}\n` +
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

  context.log.info('Activating vibe', { vibe: vibe.name });

  if (context.json) {
    process.stdout.write(
      `${JSON.stringify({ vibe, activated: false, phase: 'Phase 4' }, null, 2)}\n`,
    );
    return 0;
  }

  process.stdout.write(
    `\n  ${style.bold(vibe.title ?? vibe.name)}\n` +
      (vibe.description ? `  ${style.dim(vibe.description)}\n` : '') +
      '\n' +
      `  ${style.dim('theme:    ')} ${vibe.theme ?? context.config.theme}\n` +
      `  ${style.dim('dashboard:')} ${vibe.dashboard ?? context.config.defaultDashboard}\n` +
      `  ${style.dim('actions:  ')} ${vibe.onActivate?.length ?? 0}\n\n` +
      (options.setDefault ? `  ${style.success('Saved as the default vibe.')}\n` : '') +
      `  ${style.warning('The vibe engine lands in Phase 4.')}\n\n`,
  );
  return 0;
}
