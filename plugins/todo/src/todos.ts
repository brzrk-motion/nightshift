import type { TodoItem } from './entity.js';

/**
 * Pure reducers over a todo list: one array in, one array out, nothing about
 * the entity store, the widget or the file on disk in sight — which is what
 * makes them testable without any of that.
 */

export function addTodo(items: readonly TodoItem[], text: string): TodoItem[] {
  const trimmed = text.trim();
  if (trimmed === '') return [...items];
  return [...items, { text: trimmed, done: false }];
}

export function toggleTodo(items: readonly TodoItem[], index: number): TodoItem[] {
  if (index < 0 || index >= items.length) return [...items];
  return items.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
}

/** Replaces an item's text in place. A blank edit is ignored rather than
 * clearing the todo — there is no delete, so an empty text field is never a
 * meaningful state to save. */
export function editTodo(items: readonly TodoItem[], index: number, text: string): TodoItem[] {
  const trimmed = text.trim();
  if (trimmed === '' || index < 0 || index >= items.length) return [...items];
  return items.map((item, i) => (i === index ? { ...item, text: trimmed } : item));
}

/** What the widget draws: everything, or only what is not done yet. */
export function visibleTodos(
  items: readonly TodoItem[],
  hideCompleted: boolean,
): { item: TodoItem; index: number }[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !hideCompleted || !item.done);
}
