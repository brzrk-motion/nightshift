import type { Scene } from './entity.js';

export interface HaStateRow {
  entity_id?: unknown;
  state?: unknown;
  attributes?: unknown;
}

const SCENE_ID = /^scene\.[a-z0-9_]+$/;

function friendlyName(attributes: unknown, entityId: string): string {
  if (typeof attributes === 'object' && attributes !== null && !Array.isArray(attributes)) {
    const name = (attributes as Record<string, unknown>)['friendly_name'];
    if (typeof name === 'string' && name.trim() !== '') return name.trim();
  }
  return entityId;
}

/** Keep only well-formed scene.* rows; sort by name then entityId. */
export function scenesFromStates(rows: readonly HaStateRow[]): Scene[] {
  const scenes: Scene[] = [];
  for (const row of rows) {
    if (typeof row.entity_id !== 'string' || !SCENE_ID.test(row.entity_id)) continue;
    scenes.push({
      entityId: row.entity_id,
      name: friendlyName(row.attributes, row.entity_id),
      state: typeof row.state === 'string' ? row.state : null,
    });
  }
  scenes.sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return byName !== 0 ? byName : a.entityId.localeCompare(b.entityId);
  });
  return scenes;
}
