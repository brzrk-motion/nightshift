import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { NightshiftError, type NightshiftErrorCode } from './errors.js';

/** File extensions treated as YAML resources in a config directory. */
export const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

export interface YamlDirLoadResult<T> {
  items: T[];
  /** Files that failed to parse, so the app can report them and carry on. */
  failed: { path: string; error: unknown }[];
}

/**
 * Loads every YAML file in a directory. A broken file is reported rather than
 * thrown, so one bad resource does not hide the rest. Missing directories
 * return an empty result.
 */
export async function loadYamlDir<T>(
  directory: string,
  loadFile: (path: string) => Promise<T>,
): Promise<YamlDirLoadResult<T>> {
  const result: YamlDirLoadResult<T> = { items: [], failed: [] };

  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch {
    return result;
  }

  for (const entry of entries.sort()) {
    if (!YAML_EXTENSIONS.has(extname(entry))) continue;
    const path = join(directory, entry);
    try {
      result.items.push(await loadFile(path));
    } catch (error) {
      result.failed.push({ path, error });
    }
  }

  return result;
}

/**
 * Writes a YAML resource to `<directory>/<name>.yaml`, creating the directory
 * if needed.
 */
export async function saveYamlResource(
  directory: string,
  name: string,
  content: string,
): Promise<string> {
  const path = join(directory, `${name}.yaml`);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path, content, 'utf8');
  } catch (error) {
    throw new NightshiftError('CONFIG_UNWRITABLE', `Could not write ${path}.`, { cause: error });
  }
  return path;
}

export interface DeleteYamlResourceOptions {
  notFoundCode: NightshiftErrorCode;
  notFoundMessage: (path: string) => string;
  notFoundHint: string;
}

/** Removes `<directory>/<name>.yaml`. Refused when the file does not exist. */
export async function deleteYamlResource(
  directory: string,
  name: string,
  options: DeleteYamlResourceOptions,
): Promise<void> {
  const path = join(directory, `${name}.yaml`);
  try {
    await unlink(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new NightshiftError(options.notFoundCode, options.notFoundMessage(path), {
        hint: options.notFoundHint,
      });
    }
    throw new NightshiftError('CONFIG_UNWRITABLE', `Could not delete ${path}.`, { cause: error });
  }
}
