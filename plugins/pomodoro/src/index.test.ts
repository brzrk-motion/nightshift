import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayKey } from '@nightshift/plugin-shared';
import { createPluginTestContext } from '@nightshift/sdk/testing';
import plugin from './index.js';
import { DEFAULT_WORK_MINUTES, POMODORO_ENTITY } from './timer.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('manifest', () => {
  it('declares the capabilities its setup uses', () => {
    expect(plugin.manifest.id).toBe('pomodoro');
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

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'idle',
      phase: 'work',
      completedPomodorosToday: 0,
    });
  });

  it('restores today’s count and cycle from storage', async () => {
    const { context, entities, storageData } = createPluginTestContext({
      manifest: plugin.manifest,
    });
    storageData.set('progress', { date: todayKey(), completedPomodorosToday: 2, cycleCount: 1 });

    await plugin.setup(context);

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      completedPomodorosToday: 2,
      cycleCount: 1,
    });
  });

  it('registers start, pause, stop, reset and skip commands', async () => {
    const { context, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'pomodoro.pause',
      'pomodoro.reset',
      'pomodoro.skip',
      'pomodoro.start',
      'pomodoro.stop',
    ]);
  });

  it('pomodoro.start begins a work interval', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    await commands.get('pomodoro.start')?.run();

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'running',
      phase: 'work',
      durationSeconds: DEFAULT_WORK_MINUTES * 60,
    });
  });

  it('completing work queues a break and saves progress', async () => {
    const { context, entities, commands, storageData } = createPluginTestContext({
      manifest: plugin.manifest,
    });
    await plugin.setup(context);
    await commands.get('pomodoro.start')?.run();

    vi.advanceTimersByTime(DEFAULT_WORK_MINUTES * 60_000);
    await vi.waitFor(() => expect(storageData.get('progress')).toBeTruthy());

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'phaseComplete',
      pendingPhase: 'shortBreak',
      completedPomodorosToday: 1,
    });
  });

  it('pomodoro.skip moves to a break without counting a pomodoro', async () => {
    const { context, entities, commands } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);
    await commands.get('pomodoro.start')?.run();

    await commands.get('pomodoro.skip')?.run();

    expect(entities.get(POMODORO_ENTITY)).toMatchObject({
      status: 'running',
      phase: 'shortBreak',
      completedPomodorosToday: 0,
    });
  });

  it('registers session and today widgets with renderers', async () => {
    const { context, widgets } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    expect(widgets.map((widget) => widget.type)).toEqual(['pomodoro.session', 'pomodoro.today']);
    expect(widgets.every((widget) => typeof widget.render === 'function')).toBe(true);
  });

  it('registers automations for work and break completion', async () => {
    const { context, automations } = createPluginTestContext({ manifest: plugin.manifest });
    await plugin.setup(context);

    expect(automations).toHaveLength(3);
    expect(automations.map((automation) => automation.name)).toEqual([
      'pomodoro.notify-work-complete',
      'pomodoro.notify-short-break-complete',
      'pomodoro.notify-long-break-complete',
    ]);
  });

  it('cleans up the interval when torn down', async () => {
    const { context, entities, commands, disposers } = createPluginTestContext({
      manifest: plugin.manifest,
    });
    await plugin.setup(context);
    await commands.get('pomodoro.start')?.run();

    for (const dispose of disposers) dispose();
    const before = entities.get(POMODORO_ENTITY);
    vi.advanceTimersByTime(10_000);

    expect(entities.get(POMODORO_ENTITY)).toEqual(before);
  });
});
