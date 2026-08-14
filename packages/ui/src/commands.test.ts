import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry, scoreCommand, type Command } from './commands.js';

function command(id: string, overrides: Partial<Command> = {}): Command {
  return { id, title: id, run: () => {}, ...overrides };
}

describe('createCommandRegistry', () => {
  it('registers commands and reads them back', () => {
    const registry = createCommandRegistry([command('focus.start')]);

    expect(registry.get('focus.start')?.id).toBe('focus.start');
    expect(registry.list()).toHaveLength(1);
  });

  it('sorts the list by id', () => {
    const registry = createCommandRegistry([command('b.one'), command('a.two')]);
    expect(registry.list().map((entry) => entry.id)).toEqual(['a.two', 'b.one']);
  });

  it('returns a disposer that unregisters the command', () => {
    const registry = createCommandRegistry();
    const dispose = registry.register(command('focus.start'));

    dispose();

    expect(registry.get('focus.start')).toBeUndefined();
  });

  it('rejects a command with no id', () => {
    expect(() => createCommandRegistry().register(command(' '))).toThrowError(/needs an id/);
  });

  it('runs a command and announces it', async () => {
    const run = vi.fn();
    const registry = createCommandRegistry([command('focus.start', { run })]);
    const ran = vi.fn();
    registry.events.on('ran', ran);

    await registry.run('focus.start', { minutes: 50 });

    expect(run).toHaveBeenCalledWith({ minutes: 50 });
    expect(ran).toHaveBeenCalledWith('focus.start', { minutes: 50 });
  });

  it('throws a helpful error for an unknown command', async () => {
    await expect(createCommandRegistry().run('nope')).rejects.toThrowError(/No command with id/);
  });

  it('reports a command that throws, and rethrows', async () => {
    const registry = createCommandRegistry([
      command('focus.start', {
        run: () => {
          throw new Error('boom');
        },
      }),
    ]);
    const failed = vi.fn();
    registry.events.on('failed', failed);

    await expect(registry.run('focus.start')).rejects.toThrowError('boom');
    expect(failed).toHaveBeenCalledOnce();
  });

  it('awaits an async command', async () => {
    let done = false;
    const registry = createCommandRegistry([
      command('slow', {
        run: async () => {
          await Promise.resolve();
          done = true;
        },
      }),
    ]);

    await registry.run('slow');

    expect(done).toBe(true);
  });
});

describe('search', () => {
  const registry = createCommandRegistry([
    command('focus.start', { title: 'Start focus session', category: 'Focus' }),
    command('focus.stop', { title: 'Stop focus session', category: 'Focus' }),
    command('dashboard.refresh', { title: 'Refresh every widget' }),
    command('app.quit', { title: 'Quit Nightshift', hidden: true }),
  ]);

  it('returns every visible command for an empty query', () => {
    expect(registry.search('').map((entry) => entry.id)).toEqual([
      'dashboard.refresh',
      'focus.start',
      'focus.stop',
    ]);
  });

  it('never surfaces hidden commands', () => {
    expect(registry.search('quit')).toEqual([]);
  });

  it('includes hidden commands when asked', () => {
    expect(registry.search('quit', { includeHidden: true }).map((entry) => entry.id)).toEqual([
      'app.quit',
    ]);
  });

  it('caps the result list when a limit is set', () => {
    expect(registry.search('', { limit: 2 })).toHaveLength(2);
  });

  it('finds commands by a subsequence of the id', () => {
    expect(registry.search('fsta').map((entry) => entry.id)).toEqual(['focus.start']);
  });

  it('finds commands by title', () => {
    expect(registry.search('refresh')[0]?.id).toBe('dashboard.refresh');
  });

  it('returns nothing when a character is missing', () => {
    expect(registry.search('zzz')).toEqual([]);
  });

  it('matches a substring of the command id', () => {
    const themed = createCommandRegistry([
      command('theme.activate.midnight', { title: 'Activate midnight' }),
    ]);
    expect(themed.search('midnight').map((entry) => entry.id)).toEqual(['theme.activate.midnight']);
  });

  it('ranks a run of consecutive characters above a scattered match', () => {
    expect(
      scoreCommand(command('focus.start', { title: 'Start focus session' }), 'focus'),
    ).toBeGreaterThan(scoreCommand(command('dashboard.refresh', { title: 'Refresh' }), 'focus'));
  });
});
