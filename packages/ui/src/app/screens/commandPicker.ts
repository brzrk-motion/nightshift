import { scoreCommand, type Command } from '../../commands.js';

/** Commands visible in vibe action pickers — palette-visible by default. */
export function filterCommands(
  commands: readonly Command[],
  query: string,
  { includeHidden = false, limit = 12 }: { includeHidden?: boolean; limit?: number } = {},
): Command[] {
  const visible = includeHidden ? commands : commands.filter((command) => !command.hidden);
  const trimmed = query.trim();
  if (trimmed === '') return visible.slice(0, limit);

  return visible
    .map((command) => ({ command, score: scoreCommand(command, trimmed) }))
    .filter((entry) => entry.score > 0 || commandIdMatches(entry.command.id, trimmed))
    .sort(
      (a, b) =>
        b.score - a.score || a.command.id.localeCompare(b.command.id),
    )
    .slice(0, limit)
    .map((entry) => entry.command);
}

function commandIdMatches(id: string, query: string): boolean {
  const needle = query.toLowerCase();
  return id.toLowerCase().includes(needle);
}
