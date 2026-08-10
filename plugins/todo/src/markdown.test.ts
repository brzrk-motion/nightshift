import { describe, expect, it } from 'vitest';
import type { TodoItem } from './entity.js';
import { parseTodoMarkdown, serializeTodoMarkdown } from './markdown.js';

describe('parseTodoMarkdown', () => {
  it('reads unchecked and checked items', () => {
    const markdown = '# Todo\n\n- [ ] Buy milk\n- [x] Ship the thing\n';
    expect(parseTodoMarkdown(markdown)).toEqual([
      { text: 'Buy milk', done: false },
      { text: 'Ship the thing', done: true },
    ]);
  });

  it('accepts an upper-case X', () => {
    expect(parseTodoMarkdown('- [X] Done')).toEqual([{ text: 'Done', done: true }]);
  });

  it('ignores headings, blank lines and prose', () => {
    const markdown = '# Todo\n\nSome notes I left myself.\n\n- [ ] Real todo\n';
    expect(parseTodoMarkdown(markdown)).toEqual([{ text: 'Real todo', done: false }]);
  });

  it('ignores a checklist line with no text', () => {
    expect(parseTodoMarkdown('- [ ]   \n- [ ] Real todo')).toEqual([
      { text: 'Real todo', done: false },
    ]);
  });

  it('returns an empty list for an empty file', () => {
    expect(parseTodoMarkdown('')).toEqual([]);
  });
});

describe('serializeTodoMarkdown', () => {
  it('writes one checklist line per item', () => {
    const items: TodoItem[] = [
      { text: 'Buy milk', done: false },
      { text: 'Ship the thing', done: true },
    ];
    expect(serializeTodoMarkdown(items)).toBe('# Todo\n\n- [ ] Buy milk\n- [x] Ship the thing\n');
  });

  it('writes just the heading when there are no items', () => {
    expect(serializeTodoMarkdown([])).toBe('# Todo\n');
  });

  it('round-trips through parse', () => {
    const items: TodoItem[] = [
      { text: 'a', done: false },
      { text: 'b', done: true },
    ];
    expect(parseTodoMarkdown(serializeTodoMarkdown(items))).toEqual(items);
  });
});
