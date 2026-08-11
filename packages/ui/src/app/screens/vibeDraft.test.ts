import { describe, expect, it } from 'vitest';
import {
  draftFromCatalog,
  draftToSaveArgs,
  emptyDraft,
  type VibeCatalogRow,
} from './vibeDraft.js';

const ROW: VibeCatalogRow = {
  name: 'locked-in',
  title: 'Locked In',
  description: 'Deep work.',
  theme: 'midnight',
  dashboard: 'home',
  source: 'built-in',
  active: true,
  entities: { 'timer.focus': { status: 'idle' } },
  onActivate: [{ command: 'focus.start', args: { minutes: 50 } }],
  onDeactivate: [{ command: 'focus.pause' }],
};

describe('draftFromCatalog', () => {
  it('preserves entities and expands actions', () => {
    const draft = draftFromCatalog(ROW);
    expect(draft.entities).toEqual({ 'timer.focus': { status: 'idle' } });
    expect(draft.onActivate).toEqual([
      { command: 'focus.start', args: '{"minutes":50}' },
    ]);
    expect(draft.onDeactivate).toEqual([{ command: 'focus.pause', args: '' }]);
  });
});

describe('draftToSaveArgs', () => {
  it('omits blank optionals and parses args JSON', () => {
    const draft = draftFromCatalog(ROW);
    draft.title = 'Locked In';
    draft.description = '';
    expect(draftToSaveArgs(draft)).toEqual({
      name: 'locked-in',
      title: 'Locked In',
      theme: 'midnight',
      dashboard: 'home',
      entities: { 'timer.focus': { status: 'idle' } },
      onActivate: [{ command: 'focus.start', args: { minutes: 50 } }],
      onDeactivate: [{ command: 'focus.pause' }],
    });
  });

  it('rejects malformed action args', () => {
    const draft = emptyDraft();
    draft.name = 'quiet';
    draft.onActivate = [{ command: 'focus.start', args: 'not-json' }];
    expect(() => draftToSaveArgs(draft)).toThrowError(/onActivate\[0\] args/);
  });

  it('skips blank command rows', () => {
    const draft = emptyDraft();
    draft.name = 'quiet';
    draft.onActivate = [
      { command: '', args: '' },
      { command: 'focus.pause', args: '' },
    ];
    expect(draftToSaveArgs(draft)).toEqual({
      name: 'quiet',
      onActivate: [{ command: 'focus.pause' }],
    });
  });
});
