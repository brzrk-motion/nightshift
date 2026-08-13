import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverPlugins } from './discovery.js';
import { createPermissionPolicy, AUTO_GRANTED, SENSITIVE } from './permissions.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nightshift-discovery-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('discoverPlugins', () => {
  it('finds nothing when there is nothing to find', async () => {
    expect(await discoverPlugins()).toEqual([]);
  });

  it('passes a bare package name through for Node to resolve', async () => {
    const [found] = await discoverPlugins({ plugins: ['@nightshift/plugin-pomodoro'] });

    expect(found).toEqual({
      id: 'plugin-pomodoro',
      specifier: '@nightshift/plugin-pomodoro',
      origin: 'config',
    });
  });

  it('turns a relative path into an absolute file URL', async () => {
    const [found] = await discoverPlugins({ plugins: ['./plugins/mine.js'], cwd: dir });

    expect(found?.specifier).toBe(pathToFileURL(join(dir, 'plugins', 'mine.js')).href);
    expect(found?.id).toBe('mine.js');
  });

  it('ignores a duplicate entry', async () => {
    const found = await discoverPlugins({ plugins: ['focus', 'focus'] });
    expect(found).toHaveLength(1);
  });

  it('finds a bare module file in the plugins directory', async () => {
    await writeFile(join(dir, 'timer.mjs'), 'export default {};');
    await writeFile(join(dir, 'notes.txt'), 'ignore me');

    const found = await discoverPlugins({ pluginsDir: dir });

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 'timer', origin: 'local' });
    expect(fileURLToPath(found[0]!.specifier)).toBe(join(dir, 'timer.mjs'));
  });

  it('resolves a plugin directory through its package.json', async () => {
    const plugin = join(dir, 'spotify');
    await mkdir(join(plugin, 'dist'), { recursive: true });
    await writeFile(join(plugin, 'package.json'), JSON.stringify({ main: 'dist/index.js' }));
    await writeFile(join(plugin, 'dist', 'index.js'), 'export default {};');

    const [found] = await discoverPlugins({ pluginsDir: dir });

    expect(found?.id).toBe('spotify');
    expect(fileURLToPath(found!.specifier)).toBe(join(plugin, 'dist', 'index.js'));
  });

  it('falls back to a conventional entry file', async () => {
    const plugin = join(dir, 'weather');
    await mkdir(plugin, { recursive: true });
    await writeFile(join(plugin, 'index.js'), 'export default {};');

    const [found] = await discoverPlugins({ pluginsDir: dir });

    expect(fileURLToPath(found!.specifier)).toBe(join(plugin, 'index.js'));
  });

  it('skips a directory with nothing to import', async () => {
    await mkdir(join(dir, 'empty'), { recursive: true });
    expect(await discoverPlugins({ pluginsDir: dir })).toEqual([]);
  });

  it('strips the nightshift-plugin- prefix from an id', async () => {
    await writeFile(join(dir, 'nightshift-plugin-timer.js'), 'export default {};');
    const [found] = await discoverPlugins({ pluginsDir: dir });
    expect(found?.id).toBe('timer');
  });

  it('lets a configured plugin win over a local one with the same id', async () => {
    await writeFile(join(dir, 'focus.js'), 'export default {};');

    const found = await discoverPlugins({ plugins: ['focus'], pluginsDir: dir });

    expect(found).toHaveLength(1);
    expect(found[0]?.origin).toBe('config');
  });

  it('is quiet about a plugins directory that does not exist', async () => {
    expect(await discoverPlugins({ pluginsDir: join(dir, 'nope') })).toEqual([]);
  });
});

describe('createPermissionPolicy', () => {
  it('grants the everyday capabilities without asking', () => {
    const policy = createPermissionPolicy();
    for (const capability of AUTO_GRANTED) {
      expect(policy.granted('demo', capability), capability).toBe(true);
    }
  });

  it('withholds the ones that reach outside Nightshift', () => {
    const policy = createPermissionPolicy();
    expect(SENSITIVE).toEqual(['network', 'shell']);
    for (const capability of SENSITIVE) {
      expect(policy.granted('demo', capability), capability).toBe(false);
    }
  });

  it('honours a per-plugin grant, and only for that plugin', () => {
    const policy = createPermissionPolicy({ grants: { demo: ['network'] } });

    expect(policy.granted('demo', 'network')).toBe(true);
    expect(policy.granted('demo', 'shell')).toBe(false);
    expect(policy.granted('other', 'network')).toBe(false);
  });

  it('honours an "all" grant', () => {
    const policy = createPermissionPolicy({ grants: { demo: 'all' } });
    expect(policy.granted('demo', 'shell')).toBe(true);
  });

  it('lists what is missing', () => {
    const policy = createPermissionPolicy({ grants: { demo: ['network'] } });

    expect(policy.missing('demo', ['entities:read', 'network', 'shell'])).toEqual(['shell']);
  });
});
