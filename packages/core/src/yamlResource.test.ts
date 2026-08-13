import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NightshiftError } from './errors.js';
import { deleteYamlResource, loadYamlDir, saveYamlResource } from './yamlResource.js';

describe('saveYamlResource', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-yaml-save-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes to <directory>/<name>.yaml', async () => {
    const path = await saveYamlResource(dir, 'focus', 'name: focus\n');

    expect(path).toBe(join(dir, 'focus.yaml'));
    expect(await readFile(path, 'utf8')).toBe('name: focus\n');
  });

  it('creates the directory if it does not exist yet', async () => {
    const nested = join(dir, 'nested');
    await saveYamlResource(nested, 'focus', 'name: focus\n');

    expect(await readFile(join(nested, 'focus.yaml'), 'utf8')).toBe('name: focus\n');
  });
});

describe('deleteYamlResource', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-yaml-delete-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const options = {
    notFoundCode: 'DASHBOARD_NOT_FOUND' as const,
    notFoundMessage: (path: string) => `No user file at ${path}.`,
    notFoundHint: 'Built-ins cannot be deleted.',
  };

  it('deletes an existing file', async () => {
    await saveYamlResource(dir, 'focus', 'name: focus\n');
    await deleteYamlResource(dir, 'focus', options);
    await expect(readFile(join(dir, 'focus.yaml'), 'utf8')).rejects.toThrow();
  });

  it('errors when the file is missing', async () => {
    await expect(deleteYamlResource(dir, 'nope', options)).rejects.toThrowError(/No user file/);
  });
});

describe('loadYamlDir', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-yaml-load-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads every YAML file via the callback', async () => {
    await writeFile(join(dir, 'work.yaml'), 'work');
    await writeFile(join(dir, 'night.yml'), 'night');
    await writeFile(join(dir, 'notes.md'), 'ignore me');

    const { items, failed } = await loadYamlDir(dir, async (path) => path);

    expect(items).toEqual([join(dir, 'night.yml'), join(dir, 'work.yaml')]);
    expect(failed).toEqual([]);
  });

  it('reports a broken file instead of hiding the rest', async () => {
    await writeFile(join(dir, 'good.yaml'), 'good');
    await writeFile(join(dir, 'bad.yaml'), 'bad');

    const { items, failed } = await loadYamlDir(dir, async (path) => {
      if (path.endsWith('bad.yaml')) throw new NightshiftError('CONFIG_INVALID', 'bad file');
      return path;
    });

    expect(items).toEqual([join(dir, 'good.yaml')]);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.path).toBe(join(dir, 'bad.yaml'));
  });

  it('is quiet about a directory that does not exist', async () => {
    await expect(loadYamlDir(join(dir, 'nope'), async (path) => path)).resolves.toEqual({
      items: [],
      failed: [],
    });
  });
});
