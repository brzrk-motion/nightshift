import { createEventBus, NightshiftError, type EventBus, type Json } from '@nightshift/core';

/**
 * The command registry. Everything the user can do — from a keybinding, from
 * the palette, from a vibe — goes through a command, so there is one list of
 * capabilities and one place to invoke them from.
 */
export interface Command {
  /** Namespaced id, e.g. `focus.start`. */
  id: string;
  title: string;
  /** Group heading in the palette, e.g. `Focus`. */
  category?: string;
  description?: string;
  /** Hidden from the palette but still callable. */
  hidden?: boolean;
  /** Plugin that contributed the command; absent for built-ins. */
  source?: string;
  run(args?: Record<string, Json>): void | Promise<void>;
}

export interface CommandEvents extends Record<string, unknown[]> {
  registered: [command: Command];
  unregistered: [id: string];
  ran: [id: string, args: Record<string, Json> | undefined];
  failed: [id: string, error: unknown];
}

export interface CommandRegistry {
  register(command: Command): () => void;
  unregister(id: string): boolean;
  get(id: string): Command | undefined;
  /** Every registered command, hidden ones included, sorted by id. */
  list(): Command[];
  /** Visible commands matching a palette query, best match first. */
  search(query: string): Command[];
  run(id: string, args?: Record<string, Json>): Promise<void>;
  readonly events: EventBus<CommandEvents>;
}

/**
 * Scores a command against what the user has typed. Matching is subsequence
 * based — `fst` finds "focus.start" — with prefix and word-boundary hits
 * ranked above matches scattered through the middle of a word.
 */
export function scoreCommand(command: Command, query: string): number {
  const needle = query.trim().toLowerCase();
  if (needle === '') return 1;

  const haystack = `${command.id} ${command.title} ${command.category ?? ''}`.toLowerCase();
  let score = 0;
  let cursor = 0;

  for (const character of needle) {
    if (character === ' ') continue;
    const found = haystack.indexOf(character, cursor);
    if (found === -1) return 0;
    const previous = found === 0 ? ' ' : (haystack[found - 1] ?? ' ');
    // Consecutive characters are the strongest signal, then the start of a
    // word, then anything else.
    if (found === cursor) score += 4;
    else if (previous === ' ' || previous === '.' || previous === '-') score += 3;
    else score += 1;
    cursor = found + 1;
  }

  // Prefer shorter commands when the score ties: they are the more likely
  // target of a short query.
  return score * 100 - haystack.length;
}

export function createCommandRegistry(initial: readonly Command[] = []): CommandRegistry {
  const commands = new Map<string, Command>();
  const events = createEventBus<CommandEvents>();

  const registry: CommandRegistry = {
    register(command) {
      if (command.id.trim() === '') {
        throw new NightshiftError('CONFIG_INVALID', 'A command needs an id.');
      }
      commands.set(command.id, command);
      events.emit('registered', command);
      return () => void registry.unregister(command.id);
    },

    unregister(id) {
      const existed = commands.delete(id);
      if (existed) events.emit('unregistered', id);
      return existed;
    },

    get: (id) => commands.get(id),

    list: () => [...commands.values()].sort((a, b) => a.id.localeCompare(b.id)),

    search(query) {
      return registry
        .list()
        .filter((command) => !command.hidden)
        .map((command) => ({ command, score: scoreCommand(command, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.command.id.localeCompare(b.command.id))
        .map((entry) => entry.command);
    },

    async run(id, args) {
      const command = commands.get(id);
      if (!command) {
        throw new NightshiftError('CONFIG_INVALID', `No command with id "${id}".`, {
          hint: 'Open the command palette to see what is available.',
        });
      }
      try {
        await command.run(args);
        events.emit('ran', id, args);
      } catch (error) {
        // A command that throws must not take the app down with it; the shell
        // turns this event into a toast.
        events.emit('failed', id, error);
        throw error;
      }
    },

    events,
  };

  for (const command of initial) registry.register(command);
  return registry;
}
