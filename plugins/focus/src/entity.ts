/**
 * Split out from `index.ts` so the widgets module can reference the entity id
 * without importing the plugin's own `setup()` — the two would otherwise form
 * a cycle.
 */
export const FOCUS_ENTITY = 'timer.focus' as const;
