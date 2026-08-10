import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TodoItem } from './entity.js';
import { parseTodoMarkdown, serializeTodoMarkdown } from './markdown.js';

/**
 * There is no backend here — `todo.md` in the user's home directory *is* the
 * database, in the format a person would write by hand. Nightshift's other
 * per-plugin state lives in an opaque JSON file under the data directory
 * (`context.storage`, see `@nightshift/services`), which is the right place
 * for state nothing but the plugin should ever read; a todo list is the
 * opposite of that, so this plugin manages its own plain-text file directly
 * rather than going through it.
 */
export const DEFAULT_TODO_PATH = join(homedir(), 'todo.md');

export interface TodoFile {
  /** The file does not exist yet on a fresh install; that reads as no todos. */
  load(): Promise<TodoItem[]>;
  save(items: readonly TodoItem[]): Promise<void>;
}

export function createTodoFile(path: string = DEFAULT_TODO_PATH): TodoFile {
  return {
    async load() {
      try {
        return parseTodoMarkdown(await readFile(path, 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
    },

    async save(items) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, serializeTodoMarkdown(items), 'utf8');
    },
  };
}
