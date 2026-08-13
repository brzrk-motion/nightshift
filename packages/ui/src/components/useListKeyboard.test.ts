import { describe, expect, it } from 'vitest';
import {
  clampListSelection,
  handleListNavigationKey,
  moveListSelection,
} from './useListKeyboard.js';

describe('clampListSelection', () => {
  it('clamps to zero when empty', () => {
    expect(clampListSelection(3, 0)).toBe(0);
  });

  it('clamps high indices', () => {
    expect(clampListSelection(5, 3)).toBe(2);
  });
});

describe('moveListSelection', () => {
  it('does not move below zero', () => {
    expect(moveListSelection(0, 5, -1)).toBe(0);
  });

  it('does not move past the last row', () => {
    expect(moveListSelection(4, 5, 1)).toBe(4);
  });
});

describe('handleListNavigationKey', () => {
  it('maps j/k and arrow keys to selection changes', () => {
    expect(handleListNavigationKey('j', {}, 5, 1, {})?.selectedIndex).toBe(2);
    expect(handleListNavigationKey('k', {}, 5, 1, {})?.selectedIndex).toBe(0);
    expect(handleListNavigationKey('down', {}, 5, 1, {})?.selectedIndex).toBe(2);
    expect(handleListNavigationKey('up', {}, 5, 1, {})?.selectedIndex).toBe(0);
  });

  it('fires activate, edit, and add actions', () => {
    expect(handleListNavigationKey('return', {}, 3, 0, { onActivate: () => {} })?.action).toBe(
      'activate',
    );
    expect(handleListNavigationKey('e', {}, 3, 0, { onEdit: () => {} })?.action).toBe('edit');
    expect(handleListNavigationKey('a', {}, 3, 0, { onAdd: () => {} })?.action).toBe('add');
  });

  it('ignores ctrl/meta+a', () => {
    expect(handleListNavigationKey('a', { ctrl: true }, 3, 0, { onAdd: () => {} })).toBeNull();
    expect(handleListNavigationKey('a', { meta: true }, 3, 0, { onAdd: () => {} })).toBeNull();
  });
});
