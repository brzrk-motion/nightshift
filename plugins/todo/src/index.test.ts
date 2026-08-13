import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AutomationSpec,
  Disposable,
  Entity,
  EntityId,
  Json,
  PluginCommand,
  PluginContext,
  PluginWidget,
} from '@nightshift/sdk';
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

/**
 * A minimal, in-memory `PluginContext` — enough to exercise `setup()` exactly
 * as the real plugin host would call it, mirroring the one in
 * `plugins/pomodoro/src/index.test.ts`.
 */
function fakeContext() {
  const entities = new Map<string, Json>();
  const commands = new Map<string, PluginCommand>();
  const widgets: PluginWidget[] = [];
  const automations: AutomationSpec[] = [];
  const disposers: (() => void)[] = [];
  const notify = vi.fn();

  const entity = (id: string): Entity | undefined =>
    entities.has(id)
      ? { id: id as EntityId, state: entities.get(id)!, meta: {}, updatedAt: 0 }
      : undefined;

  const context: PluginContext = {
    manifest: { id: 'todo', name: 'Todo', version: '0.1.0', apiVersion: 1, capabilities: [] },
    log: { error() {}, warn() {}, info() {}, debug() {} },
    notify,
    entities: {
      get: <State extends Json = Json>(id: EntityId) => entity(id) as Entity<State> | undefined,
      has: (id) => entities.has(id),
      list: () => [...entities.keys()].map((id) => entity(id)!),
      register: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      update: <State extends Json = Json>(id: EntityId, patch: Partial<State>) => {
        const next = { ...(entities.get(id) as Record<string, Json>), ...patch };
        entities.set(id, next);
        return entity(id)! as Entity<State>;
      },
      set: <State extends Json = Json>(id: EntityId, state: State) => {
        entities.set(id, state);
        return entity(id)! as Entity<State>;
      },
      remove: (id) => entities.delete(id),
      subscribe: () => () => {},
      subscribeAll: () => () => {},
      events: undefined as never,
      clear: () => entities.clear(),
    },
    storage: {
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
    },
    fetch: async () => {
      throw new Error('todo tests do not use network');
    },
    registerCommand: (command) => void commands.set(command.id, command),
    registerWidget: (widget) => void widgets.push(widget),
    registerAutomation: (automation) => void automations.push(automation),
    registerEntity: (id, state) => void entities.set(id, state),
    own: (disposable: Disposable | (() => void)) =>
      void disposers.push(
        typeof disposable === 'function' ? disposable : () => disposable.dispose(),
      ),
  };

  return { context, entities, commands, widgets };
}

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
    const { context, entities } = fakeContext();

    await plugin.setup(context);

    expect(entities.get('todo.items')).toEqual({
      items: [{ text: 'Buy milk', done: false }],
      hideCompleted: false,
    });
  });

  it('starts with an empty list when the file does not exist yet', async () => {
    const { context, entities } = fakeContext();

    await plugin.setup(context);

    expect(entities.get('todo.items')).toEqual({ items: [], hideCompleted: false });
  });

  it('starts with an empty list rather than failing when the file cannot be read', async () => {
    fileState.loadError = new Error('permission denied');
    const { context, entities } = fakeContext();

    await plugin.setup(context);

    expect(entities.get('todo.items')).toEqual({ items: [], hideCompleted: false });
  });

  it('registers the add, toggle, edit and filter commands', async () => {
    const { context, commands } = fakeContext();
    await plugin.setup(context);

    expect([...commands.keys()].sort()).toEqual([
      'todo.add',
      'todo.edit',
      'todo.filter.toggle',
      'todo.toggle',
    ]);
  });

  it('registers a widget with a real renderer', async () => {
    const { context, widgets } = fakeContext();
    await plugin.setup(context);

    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({ type: 'todo.list', entities: ['todo.items'] });
    expect(typeof widgets[0]?.render).toBe('function');
  });

  it('todo.add appends a todo and saves the file', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('todo.add')?.run({ text: 'Buy milk' });

    expect(entities.get('todo.items')).toMatchObject({
      items: [{ text: 'Buy milk', done: false }],
    });
    await vi.waitFor(() => expect(fileState.saved).toEqual([{ text: 'Buy milk', done: false }]));
  });

  it('todo.add ignores blank text', async () => {
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('todo.add')?.run({ text: '   ' });

    expect(entities.get('todo.items')).toMatchObject({ items: [] });
  });

  it('todo.toggle flips the item at the given index', async () => {
    fileState.items = [{ text: 'Buy milk', done: false }];
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('todo.toggle')?.run({ index: 0 });

    expect(entities.get('todo.items')).toMatchObject({
      items: [{ text: 'Buy milk', done: true }],
    });
    await vi.waitFor(() => expect(fileState.saved).toEqual([{ text: 'Buy milk', done: true }]));
  });

  it('todo.edit replaces the text of the item at the given index', async () => {
    fileState.items = [{ text: 'old', done: false }];
    const { context, entities, commands } = fakeContext();
    await plugin.setup(context);

    await commands.get('todo.edit')?.run({ index: 0, text: 'new' });

    expect(entities.get('todo.items')).toMatchObject({ items: [{ text: 'new', done: false }] });
  });

  it('todo.filter.toggle flips hideCompleted without touching items', async () => {
    fileState.items = [{ text: 'a', done: false }];
    const { context, entities, commands } = fakeContext();
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
