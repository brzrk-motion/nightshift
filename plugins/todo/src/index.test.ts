import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPluginTestContext } from '@nightshift/sdk/testing';
import type { TodoItem } from './entity.js';

/**
 * `setup()` talks to disk through `file.ts`, not through `context.storage` —
 * see that module's comment for why. Mocking it here is what keeps this test
 * from writing a real `todo.md` into whoever runs the suite's home directory.
 */
const fileState = vi.hoisted(() => ({
  items: [] as TodoItem[],
  saved: undefined as TodoItem[] | undefined,
  loadError: undefined as Error | undefined,
}));

vi.mock('./file.js', () => ({
  DEFAULT_TODO_PATH: '/fake/home/todo.md',
  loadTodos: async () => {
    if (fileState.loadError) throw fileState.loadError;
    return fileState.items;
  },
  saveTodos: async (items: readonly TodoItem[]) => {
    fileState.saved = [...items];
  },
}));

const { default: plugin } = await import('./index.js');

beforeEach(() => {
  fileState.items = [];
  fileState.saved = undefined;
  fileState.loadError = undefined;
});

describe('manifest', () => {
  it('declares the capabilities its setup uses', () => {
    expect(plugin.manifest.id).toBe('todo');
    expect(plugin.manifest.capabilities).toEqual([
      'entities:read',
      'entities:write',
      'widgets:register',
      'commands:register',
      'storage',
    ]);
  });
});

describe('setup', () => {
  it('loads existing todos from the file into the entity', async () => {
    fileState.items = [{ text: 'Buy milk', done: false }];
    const { context, entities } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });

    await plugin.setup(context);

    expect(entities.get('todo.items')).toEqual({
      items: [{ text: 'Buy milk', done: false }],
      hideCompleted: false,
    });
  });

  it('starts with an empty list when the file does not exist yet', async () => {
    const { context, entities } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });

    await plugin.setup(context);

    expect(entities.get('todo.items')).toEqual({ items: [], hideCompleted: false });
  });

  it('starts with an empty list rather than failing when the file cannot be read', async () => {
    fileState.loadError = new Error('permission denied');
    const { context, entities } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });

    await plugin.setup(context);

    expect(entities.get('todo.items')).toEqual({ items: [], hideCompleted: false });
  });

  it('registers the add, toggle, edit and filter commands', async () => {
    const { context, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'todo.add',
      'todo.edit',
      'todo.filter.toggle',
      'todo.toggle',
    ]);
  });

  it('registers a widget with a real renderer', async () => {
    const { context, widgets } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });
    await plugin.setup(context);

    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ type: 'todo.list', entities: ['todo.items'] });
    expect(typeof widgets[0]?.render).toBe('function');
  });

  it('todo.add appends a todo and saves the file', async () => {
    const { context, entities, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });
    await plugin.setup(context);

    await commands.get('todo.add')?.run({ text: 'Buy milk' });

    expect(entities.get('todo.items')).toMatchObject({
      items: [{ text: 'Buy milk', done: false }],
    });
    await vi.waitFor(() => expect(fileState.saved).toEqual([{ text: 'Buy milk', done: false }]));
  });

  it('todo.add ignores blank text', async () => {
    const { context, entities, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });
    await plugin.setup(context);

    await commands.get('todo.add')?.run({ text: '   ' });

    expect(entities.get('todo.items')).toMatchObject({ items: [] });
  });

  it('todo.toggle flips the item at the given index', async () => {
    fileState.items = [{ text: 'Buy milk', done: false }];
    const { context, entities, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });
    await plugin.setup(context);

    await commands.get('todo.toggle')?.run({ index: 0 });

    expect(entities.get('todo.items')).toMatchObject({
      items: [{ text: 'Buy milk', done: true }],
    });
    await vi.waitFor(() => expect(fileState.saved).toEqual([{ text: 'Buy milk', done: true }]));
  });

  it('todo.edit replaces the text of the item at the given index', async () => {
    fileState.items = [{ text: 'old', done: false }];
    const { context, entities, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });
    await plugin.setup(context);

    await commands.get('todo.edit')?.run({ index: 0, text: 'new' });

    expect(entities.get('todo.items')).toMatchObject({ items: [{ text: 'new', done: false }] });
  });

  it('todo.filter.toggle flips hideCompleted without touching items', async () => {
    fileState.items = [{ text: 'a', done: false }];
    const { context, entities, commands } = createPluginTestContext({
      manifest: plugin.manifest,
      fetchErrorMessage: 'todo tests do not use network',
    });
    await plugin.setup(context);

    await commands.get('todo.filter.toggle')?.run();

    expect(entities.get('todo.items')).toEqual({
      items: [{ text: 'a', done: false }],
      hideCompleted: true,
    });

    await commands.get('todo.filter.toggle')?.run();

    expect((entities.get('todo.items') as { hideCompleted: boolean }).hideCompleted).toBe(false);
  });
});
