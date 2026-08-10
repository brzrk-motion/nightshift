import type { Json } from '@nightshift/sdk';

/**
 * Split out from `index.ts` so `widgets.ts` can reference the entity id and
 * its state shape without importing the plugin's own `setup()` — the two
 * would otherwise form a cycle.
 */
export const TODO_ENTITY = 'todo.items' as const;

export interface TodoItem {
  text: string;
  done: boolean;
  [key: string]: Json;
}

export interface TodoState {
  items: TodoItem[];
  /** When true, done items are kept in `items` but not drawn. */
  hideCompleted: boolean;
  [key: string]: TodoItem[] | boolean;
}

export function initialState(items: TodoItem[] = []): TodoState {
  return { items, hideCompleted: false };
}
