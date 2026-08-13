import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPluginTestContext } from '@nightshift/sdk/testing';
import plugin from './index.js';
import { DEFAULT_SESSION_MINUTES, todayKey } from './timer.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('manifest', () => {
  it('declares the capabilities its setup uses', () => {
    expect(plugin.manifest.id).toBe('focus');
    expect(plugin.manifest.capabilities).toEqual([
      'entities:read',
      'entities:write',
      'widgets:register',
      'commands:register',
      'automations:register',
      'storage',
    ]);
  });
});

describe('setup', () => {
  it('registers the entity with a fresh, idle session', async () => {
    const { context, entities } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    expect(entities.get('timer.focus')).toMatchObject({
      status: 'idle',
      durationSeconds: DEFAULT_SESSION_MINUTES * 60,
      completedToday: 0,
    });
  });

  it('restores today’s count from storage when it was saved today', async () => {
    const { context, entities, storageData } = createPluginTestContext({
      manifest: plugin.manifest,
    });
    storageData.set('progress', { date: todayKey(), completedToday: 2 });

    await plugin.setup(context);

    expect((entities.get('timer.focus') as { completedToday: number }).completedToday).toBe(2);
  });

  it('ignores a saved count from a previous day', async () => {
    const { context, entities, storageData } = createPluginTestContext({
      manifest: plugin.manifest,
    });
    storageData.set('progress', { date: '2000-01-01', completedToday: 9 });

    await plugin.setup(context);

    expect((entities.get('timer.focus') as { completedToday: number }).completedToday).toBe(0);
  });

  it('registers start, pause, stop and reset commands', async () => {
    const { context, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'focus.pause',
      'focus.reset',
      'focus.start',
      'focus.stop',
    ]);
  });

  it('focus.start begins a session of the requested length', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    await commands.get('focus.start')?.run({ minutes: 50 });

    expect(entities.get('timer.focus')).toMatchObject({
      status: 'running',
      durationSeconds: 3000,
      remainingSeconds: 3000,
    });
  });

  it('focus.start without args uses the default length', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    await commands.get('focus.start')?.run();

    expect((entities.get('timer.focus') as { durationSeconds: number }).durationSeconds).toBe(
      DEFAULT_SESSION_MINUTES * 60,
    );
  });

  it('pause, then start, resumes rather than restarting', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    await commands.get('focus.start')?.run({ minutes: 50 });
    vi.advanceTimersByTime(10_000);
    await commands.get('focus.pause')?.run();
    const pausedRemaining = (entities.get('timer.focus') as { remainingSeconds: number })
      .remainingSeconds;

    await commands.get('focus.start')?.run();

    expect(entities.get('timer.focus')).toMatchObject({
      status: 'running',
      remainingSeconds: pausedRemaining,
    });
  });

  it('focus.stop returns to idle without counting a completed session', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });
    vi.advanceTimersByTime(30_000);

    await commands.get('focus.stop')?.run();

    expect(entities.get('timer.focus')).toMatchObject({ status: 'idle', completedToday: 0 });
  });

  it('focus.reset returns to the default length', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 90 });

    await commands.get('focus.reset')?.run();

    expect((entities.get('timer.focus') as { durationSeconds: number }).durationSeconds).toBe(
      DEFAULT_SESSION_MINUTES * 60,
    );
  });

  it('the interval ticks a running session down every second', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });

    vi.advanceTimersByTime(10_000);

    expect((entities.get('timer.focus') as { remainingSeconds: number }).remainingSeconds).toBe(50);
  });

  it('leaves an idle session untouched by the interval', async () => {
    const { context, entities } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);
    const before = entities.get('timer.focus');

    vi.advanceTimersByTime(10_000);

    expect(entities.get('timer.focus')).toEqual(before);
  });

  it('finishing a session saves the new count to storage', async () => {
    const { context, commands, storageData } = createPluginTestContext({
      manifest: plugin.manifest,
    });
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });

    vi.advanceTimersByTime(60_000);
    await vi.waitFor(() => expect(storageData.get('progress')).toBeTruthy());

    expect(storageData.get('progress')).toMatchObject({ completedToday: 1 });
  });

  it('registers a session widget and a today widget with real renderers', async () => {
    const { context, widgets } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    const types = widgets.map((widget) => widget.type);
    expect(types).toEqual(['focus.session', 'focus.today']);
    expect(widgets.every((widget) => typeof widget.render === 'function')).toBe(true);
  });

  it('registers an automation that notifies when a session finishes', async () => {
    const { context, automations } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    expect(automations).toHaveLength(1);
    expect(automations[0]).toMatchObject({
      when: { type: 'entity', entity: 'timer.focus', key: 'status' },
      and: [{ type: 'equals', entity: 'timer.focus', key: 'status', value: 'finished' }],
      then: [{ command: 'app.notify' }],
    });
  });

  it('cleans up the interval when the plugin is torn down', async () => {
    const { context, entities, commands, disposers } = createPluginTestContext({
      manifest: plugin.manifest,
    });
    await plugin.setup(context);
    await commands.get('focus.start')?.run({ minutes: 1 });

    for (const dispose of disposers) dispose();
    const before = entities.get('timer.focus');
    vi.advanceTimersByTime(10_000);

    expect(entities.get('timer.focus')).toEqual(before);
  });
});
