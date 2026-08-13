import { describe, expect, it } from 'vitest';
import { filterCommands } from './filterCommands.js';
import type { Command } from '../../commands.js';

function command(id: string, hidden = false): Command {
  return { id, title: id, hidden, run: () => undefined };
}

describe('filterCommands', () => {
  const commands = [
    command('focus.start'),
    command('focus.pause'),
    command('vibe.save', true),
    command('theme.activate.midnight'),
  ];

  it('hides hidden commands by default', () => {
    expect(filterCommands(commands, '').map((entry) => entry.id)).not.toContain('vibe.save');
  });

  it('matches a search query', () => {
    expect(filterCommands(commands, 'focus').map((entry) => entry.id)).toEqual([
      'focus.pause',
      'focus.start',
    ]);
  });

  it('allows free-typed ids via substring match', () => {
    expect(filterCommands(commands, 'midnight').map((entry) => entry.id)).toContain(
      'theme.activate.midnight',
    );
  });
});
