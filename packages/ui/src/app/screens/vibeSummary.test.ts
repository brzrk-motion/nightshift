import { describe, expect, it } from 'vitest';
import { emptyDraft } from './vibeDraft.js';
import { summariseDraft } from './vibeSummary.js';

describe('summariseDraft', () => {
  it('omits empty optional fields', () => {
    const draft = emptyDraft();
    draft.name = 'quiet';
    draft.title = 'Quiet Hours';
    expect(summariseDraft(draft)).toEqual(['Activates as “Quiet Hours”.']);
  });

  it('mentions theme, dashboard, and commands', () => {
    const draft = emptyDraft();
    draft.theme = 'midnight';
    draft.dashboard = 'home';
    draft.onActivate = [
      { command: 'focus.start', args: '{"minutes":25}' },
      { command: 'focus.pause', args: '' },
    ];
    const lines = summariseDraft(draft);
    expect(lines).toContain('Switches theme to midnight.');
    expect(lines).toContain('Opens the home dashboard.');
    expect(lines.some((line) => line.includes('2 commands'))).toBe(true);
  });

  it('mentions preserved entities', () => {
    const draft = emptyDraft();
    draft.entities = { 'timer.focus': { status: 'idle' } };
    expect(summariseDraft(draft).some((line) => line.includes('1 entity'))).toBe(true);
  });
});
