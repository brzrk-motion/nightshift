import type { TodoItem } from './entity.js';

/**
 * The whole persistence format: a Markdown checklist, one line per todo. This
 * plugin owns `todo.md` outright — `parseTodoMarkdown` and
 * `serializeTodoMarkdown` are exact inverses of each other, the same
 * "one parser, read and write" shape dashboards use for their YAML — so a
 * save never has to reconcile itself against anything else that touched the
 * file. Any line that is not a checklist item (a heading, a blank line, prose
 * a user typed in by hand) is read past rather than rejected, but it will not
 * survive the next save: the file is regenerated from the plugin's in-memory
 * state, not patched in place.
 */
const CHECKBOX_LINE = /^-\s*\[([ xX])]\s*(.*)$/;

const HEADING = '# Todo';

export function parseTodoMarkdown(markdown: string): TodoItem[] {
  const items: TodoItem[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = CHECKBOX_LINE.exec(line.trim());
    if (!match) continue;
    const [, mark, text] = match;
    const trimmed = (text ?? '').trim();
    if (trimmed === '') continue;
    items.push({ text: trimmed, done: (mark ?? ' ').toLowerCase() === 'x' });
  }

  return items;
}

export function serializeTodoMarkdown(items: readonly TodoItem[]): string {
  const lines = items.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`);
  return lines.length === 0 ? `${HEADING}\n` : `${HEADING}\n\n${lines.join('\n')}\n`;
}
