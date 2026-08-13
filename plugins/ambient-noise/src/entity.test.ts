import { describe, expect, it } from 'vitest';
import { initialPlayerState, selectClip } from './entity.js';

describe('selectClip', () => {
  const clips = [
    { id: 'gone', name: 'Gone', status: 'unavailable' as const },
    { id: 'rainy-day', name: 'Rainy Day', status: 'ok' as const },
  ];

  it('returns an ok id match', () => {
    expect(selectClip(clips, 'rainy-day')?.id).toBe('rainy-day');
  });

  it('falls through to the next ok clip when the stored id is unavailable', () => {
    expect(selectClip(clips, 'gone')?.id).toBe('rainy-day');
  });

  it('falls through when the stored id is missing', () => {
    expect(selectClip(clips, 'does-not-exist')?.id).toBe('rainy-day');
  });
});

describe('initialPlayerState', () => {
  it('starts paused on a healthy clip when the stored id is unavailable', () => {
    const state = initialPlayerState(
      [
        { id: 'gone', name: 'Gone', status: 'unavailable' },
        { id: 'rainy-day', name: 'Rainy Day', status: 'ok' },
      ],
      'gone',
    );
    expect(state.status).toBe('paused');
    expect(state.currentClipId).toBe('rainy-day');
    expect(state.currentName).toBe('Rainy Day');
  });
});
