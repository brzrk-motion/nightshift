import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTodoFile } from './file.js';

describe('createTodoFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-todo-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loading a file that does not exist yet returns no todos', async () => {
    const file = createTodoFile(join(dir, 'todo.md'));
    expect(await file.load()).toEqual([]);
  });

  it('saves and reloads the same items', async () => {
    const file = createTodoFile(join(dir, 'todo.md'));
    const items = [
      { text: 'Buy milk', done: false },
      { text: 'Ship the thing', done: true },
    ];

    await file.save(items);

    expect(await file.load()).toEqual(items);
  });

  it('creates parent directories that do not exist yet', async () => {
    const file = createTodoFile(join(dir, 'nested', 'deeper', 'todo.md'));

    await file.save([{ text: 'a', done: false }]);

    expect(await file.load()).toEqual([{ text: 'a', done: false }]);
  });

  it('a later save fully replaces the file rather than appending', async () => {
    const file = createTodoFile(join(dir, 'todo.md'));

    await file.save([{ text: 'first', done: false }]);
    await file.save([{ text: 'second', done: false }]);

    expect(await file.load()).toEqual([{ text: 'second', done: false }]);
  });
});
