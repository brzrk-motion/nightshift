import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadTodos, saveTodos } from './file.js';

describe('loadTodos / saveTodos', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-todo-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loading a file that does not exist yet returns no todos', async () => {
    expect(await loadTodos(join(dir, 'todo.md'))).toEqual([]);
  });

  it('saves and reloads the same items', async () => {
    const path = join(dir, 'todo.md');
    const items = [
      { text: 'Buy milk', done: false },
      { text: 'Ship the thing', done: true },
    ];

    await saveTodos(items, path);

    expect(await loadTodos(path)).toEqual(items);
  });

  it('creates parent directories that do not exist yet', async () => {
    const path = join(dir, 'nested', 'deeper', 'todo.md');

    await saveTodos([{ text: 'a', done: false }], path);

    expect(await loadTodos(path)).toEqual([{ text: 'a', done: false }]);
  });

  it('a later save fully replaces the file rather than appending', async () => {
    const path = join(dir, 'todo.md');

    await saveTodos([{ text: 'first', done: false }], path);
    await saveTodos([{ text: 'second', done: false }], path);

    expect(await loadTodos(path)).toEqual([{ text: 'second', done: false }]);
  });
});
