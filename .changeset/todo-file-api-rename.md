---
'@nightshift/plugin-todo': patch
---

Replace the `createTodoFile` factory and `TodoFile` interface with standalone
`loadTodos` and `saveTodos` functions exported from the package entrypoint.

`createTodoFile` and `TodoFile` are removed. Use `loadTodos(path?)` and
`saveTodos(items, path?)` instead. Runtime behavior is unchanged.
