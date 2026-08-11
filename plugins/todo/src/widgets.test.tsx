import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import {
  createAppRuntime,
  detectRuntime,
  MIDNIGHT_THEME,
  RuntimeProvider,
  ThemeProvider,
} from '@nightshift/ui';
import type { Json } from '@nightshift/sdk';
import { initialState, TODO_ENTITY, type TodoState } from './entity.js';
import { TodoWidget } from './widgets.js';

/**
 * These drive the real OpenTUI renderer, which needs native FFI — see
 * packages/ui/vitest.config.ts. On a runtime without it, they skip.
 */
const renderable = detectRuntime().ffi;

/** Finds the first character position of `text` in a captured frame, so tests
 * click on whatever a button's label actually renders at instead of a
 * hand-guessed coordinate. */
function locate(frame: string, text: string): { x: number; y: number } {
  const lines = frame.split('\n');
  for (let y = 0; y < lines.length; y += 1) {
    const x = lines[y]?.indexOf(text) ?? -1;
    if (x !== -1) return { x, y };
  }
  throw new Error(`"${text}" was not found in the frame:\n${frame}`);
}

async function typeIntoInput(
  setup: Awaited<ReturnType<typeof testRender>>,
  text: string,
): Promise<void> {
  await act(async () => {
    for (const char of text) {
      await setup.mockInput.pressKey(char);
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

async function renderWidget(items: { text: string; done: boolean }[]): Promise<{
  entities: ReturnType<typeof createEntityStore>;
  runtime: ReturnType<typeof createAppRuntime>;
  setup: Awaited<ReturnType<typeof testRender>>;
}> {
  const entities = createEntityStore();
  entities.register(TODO_ENTITY, initialState(items));
  const runtime = createAppRuntime({ entities });

  const setup = await testRender(
    <ThemeProvider theme={MIDNIGHT_THEME}>
      <RuntimeProvider runtime={runtime}>
        <TodoWidget options={{}} width={50} height={16} />
      </RuntimeProvider>
    </ThemeProvider>,
    { width: 60, height: 20 },
  );

  return { entities, runtime, setup };
}

describe.skipIf(!renderable)('TodoWidget', () => {
  it('shows the add button, the filter toggle and an empty state with no todos', async () => {
    const { setup } = await renderWidget([]);

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('Add todo');
      expect(frame).toContain('Hide completed');
      expect(frame).toContain('Nothing to do yet.');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('lists todos with a checkbox, their text and an Edit button', async () => {
    const { setup } = await renderWidget([{ text: 'Buy milk', done: false }]);

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();

      expect(frame).toContain('[ ]');
      expect(frame).toContain('Buy milk');
      expect(frame).toContain('Edit');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('a done todo shows a checked box', async () => {
    const { setup } = await renderWidget([{ text: 'Ship it', done: true }]);

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('[x]');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows a different empty state once every todo is checked off', async () => {
    const { entities, runtime, setup } = await renderWidget([{ text: 'Done already', done: true }]);
    runtime.commands.register({
      id: 'todo.filter.toggle',
      title: 'Filter',
      run: () => {
        const current = entities.get<TodoState>(TODO_ENTITY);
        if (current) {
          entities.set(TODO_ENTITY, {
            ...current.state,
            hideCompleted: !current.state.hideCompleted,
          });
        }
      },
    });

    try {
      await setup.renderOnce();
      const { x, y } = locate(setup.captureCharFrame(), 'Hide completed');
      await setup.mockMouse.click(x, y);
      await setup.flush();
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('Everything is checked off.');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('clicking the checkbox runs todo.toggle for that item', async () => {
    const { runtime, setup } = await renderWidget([{ text: 'Buy milk', done: false }]);
    const toggled: (Record<string, Json> | undefined)[] = [];
    runtime.commands.register({
      id: 'todo.toggle',
      title: 'Toggle',
      run: (args) => void toggled.push(args),
    });

    try {
      await setup.renderOnce();
      const { x, y } = locate(setup.captureCharFrame(), '[ ]');
      await setup.mockMouse.click(x, y);
      await setup.renderOnce();

      expect(toggled).toEqual([{ index: 0 }]);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('the Hide completed toggle runs todo.filter.toggle', async () => {
    const { runtime, setup } = await renderWidget([]);
    let ran = 0;
    runtime.commands.register({
      id: 'todo.filter.toggle',
      title: 'Filter',
      run: () => void (ran += 1),
    });

    try {
      await setup.renderOnce();
      const { x, y } = locate(setup.captureCharFrame(), 'Hide completed');
      await setup.mockMouse.click(x, y);
      await setup.renderOnce();

      expect(ran).toBe(1);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('adding a todo opens an inline editor and runs todo.add on Save', async () => {
    const { runtime, setup } = await renderWidget([]);
    const added: (Record<string, Json> | undefined)[] = [];
    runtime.commands.register({
      id: 'todo.add',
      title: 'Add',
      run: (args) => void added.push(args),
    });

    try {
      await setup.renderOnce();
      let point = locate(setup.captureCharFrame(), 'Add todo');
      await setup.mockMouse.click(point.x, point.y);
      await setup.renderOnce();

      // The editor replaces the Add button, focused, ready to type into.
      expect(setup.captureCharFrame()).toContain('Save');

      await typeIntoInput(setup, 'Buy milk');
      await setup.renderOnce();

      await act(async () => {
        await setup.mockInput.pressEnter();
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      await setup.renderOnce();

      expect(added).toEqual([{ text: 'Buy milk' }]);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('Cancel while adding discards the draft without running a command', async () => {
    const { runtime, setup } = await renderWidget([]);
    const added: (Record<string, Json> | undefined)[] = [];
    runtime.commands.register({
      id: 'todo.add',
      title: 'Add',
      run: (args) => void added.push(args),
    });

    try {
      await setup.renderOnce();
      let point = locate(setup.captureCharFrame(), 'Add todo');
      await setup.mockMouse.click(point.x, point.y);
      await setup.renderOnce();

      await typeIntoInput(setup, 'Never minded');
      await setup.renderOnce();

      point = locate(setup.captureCharFrame(), 'Cancel');
      await setup.mockMouse.click(point.x, point.y);
      await setup.renderOnce();

      expect(added).toEqual([]);
      expect(setup.captureCharFrame()).toContain('Add todo');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('editing a todo pre-fills the editor and runs todo.edit on Save', async () => {
    const { runtime, setup } = await renderWidget([{ text: 'Buy milk', done: false }]);
    const edited: (Record<string, Json> | undefined)[] = [];
    runtime.commands.register({
      id: 'todo.edit',
      title: 'Edit',
      run: (args) => void edited.push(args),
    });

    try {
      await setup.renderOnce();
      let point = locate(setup.captureCharFrame(), 'Edit');
      await setup.mockMouse.click(point.x, point.y);
      await setup.renderOnce();

      const frame = setup.captureCharFrame();
      expect(frame).toContain('Buy milk');
      expect(frame).toContain('Save');

      point = locate(frame, 'Save');
      await setup.mockMouse.click(point.x, point.y);
      await setup.renderOnce();

      expect(edited).toEqual([{ index: 0, text: 'Buy milk' }]);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('the list fills the widget instead of stopping partway down a tall one', async () => {
    // Regression test: `<scrollbox>` internally lays itself out as a `row`
    // (its content pane sits beside its vertical scrollbar strip). Setting
    // `flexDirection: 'column'` on the scrollbox itself — an earlier version
    // of this widget did — fights that and starves the content pane of most
    // of the available height, so only a handful of rows show even when the
    // widget is given a lot more room than that.
    const items = Array.from({ length: 20 }, (_, i) => ({ text: `Todo ${i + 1}`, done: false }));
    const entities = createEntityStore();
    entities.register(TODO_ENTITY, initialState(items));
    const runtime = createAppRuntime({ entities });

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <TodoWidget options={{}} width={40} height={40} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 40, height: 40 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      const visibleRows = (frame.match(/Edit/g) ?? []).length;

      // A fill bug shows around 7 of the 20 rows in this much vertical space
      // (measured before the fix); filling it properly shows around 11.
      expect(visibleRows).toBeGreaterThanOrEqual(10);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('scrolls to reveal todos that do not fit in the widget at once', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ text: `Todo ${i + 1}`, done: false }));
    const entities = createEntityStore();
    entities.register(TODO_ENTITY, initialState(items));
    const runtime = createAppRuntime({ entities });

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <TodoWidget options={{}} width={40} height={10} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 40, height: 10 },
    );

    try {
      await setup.renderOnce();
      const before = setup.captureCharFrame();
      expect(before).toContain('Todo 1');
      expect(before).not.toContain('Todo 20');

      // Scroll the list, not the whole terminal: anywhere over the rows.
      // Comfortably more ticks than rows, since a wheel tick moves a small,
      // unspecified delta rather than a whole row.
      for (let i = 0; i < 100; i += 1) {
        await setup.mockMouse.scroll(10, 6, 'down');
      }
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('Todo 20');
    } finally {
      setup.renderer.destroy();
    }
  });
});
