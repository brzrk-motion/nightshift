import { describe, expect, it } from 'vitest';
import { scenesFromStates } from './scenes.js';

describe('scenesFromStates', () => {
  it('keeps only scene.* entities and drops others', () => {
    const scenes = scenesFromStates([
      { entity_id: 'light.kitchen', state: 'on', attributes: { friendly_name: 'Kitchen' } },
      { entity_id: 'scene.deep_work', state: 'scening', attributes: { friendly_name: 'Deep Work' } },
      { entity_id: 'scene.morning', state: 'scening', attributes: {} },
    ]);
    expect(scenes.map((s) => s.entityId)).toEqual(['scene.deep_work', 'scene.morning']);
  });

  it('falls back to entity_id when friendly_name is missing', () => {
    const scenes = scenesFromStates([{ entity_id: 'scene.xyz', state: 'scening' }]);
    expect(scenes[0]).toEqual({ entityId: 'scene.xyz', name: 'scene.xyz', state: 'scening' });
  });

  it('sorts by friendly name case-insensitively', () => {
    const scenes = scenesFromStates([
      { entity_id: 'scene.b', attributes: { friendly_name: 'Zebra' } },
      { entity_id: 'scene.a', attributes: { friendly_name: 'apple' } },
    ]);
    expect(scenes.map((s) => s.entityId)).toEqual(['scene.a', 'scene.b']);
  });

  it('rejects malformed scene ids', () => {
    expect(scenesFromStates([{ entity_id: 'scene.Bad-Id' }])).toEqual([]);
    expect(scenesFromStates([{ entity_id: 3 }])).toEqual([]);
  });
});
