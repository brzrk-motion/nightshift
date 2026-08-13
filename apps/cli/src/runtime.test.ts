import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NIGHTSHIFT_API_VERSION } from '@nightshift/core';
import { MIDNIGHT_THEME, serializeTheme } from '@nightshift/ui';
import { createNullLogger, DEFAULT_CONFIG, loadConfig, resolvePaths } from '@nightshift/services';
import type { CliContext } from './context.js';
import { createNightshiftRuntime } from './runtime.js';

let dir: string;

/**
 * A plugin written to disk as plain JavaScript, so the test exercises the real
 * discovery-and-import path rather than a stubbed importer.
 *
 * It builds its own manifest instead of calling `definePlugin`, because a file
 * in a temp directory has no `node_modules` to resolve the SDK from — the same
 * reason a real local plugin has to be an installed package or a bundle.
 */
const PLUGIN = `
export default {
  manifest: {
    id: 'demo',
    name: 'Demo',
    version: '1.0.0',
    apiVersion: ${NIGHTSHIFT_API_VERSION},
    capabilities: ['entities:write', 'widgets:register', 'commands:register'],
  },
  setup(context) {
    context.registerEntity('demo.counter', { value: 1 });
    context.registerWidget({
      type: 'demo.card',
      title: 'Demo',
      entities: ['demo.counter'],
      render: () => null,
    });
    context.registerCommand({ id: 'demo.go', title: 'Go', run: () => {} });
  },
};
`;

function contextFor(overrides: Partial<CliContext> = {}): CliContext {
  return {
    config: { ...DEFAULT_CONFIG, plugins: [] },
    paths: resolvePaths({ configDir: dir }),
    configExists: true,
    log: createNullLogger(),
    json: true,
    ...overrides,
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nightshift-runtime-'));
  await mkdir(join(dir, 'plugins'), { recursive: true });
  await mkdir(join(dir, 'dashboards'), { recursive: true });
  await mkdir(join(dir, 'vibes'), { recursive: true });
  await mkdir(join(dir, 'themes'), { recursive: true });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createNightshiftRuntime', () => {
  it('starts with the built-in widgets and dashboards and no plugins', async () => {
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.dashboards.map((dashboard) => dashboard.name)).toEqual([
        'home',
        'minimal',
        'nightshift',
      ]);
      expect(runtime.widgets.list().map((widget) => widget.type)).toContain('core.note');
      expect(runtime.plugins.list()).toEqual([]);
      expect(runtime.warnings).toEqual([]);
    } finally {
      await runtime.dispose();
    }
  });

  it('loads a plugin from the config directory and wires up what it contributes', async () => {
    await writeFile(join(dir, 'plugins', 'demo.mjs'), PLUGIN);

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.plugins.list().map((plugin) => plugin.manifest.id)).toEqual(['demo']);
      expect(runtime.entities.get('demo.counter')?.state).toEqual({ value: 1 });
      expect(runtime.widgets.get('demo.card')?.source).toBe('demo');
      expect(runtime.app.commands.get('demo.go')?.category).toBe('demo');
      expect(runtime.warnings).toEqual([]);
    } finally {
      await runtime.dispose();
    }
  });

  it('reports a plugin that cannot be loaded and carries on', async () => {
    await writeFile(join(dir, 'plugins', 'broken.mjs'), 'export default { nope: true };');

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.warnings).toHaveLength(1);
      expect(runtime.warnings[0]).toMatch(/Plugin "broken" did not load/);
      expect(runtime.dashboards).toHaveLength(3);
    } finally {
      await runtime.dispose();
    }
  });

  it('loads user dashboards alongside the built-in ones', async () => {
    await writeFile(join(dir, 'dashboards', 'work.yaml'), 'rows:\n  - [core.note]');

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.dashboards.map((dashboard) => dashboard.name)).toEqual([
        'home',
        'minimal',
        'nightshift',
        'work',
      ]);
    } finally {
      await runtime.dispose();
    }
  });

  it('lets a user dashboard called home replace the built-in one', async () => {
    await writeFile(join(dir, 'dashboards', 'home.yaml'), 'title: Mine\nrows:\n  - [core.note]');

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.dashboards).toHaveLength(3);
      expect(runtime.dashboards.find((dashboard) => dashboard.name === 'home')?.title).toBe('Mine');
    } finally {
      await runtime.dispose();
    }
  });

  it('reports a dashboard file it cannot read', async () => {
    await writeFile(join(dir, 'dashboards', 'bad.yaml'), 'rows: 3');

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.warnings[0]).toMatch(/bad\.yaml could not be read/);
    } finally {
      await runtime.dispose();
    }
  });

  it('starts the app on the configured theme', async () => {
    const runtime = await createNightshiftRuntime(
      contextFor({ config: { ...DEFAULT_CONFIG, plugins: [], theme: 'ember' } }),
    );

    try {
      expect(runtime.app.themes.current.name).toBe('ember');
    } finally {
      await runtime.dispose();
    }
  });

  it('takes a plugin’s entities away again when it is disposed', async () => {
    await writeFile(join(dir, 'plugins', 'demo.mjs'), PLUGIN);
    const runtime = await createNightshiftRuntime(contextFor());

    await runtime.dispose();

    expect(runtime.entities.has('demo.counter')).toBe(false);
  });

  it('registers the three built-in vibes', async () => {
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.vibes.list().map((vibe) => vibe.name)).toEqual([
        'locked-in',
        'morning',
        'night-shift',
      ]);
    } finally {
      await runtime.dispose();
    }
  });

  it('registers an activate command for each vibe, reachable from the palette', async () => {
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      const command = runtime.app.commands.get('vibe.activate.locked-in');
      expect(command).toMatchObject({ title: 'Activate Locked In', category: 'Vibes' });

      await runtime.app.commands.run('vibe.activate.locked-in');
      expect(runtime.vibes.current).toBe('locked-in');
    } finally {
      await runtime.dispose();
    }
  });

  it('lets a user vibe file replace a built-in of the same name', async () => {
    await writeFile(join(dir, 'vibes', 'morning.yaml'), 'title: Mine');

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      const morning = runtime.vibes.list().filter((vibe) => vibe.name === 'morning');
      expect(morning).toHaveLength(1);
      expect(morning[0]?.title).toBe('Mine');
    } finally {
      await runtime.dispose();
    }
  });

  it('reports a vibe file it cannot read', async () => {
    await writeFile(join(dir, 'vibes', 'bad.yaml'), 'theme: 3');

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.warnings[0]).toMatch(/bad\.yaml could not be read/);
    } finally {
      await runtime.dispose();
    }
  });

  it('registers a plugin’s automations and starts the engine', async () => {
    const withAutomation = PLUGIN.replace(
      "context.registerCommand({ id: 'demo.go', title: 'Go', run: () => {} });",
      `context.registerCommand({ id: 'demo.go', title: 'Go', run: () => {} });
    context.registerAutomation({
      name: 'demo.startup',
      when: { type: 'startup' },
      then: [{ command: 'demo.go' }],
    });`,
    );
    await writeFile(join(dir, 'plugins', 'demo.mjs'), withAutomation);

    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.automations.list().map((entry) => entry.name)).toEqual(['demo.startup']);
      expect(runtime.automations.running).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });

  it('activating a vibe applies its theme, entities and actions, and notifies automations', async () => {
    await writeFile(join(dir, 'plugins', 'demo.mjs'), PLUGIN);
    const runtime = await createNightshiftRuntime(contextFor());
    const fired: string[] = [];
    runtime.automations.register({
      name: 'on-locked-in',
      when: { type: 'vibe', vibe: 'locked-in', on: 'activate' },
      then: [{ command: 'demo.go' }],
    });
    runtime.automations.events.on('fired', (result) => fired.push(result.name));

    try {
      await runtime.vibes.activate('locked-in');

      expect(runtime.app.themes.current.name).toBe('midnight');
      // notifyVibe fires the automation without waiting for it, the same way
      // an entity-triggered automation is not awaited by whatever changed the
      // entity — so the assertion has to wait for it too.
      await vi.waitFor(() => expect(fired).toEqual(['on-locked-in']));
    } finally {
      await runtime.dispose();
    }
  });

  it('publishes the active vibe as an entity for the shell header, and clears it on deactivate', async () => {
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.entities.get('nightshift.vibe')?.state).toEqual({ active: null, title: null });

      await runtime.vibes.activate('locked-in');
      expect(runtime.entities.get('nightshift.vibe')?.state).toEqual({
        active: 'locked-in',
        title: 'Locked In',
      });

      await runtime.vibes.deactivate();
      expect(runtime.entities.get('nightshift.vibe')?.state).toEqual({ active: null, title: null });
    } finally {
      await runtime.dispose();
    }
  });

  it('publishes a plugin snapshot entity for the Apps screen, and tags commands with their source', async () => {
    await writeFile(join(dir, 'plugins', 'demo.mjs'), PLUGIN);
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.entities.get('nightshift.plugins')?.state).toEqual({
        plugins: [{ id: 'demo', name: 'Demo', version: '1.0.0', commands: 1, widgets: 1 }],
      });
      expect(runtime.app.commands.get('demo.go')?.source).toBe('demo');
    } finally {
      await runtime.dispose();
    }
  });

  it('publishes a snapshot of registered automations for the Automations screen', async () => {
    const withAutomation = PLUGIN.replace(
      "context.registerCommand({ id: 'demo.go', title: 'Go', run: () => {} });",
      `context.registerCommand({ id: 'demo.go', title: 'Go', run: () => {} });
    context.registerAutomation({
      name: 'demo.startup',
      when: { type: 'startup' },
      then: [{ command: 'demo.go' }],
    });`,
    );
    await writeFile(join(dir, 'plugins', 'demo.mjs'), withAutomation);
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.entities.get('nightshift.automations')?.state).toEqual({
        automations: [{ name: 'demo.startup', trigger: 'startup', enabled: true }],
      });
    } finally {
      await runtime.dispose();
    }
  });

  it('deactivates the active vibe before plugins unload, so its actions still resolve', async () => {
    await writeFile(join(dir, 'plugins', 'demo.mjs'), PLUGIN);
    const runtime = await createNightshiftRuntime(contextFor());
    runtime.vibes.register({
      name: 'custom',
      onDeactivate: [{ command: 'demo.go' }],
    });
    await runtime.vibes.activate('custom');
    const spy = vi.spyOn(runtime.app.commands, 'run');

    await runtime.dispose();

    expect(spy).toHaveBeenCalledWith('demo.go', undefined);
  });

  it('registers theme activate commands for every theme', async () => {
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      expect(runtime.app.commands.get('theme.activate.midnight')).toBeTruthy();
      expect(runtime.app.commands.get('theme.activate.ember')).toBeTruthy();
    } finally {
      await runtime.dispose();
    }
  });

  it('persists config when activating a theme', async () => {
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      await runtime.app.commands.run('theme.activate.ember');
      expect(runtime.app.themes.current.name).toBe('ember');

      const loaded = await loadConfig({ configDir: dir });
      expect(loaded.config.theme).toBe('ember');
    } finally {
      await runtime.dispose();
    }
  });

  it('publishes nightshift.themes catalog entity', async () => {
    const runtime = await createNightshiftRuntime(contextFor());

    try {
      const catalog = runtime.entities.get<{ themes: Array<{ name: string; active: boolean }> }>(
        'nightshift.themes',
      );
      expect(catalog?.state.themes.map((row) => row.name)).toEqual([
        'midnight',
        'ember',
        'daylight',
      ]);
      expect(catalog?.state.themes.find((row) => row.name === 'midnight')?.active).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });

  it('saves a user theme via theme.save', async () => {
    const runtime = await createNightshiftRuntime(contextFor());
    const forest = { ...MIDNIGHT_THEME, name: 'forest', colors: { ...MIDNIGHT_THEME.colors } };

    try {
      await runtime.app.commands.run('theme.save', {
        name: 'forest',
        appearance: 'dark',
        colors: forest.colors as unknown as Record<string, string>,
      });
      expect(runtime.app.themes.list().some((theme) => theme.name === 'forest')).toBe(true);
      expect(runtime.app.commands.get('theme.activate.forest')).toBeTruthy();
    } finally {
      await runtime.dispose();
    }
  });

  it('deletes a user theme and falls back when deleting the active theme', async () => {
    const forest = { ...MIDNIGHT_THEME, name: 'forest' };
    await writeFile(join(dir, 'themes', 'forest.yaml'), serializeTheme(forest));
    const runtime = await createNightshiftRuntime(
      contextFor({ config: { ...DEFAULT_CONFIG, plugins: [], theme: 'forest' } }),
    );

    try {
      expect(runtime.app.themes.current.name).toBe('forest');
      await runtime.app.commands.run('theme.delete', { name: 'forest' });
      expect(runtime.app.themes.current.name).toBe('midnight');
      const loaded = await loadConfig({ configDir: dir });
      expect(loaded.config.theme).toBe('midnight');
      expect(runtime.app.themes.list().some((theme) => theme.name === 'forest')).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });
});
