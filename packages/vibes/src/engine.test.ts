import { describe, expect, it, vi } from 'vitest';
import { createEntityStore } from '@nightshift/entities';
import { isNightshiftError } from '@nightshift/core';
import { createVibeEngine, type CommandRunner, type ThemeSwitcher } from './engine.js';
import type { VibeSpec } from './schema.js';

function themes(known: readonly string[] = ['midnight', 'daylight']): ThemeSwitcher & {
  active: string[];
} {
  const active: string[] = [];
  return {
    active,
    resolve: (name) => (known.includes(name) ? { name } : undefined),
    activate: (name) => {
      active.push(name);
      return { name };
    },
  };
}

function commands(
  impl: Record<string, (args?: Record<string, unknown>) => void> = {},
  known: readonly string[] = ['dashboard.open.home'],
): CommandRunner & { calls: { id: string; args: unknown }[] } {
  const calls: { id: string; args: unknown }[] = [];
  return {
    calls,
    run: async (id, args) => {
      calls.push({ id, args });
      const handler = impl[id];
      if (handler) return handler(args);
      if (id.startsWith('dashboard.open.') && !known.includes(id)) {
        throw new Error(`no such command: ${id}`);
      }
    },
  };
}

const lockedIn: VibeSpec = {
  name: 'locked-in',
  theme: 'midnight',
  dashboard: 'home',
  entities: { 'timer.focus': { status: 'idle' } },
  onActivate: [{ command: 'focus.start', args: { minutes: 50 } }],
  onDeactivate: [{ command: 'focus.pause' }],
};

describe('createVibeEngine', () => {
  it('registers and looks up vibes', () => {
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands(),
    });
    engine.register(lockedIn);

    expect(engine.get('locked-in')).toBe(lockedIn);
    expect(engine.list().map((vibe) => vibe.name)).toEqual(['locked-in']);
  });

  it('registers many at once', () => {
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands(),
    });
    for (const vibe of [lockedIn, { name: 'morning' }]) engine.register(vibe);

    expect(engine.list().map((vibe) => vibe.name)).toEqual(['locked-in', 'morning']);
  });

  it('a register() disposer removes the vibe', () => {
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands(),
    });
    const dispose = engine.register(lockedIn);

    dispose();

    expect(engine.get('locked-in')).toBeUndefined();
  });

  it('throws for an unknown vibe', async () => {
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands(),
    });

    try {
      await engine.activate('nope');
      expect.unreachable('activate should have thrown');
    } catch (error) {
      expect(isNightshiftError(error) && error.code).toBe('VIBE_NOT_FOUND');
    }
  });

  it('activates the theme, the dashboard, the entities, and the actions', async () => {
    const entities = createEntityStore();
    entities.register('timer.focus', { status: 'running' });
    const t = themes();
    const c = commands();
    const engine = createVibeEngine({ themes: t, entities, commands: c });
    engine.register(lockedIn);

    const result = await engine.activate('locked-in');

    expect(t.active).toEqual(['midnight']);
    expect(entities.get('timer.focus')?.state).toEqual({ status: 'idle' });
    expect(c.calls.map((call) => call.id)).toEqual(['dashboard.open.home', 'focus.start']);
    expect(c.calls[1]?.args).toEqual({ minutes: 50 });
    expect(result.warnings).toEqual([]);
    expect(engine.current).toBe('locked-in');
  });

  it('warns instead of throwing for an unknown theme', async () => {
    const engine = createVibeEngine({
      themes: themes([]),
      entities: createEntityStore(),
      commands: commands(),
    });
    engine.register({ name: 'x', theme: 'nope' });

    const result = await engine.activate('x');

    expect(result.warnings).toEqual(['Theme "nope" is not registered.']);
  });

  it('warns instead of throwing when an entity does not exist', async () => {
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands(),
    });
    engine.register({ name: 'x', entities: { 'timer.focus': { status: 'idle' } } });

    const result = await engine.activate('x');

    expect(result.warnings[0]).toMatch(/Could not update "timer.focus"/);
  });

  it('warns instead of throwing when the dashboard is unavailable', async () => {
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands(),
    });
    engine.register({ name: 'x', dashboard: 'nope' });

    const result = await engine.activate('x');

    expect(result.warnings).toEqual(['Dashboard "nope" is not available.']);
  });

  it('keeps running onActivate actions after one fails', async () => {
    const fail = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands({ 'a.fail': fail, 'a.ok': ok }),
    });
    engine.register({ name: 'x', onActivate: [{ command: 'a.fail' }, { command: 'a.ok' }] });

    const result = await engine.activate('x');

    expect(ok).toHaveBeenCalledOnce();
    expect(result.warnings[0]).toMatch(/"a.fail" failed: boom/);
  });

  it('emits an activated event', async () => {
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: commands(),
    });
    engine.register({ name: 'x' });
    const listener = vi.fn();
    engine.events.on('activated', listener);

    await engine.activate('x');

    expect(listener).toHaveBeenCalledWith({ vibe: { name: 'x' }, warnings: [] });
  });

  it('runs the outgoing vibe’s onDeactivate before the next one applies', async () => {
    const c = commands();
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: c,
    });
    engine.register({ name: 'a', onDeactivate: [{ command: 'a.stop' }] });
    engine.register({ name: 'b', onActivate: [{ command: 'b.start' }] });

    await engine.activate('a');
    await engine.activate('b');

    expect(c.calls.map((call) => call.id)).toEqual(['a.stop', 'b.start']);
    expect(engine.current).toBe('b');
  });

  it('deactivate() clears the current vibe and emits an event', async () => {
    const c = commands();
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: c,
    });
    engine.register({ name: 'a', onDeactivate: [{ command: 'a.stop' }] });
    await engine.activate('a');
    const listener = vi.fn();
    engine.events.on('deactivated', listener);

    await engine.deactivate();

    expect(engine.current).toBeUndefined();
    expect(c.calls.map((call) => call.id)).toEqual(['a.stop']);
    expect(listener).toHaveBeenCalledWith('a', []);
  });

  it('deactivate() is a no-op when nothing is active', async () => {
    const c = commands();
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: c,
    });

    await expect(engine.deactivate()).resolves.toBeUndefined();
    expect(c.calls).toEqual([]);
  });

  it('re-activating the same vibe does not run its own deactivate first', async () => {
    const c = commands();
    const engine = createVibeEngine({
      themes: themes(),
      entities: createEntityStore(),
      commands: c,
    });
    engine.register({
      name: 'a',
      onDeactivate: [{ command: 'a.stop' }],
      onActivate: [{ command: 'a.start' }],
    });

    await engine.activate('a');
    c.calls.length = 0;
    await engine.activate('a');

    expect(c.calls.map((call) => call.id)).toEqual(['a.start']);
  });
});
