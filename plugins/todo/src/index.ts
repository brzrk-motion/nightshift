import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';
import { initialState, TODO_ENTITY, type TodoState } from './entity.js';
import { createTodoFile, DEFAULT_TODO_PATH, type TodoFile } from './file.js';
import { addTodo, editTodo, toggleTodo } from './todos.js';
import { TodoWidget } from './widgets.js';

/**
 * The todo list — no backend, just `todo.md` in the user's home directory
 * (see `file.ts`) and one entity mirroring its contents. Every command reads
 * the entity, runs a pure reducer from `todos.ts`, writes the result back and
 * saves the file; the widget itself holds no todo state beyond which row (if
 * any) is mid-edit.
 */

function textArg(args: Record<string, Json> | undefined): string {
  const text = args?.['text'];
  return typeof text === 'string' ? text : '';
}

function indexArg(args: Record<string, Json> | undefined): number {
  const index = args?.['index'];
  return typeof index === 'number' ? index : -1;
}

export default definePlugin({
  id: 'todo',
  name: 'Todo',
  version: '0.1.0',
  description: 'A todo list backed by a plain todo.md file — no backend.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    const file: TodoFile = createTodoFile();
    const items = await file.load().catch((error: unknown) => {
      context.log.warn('Could not read todo.md; starting with an empty list', {
        error: `${error}`,
      });
      return [];
    });

    context.registerEntity(TODO_ENTITY, initialState(items), { title: 'Todos', owner: 'todo' });

    const read = (): TodoState =>
      context.entities.get<TodoState>(TODO_ENTITY)?.state ?? initialState();
    const write = (next: TodoState): void => {
      context.entities.set(TODO_ENTITY, next);
      file.save(next.items).catch((error: unknown) => {
        context.log.warn('Could not save todo.md', { error: `${error}` });
      });
    };

    context.registerCommand({
      id: 'todo.add',
      title: 'Add todo',
      run: (args) => {
        const current = read();
        write({ ...current, items: addTodo(current.items, textArg(args)) });
      },
    });
    context.registerCommand({
      id: 'todo.toggle',
      title: 'Toggle todo',
      run: (args) => {
        const current = read();
        write({ ...current, items: toggleTodo(current.items, indexArg(args)) });
      },
    });
    context.registerCommand({
      id: 'todo.edit',
      title: 'Edit todo',
      run: (args) => {
        const current = read();
        write({ ...current, items: editTodo(current.items, indexArg(args), textArg(args)) });
      },
    });
    context.registerCommand({
      id: 'todo.filter.toggle',
      title: 'Toggle hide-completed filter',
      run: () => {
        const current = read();
        write({ ...current, hideCompleted: !current.hideCompleted });
      },
    });

    context.registerWidget({
      type: 'todo.list',
      title: 'Todo',
      entities: [TODO_ENTITY],
      description: 'Add, check off, filter and edit todos — backed by a plain todo.md file.',
      render: TodoWidget,
    });

    context.log.info('Todo plugin ready', { path: DEFAULT_TODO_PATH });
  },
});

export { initialState, TODO_ENTITY, type TodoItem, type TodoState } from './entity.js';
export { createTodoFile, DEFAULT_TODO_PATH } from './file.js';
export { parseTodoMarkdown, serializeTodoMarkdown } from './markdown.js';
export { addTodo, editTodo, toggleTodo, visibleTodos } from './todos.js';
export { TodoWidget } from './widgets.js';
