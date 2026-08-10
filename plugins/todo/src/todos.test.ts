import { describe, expect, it } from 'vitest';
import type { TodoItem } from './entity.js';
import { addTodo, editTodo, toggleTodo, visibleTodos } from './todos.js';

describe('addTodo', () => {
  it('appends a new, unchecked item', () => {
    expect(addTodo([], 'Buy milk')).toEqual([{ text: 'Buy milk', done: false }]);
  });

  it('trims surrounding whitespace', () => {
    expect(addTodo([], '  Buy milk  ')).toEqual([{ text: 'Buy milk', done: false }]);
  });

  it('ignores blank text', () => {
    expect(addTodo([{ text: 'existing', done: false }], '   ')).toEqual([
      { text: 'existing', done: false },
    ]);
  });

  it('does not mutate the input array', () => {
    const items: TodoItem[] = [{ text: 'existing', done: false }];
    addTodo(items, 'new');
    expect(items).toHaveLength(1);
  });
});

describe('toggleTodo', () => {
  const items: TodoItem[] = [
    { text: 'a', done: false },
    { text: 'b', done: false },
  ];

  it('flips the item at the given index', () => {
    expect(toggleTodo(items, 1)).toEqual([
      { text: 'a', done: false },
      { text: 'b', done: true },
    ]);
  });

  it('toggles back off', () => {
    const once = toggleTodo(items, 1);
    expect(toggleTodo(once, 1)).toEqual(items);
  });

  it('ignores an out-of-range index', () => {
    expect(toggleTodo(items, 5)).toEqual(items);
    expect(toggleTodo(items, -1)).toEqual(items);
  });
});

describe('editTodo', () => {
  const items: TodoItem[] = [{ text: 'old text', done: true }];

  it('replaces the text without touching done', () => {
    expect(editTodo(items, 0, 'new text')).toEqual([{ text: 'new text', done: true }]);
  });

  it('trims the new text', () => {
    expect(editTodo(items, 0, '  new text  ')).toEqual([{ text: 'new text', done: true }]);
  });

  it('ignores a blank edit rather than clearing the todo', () => {
    expect(editTodo(items, 0, '   ')).toEqual(items);
  });

  it('ignores an out-of-range index', () => {
    expect(editTodo(items, 5, 'new text')).toEqual(items);
  });
});

describe('visibleTodos', () => {
  const items: TodoItem[] = [
    { text: 'a', done: false },
    { text: 'b', done: true },
    { text: 'c', done: false },
  ];

  it('returns everything, with its original index, when not hiding completed', () => {
    expect(visibleTodos(items, false)).toEqual([
      { item: items[0], index: 0 },
      { item: items[1], index: 1 },
      { item: items[2], index: 2 },
    ]);
  });

  it('drops done items when hiding completed, keeping original indices', () => {
    expect(visibleTodos(items, true)).toEqual([
      { item: items[0], index: 0 },
      { item: items[2], index: 2 },
    ]);
  });
});
