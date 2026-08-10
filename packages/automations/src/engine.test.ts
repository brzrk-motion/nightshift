import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEntityStore } from '@nightshift/entities';
import { createAutomationEngine, type CommandRunner } from './engine.js';
import type { AutomationSpec } from './schema.js';

function commands(): CommandRunner & { calls: { id: string; args: unknown }[] } {
  const calls: { id: string; args: unknown }[] = [];
  return {
    calls,
    run: async (id, args) => {
      calls.push({ id, args });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createAutomationEngine', () => {
  it('registers and lists automations', () => {
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: commands() });
    const spec: AutomationSpec = { name: 'a', when: { type: 'startup' }, then: [] };

    engine.register(spec);

    expect(engine.get('a')).toBe(spec);
    expect(engine.list().map((entry) => entry.name)).toEqual(['a']);
  });

  it('fires a startup trigger once, when start() is called', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({ name: 'a', when: { type: 'startup' }, then: [{ command: 'x.go' }] });

    engine.start();

    expect(c.calls.map((call) => call.id)).toEqual(['x.go']);
  });

  it('does not fire a startup trigger before start()', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({ name: 'a', when: { type: 'startup' }, then: [{ command: 'x.go' }] });

    expect(c.calls).toEqual([]);
  });

  it('fires a startup trigger immediately if registered after start()', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.start();

    engine.register({ name: 'a', when: { type: 'startup' }, then: [{ command: 'x.go' }] });

    expect(c.calls.map((call) => call.id)).toEqual(['x.go']);
  });

  it('fires an interval trigger repeatedly once started', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({
      name: 'a',
      when: { type: 'interval', seconds: 10 },
      then: [{ command: 'tick' }],
    });

    engine.start();
    vi.advanceTimersByTime(25_000);

    expect(c.calls.filter((call) => call.id === 'tick')).toHaveLength(2);
  });

  it('stops firing an interval trigger after stop()', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({
      name: 'a',
      when: { type: 'interval', seconds: 10 },
      then: [{ command: 'tick' }],
    });
    engine.start();

    engine.stop();
    vi.advanceTimersByTime(30_000);

    expect(c.calls).toEqual([]);
  });

  it('fires an entity trigger when the entity changes', () => {
    const entities = createEntityStore();
    entities.register('timer.focus', { status: 'idle' });
    const c = commands();
    const engine = createAutomationEngine({ entities, commands: c });
    engine.register({
      name: 'a',
      when: { type: 'entity', entity: 'timer.focus' },
      then: [{ command: 'notice' }],
    });
    engine.start();

    entities.update('timer.focus', { status: 'running' });

    expect(c.calls.map((call) => call.id)).toEqual(['notice']);
  });

  it('an entity trigger with a key only fires when that key changes', () => {
    const entities = createEntityStore();
    entities.register('timer.focus', { status: 'idle', remainingSeconds: 60 });
    const c = commands();
    const engine = createAutomationEngine({ entities, commands: c });
    engine.register({
      name: 'a',
      when: { type: 'entity', entity: 'timer.focus', key: 'status' },
      then: [{ command: 'notice' }],
    });
    engine.start();

    entities.update('timer.focus', { remainingSeconds: 59 });
    expect(c.calls).toEqual([]);

    entities.update('timer.focus', { status: 'running' });
    expect(c.calls.map((call) => call.id)).toEqual(['notice']);
  });

  it('ignores an entity trigger for a different entity', () => {
    const entities = createEntityStore();
    entities.register('timer.focus', { status: 'idle' });
    entities.register('weather.now', { temp: 10 });
    const c = commands();
    const engine = createAutomationEngine({ entities, commands: c });
    engine.register({
      name: 'a',
      when: { type: 'entity', entity: 'timer.focus' },
      then: [{ command: 'notice' }],
    });
    engine.start();

    entities.update('weather.now', { temp: 11 });

    expect(c.calls).toEqual([]);
  });

  it('fires a vibe trigger through notifyVibe', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({
      name: 'a',
      when: { type: 'vibe', vibe: 'locked-in', on: 'activate' },
      then: [{ command: 'notice' }],
    });
    engine.start();

    engine.notifyVibe('locked-in', 'deactivate');
    expect(c.calls).toEqual([]);

    engine.notifyVibe('locked-in', 'activate');
    expect(c.calls.map((call) => call.id)).toEqual(['notice']);
  });

  it('ignores notifyVibe before the engine has started', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({
      name: 'a',
      when: { type: 'vibe', vibe: 'x', on: 'activate' },
      then: [{ command: 'notice' }],
    });

    engine.notifyVibe('x', 'activate');

    expect(c.calls).toEqual([]);
  });

  it.each([
    [{ type: 'equals', entity: 'timer.focus', key: 'status', value: 'finished' } as const, true],
    [{ type: 'above', entity: 'timer.focus', key: 'completedToday', value: 2 } as const, true],
    [{ type: 'below', entity: 'timer.focus', key: 'completedToday', value: 10 } as const, true],
    [{ type: 'above', entity: 'timer.focus', key: 'completedToday', value: 100 } as const, false],
  ])('evaluates a %o condition', (condition, expected) => {
    const entities = createEntityStore();
    entities.register('timer.focus', { status: 'finished', completedToday: 3 });
    const c = commands();
    const engine = createAutomationEngine({ entities, commands: c });
    engine.register({
      name: 'a',
      when: { type: 'entity', entity: 'timer.focus' },
      and: [condition],
      then: [{ command: 'notice' }],
    });
    engine.start();

    entities.update('timer.focus', { status: 'finished' });

    expect(c.calls.length > 0).toBe(expected);
  });

  it('requires every condition to hold', () => {
    const entities = createEntityStore();
    entities.register('timer.focus', { status: 'finished', completedToday: 1 });
    const c = commands();
    const engine = createAutomationEngine({ entities, commands: c });
    engine.register({
      name: 'a',
      when: { type: 'entity', entity: 'timer.focus' },
      and: [
        { type: 'equals', entity: 'timer.focus', key: 'status', value: 'finished' },
        { type: 'above', entity: 'timer.focus', key: 'completedToday', value: 5 },
      ],
      then: [{ command: 'notice' }],
    });
    engine.start();

    entities.update('timer.focus', { status: 'finished' });

    expect(c.calls).toEqual([]);
  });

  it('treats a condition on a missing entity as false', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({
      name: 'a',
      when: { type: 'startup' },
      and: [{ type: 'equals', entity: 'timer.focus', key: 'status', value: 'idle' }],
      then: [{ command: 'notice' }],
    });

    engine.start();

    expect(c.calls).toEqual([]);
  });

  it('skips a disabled automation entirely', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({
      name: 'a',
      enabled: false,
      when: { type: 'startup' },
      then: [{ command: 'x' }],
    });

    engine.start();

    expect(c.calls).toEqual([]);
  });

  it('keeps running actions after one fails, and reports the failure', async () => {
    const entities = createEntityStore();
    const commandsImpl: CommandRunner & { calls: unknown[] } = {
      calls: [],
      run: async (id) => {
        commandsImpl.calls.push(id);
        if (id === 'fail') throw new Error('boom');
      },
    };
    const engine = createAutomationEngine({ entities, commands: commandsImpl });
    const listener = vi.fn();
    engine.events.on('fired', listener);
    engine.register({
      name: 'a',
      when: { type: 'startup' },
      then: [{ command: 'fail' }, { command: 'ok' }],
    });

    engine.start();
    await vi.waitFor(() => expect(commandsImpl.calls).toEqual(['fail', 'ok']));

    expect(listener).toHaveBeenCalledWith({
      name: 'a',
      warnings: ['"fail" failed: boom'],
    });
  });

  it('unregister() tears down its trigger', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({
      name: 'a',
      when: { type: 'interval', seconds: 5 },
      then: [{ command: 'tick' }],
    });
    engine.start();

    expect(engine.unregister('a')).toBe(true);
    vi.advanceTimersByTime(20_000);

    expect(c.calls).toEqual([]);
    expect(engine.get('a')).toBeUndefined();
  });

  it('the disposer returned by register() also tears down the trigger', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    const dispose = engine.register({
      name: 'a',
      when: { type: 'interval', seconds: 5 },
      then: [{ command: 'tick' }],
    });
    engine.start();

    dispose();
    vi.advanceTimersByTime(20_000);

    expect(c.calls).toEqual([]);
  });

  it('reports running state', () => {
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: commands() });
    expect(engine.running).toBe(false);
    engine.start();
    expect(engine.running).toBe(true);
    engine.stop();
    expect(engine.running).toBe(false);
  });

  it('start() is idempotent', () => {
    const c = commands();
    const engine = createAutomationEngine({ entities: createEntityStore(), commands: c });
    engine.register({ name: 'a', when: { type: 'startup' }, then: [{ command: 'x' }] });

    engine.start();
    engine.start();

    expect(c.calls.map((call) => call.id)).toEqual(['x']);
  });
});
