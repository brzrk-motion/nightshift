import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Finding plugins. Two sources: the `plugins` list in `config.json`, which
 * names packages or paths, and the config directory's `plugins/` folder, where
 * a plugin can simply be dropped in. Config comes first so an entry there can
 * pin a specific build of something also present locally.
 */
export type PluginOrigin = 'config' | 'local';

export interface PluginSource {
  /** Best guess at the plugin id, used before the manifest is read. */
  id: string;
  /** What `import()` will be given. */
  specifier: string;
  origin: PluginOrigin;
}

/** Entry files tried when a local plugin directory has no package.json. */
const ENTRY_FILES = ['index.js', 'index.mjs', 'dist/index.js'];

function idFromSpecifier(specifier: string): string {
  const name = specifier.split(/[\\/]/).pop() ?? specifier;
  return name.replace(/^@[^/]+\//, '').replace(/^nightshift-plugin-/, '');
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Resolves a local plugin directory to the module that should be imported. */
async function resolveDirectory(directory: string): Promise<string | undefined> {
  try {
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      main?: string;
      module?: string;
      exports?: unknown;
    };
    const entry = manifest.module ?? manifest.main;
    // With `exports` and no `main`, importing the directory is what Node
    // expects; it will resolve the entry point itself.
    if (entry === undefined) return manifest.exports === undefined ? undefined : directory;
    const path = join(directory, entry);
    return (await exists(path)) ? path : undefined;
  } catch {
    for (const candidate of ENTRY_FILES) {
      const path = join(directory, candidate);
      if (await exists(path)) return path;
    }
    return undefined;
  }
}

export interface DiscoverOptions {
  /** The `plugins` list from configuration. */
  plugins?: readonly string[];
  /** Directory scanned for locally installed plugins. */
  pluginsDir?: string | undefined;
  /** Resolves relative paths in the config list. Defaults to the cwd. */
  cwd?: string;
}

/**
 * Lists the plugins Nightshift should try to load, in load order. Nothing is
 * imported here — discovery only decides *what* to load, so a broken plugin
 * cannot break the list of plugins.
 */
export async function discoverPlugins(options: DiscoverOptions = {}): Promise<PluginSource[]> {
  const found: PluginSource[] = [];
  const seen = new Set<string>();
  const cwd = options.cwd ?? process.cwd();

  for (const entry of options.plugins ?? []) {
    // A bare package name is left for Node to resolve; anything that looks
    // like a path is made absolute first so the cwd cannot change the meaning.
    const looksLikePath = entry.startsWith('.') || isAbsolute(entry);
    const specifier = looksLikePath ? pathToFileURL(resolve(cwd, entry)).href : entry;
    const id = idFromSpecifier(entry);
    if (seen.has(id)) continue;
    seen.add(id);
    found.push({ id, specifier, origin: 'config' });
  }

  if (options.pluginsDir !== undefined) {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(options.pluginsDir, { withFileTypes: true });
    } catch {
      // No plugins directory is the normal case, not an error.
      entries = [];
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(options.pluginsDir, entry.name);
      const module = entry.isDirectory()
        ? await resolveDirectory(path)
        : /\.m?js$/.test(entry.name)
          ? path
          : undefined;
      if (module === undefined) continue;

      const id = idFromSpecifier(entry.name.replace(/\.m?js$/, ''));
      if (seen.has(id)) continue;
      seen.add(id);
      found.push({ id, specifier: pathToFileURL(module).href, origin: 'local' });
    }
  }

  return found;
}
