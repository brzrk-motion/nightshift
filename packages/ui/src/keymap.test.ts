import { describe, expect, it } from 'vitest';
import {
  createKeymap,
  DEFAULT_KEYBINDINGS,
  formatChord,
  matchesChord,
  parseChord,
} from './keymap.js';

describe('parseChord', () => {
  it('parses a plain key', () => {
    expect(parseChord('p')).toEqual({
      key: 'p',
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    });
  });

  it('parses modifiers in any order and spelling', () => {
    expect(parseChord('ctrl+alt+k')).toMatchObject({ key: 'k', ctrl: true, alt: true });
    expect(parseChord('Control+Option+K')).toMatchObject({ key: 'K', ctrl: true, alt: true });
    expect(parseChord('cmd+s')).toMatchObject({ key: 's', meta: true });
  });

  it('normalises key aliases', () => {
    expect(parseChord('esc').key).toBe('escape');
    expect(parseChord('enter').key).toBe('return');
    expect(parseChord('pgup').key).toBe('pageup');
  });

  it('folds shift into the letter, the way terminals report it', () => {
    expect(parseChord('shift+a')).toMatchObject({ key: 'A', shift: false });
  });

  it('keeps shift as a modifier for named keys', () => {
    expect(parseChord('shift+tab')).toMatchObject({ key: 'tab', shift: true });
  });

  it('takes a trailing plus literally', () => {
    expect(parseChord('ctrl++')).toMatchObject({ key: '+', ctrl: true });
  });

  it.each(['', '   ', 'ctrl+', 'ctrl+a+b'])('rejects %o', (binding) => {
    expect(() => parseChord(binding)).toThrow();
  });

  it('round-trips through formatChord', () => {
    expect(formatChord(parseChord('ctrl+shift+tab'))).toBe('ctrl+shift+tab');
    expect(formatChord(parseChord('esc'))).toBe('escape');
  });
});

describe('matchesChord', () => {
  const chord = parseChord('ctrl+p');

  it('matches the event it was written for', () => {
    expect(matchesChord({ name: 'p', ctrl: true }, chord)).toBe(true);
  });

  it('rejects the same key without the modifier', () => {
    expect(matchesChord({ name: 'p' }, chord)).toBe(false);
  });

  it('rejects a different key', () => {
    expect(matchesChord({ name: 'k', ctrl: true }, chord)).toBe(false);
  });

  it('treats option as alt and super as meta', () => {
    expect(matchesChord({ name: 'k', option: true }, parseChord('alt+k'))).toBe(true);
    expect(matchesChord({ name: 'k', super: true }, parseChord('meta+k'))).toBe(true);
  });

  it('falls back to the raw sequence when there is no key name', () => {
    expect(matchesChord({ sequence: '?' }, parseChord('?'))).toBe(true);
  });

  it('ignores the shift flag for single characters', () => {
    expect(matchesChord({ name: '?', shift: true }, parseChord('?'))).toBe(true);
  });

  it('honours the shift flag for named keys', () => {
    expect(matchesChord({ name: 'tab' }, parseChord('shift+tab'))).toBe(false);
    expect(matchesChord({ name: 'tab', shift: true }, parseChord('shift+tab'))).toBe(true);
  });
});

describe('createKeymap', () => {
  it('resolves a default binding to its command', () => {
    const keymap = createKeymap();
    expect(keymap.resolve({ name: 'p', ctrl: true })?.command).toBe('palette.open');
  });

  it('parses every default binding', () => {
    expect(() => createKeymap(DEFAULT_KEYBINDINGS)).not.toThrow();
  });

  it('returns nothing for an unbound key', () => {
    expect(createKeymap().resolve({ name: 'z' })).toBeUndefined();
  });

  it('ignores a binding whose context is not active', () => {
    const keymap = createKeymap();
    expect(keymap.resolve({ name: 'escape' })).toBeUndefined();
    expect(keymap.resolve({ name: 'escape' }, 'overlay')?.command).toBe('overlay.close');
  });

  it('prefers a context binding over a global one', () => {
    const keymap = createKeymap([
      { binding: 'x', command: 'global' },
      { binding: 'x', command: 'scoped', when: 'overlay' },
    ]);

    expect(keymap.resolve({ name: 'x' })?.command).toBe('global');
    expect(keymap.resolve({ name: 'x' }, 'overlay')?.command).toBe('scoped');
  });

  it('lets a later binding override an earlier one', () => {
    const keymap = createKeymap().extend([{ binding: 'ctrl+p', command: 'custom' }]);
    expect(keymap.resolve({ name: 'p', ctrl: true })?.command).toBe('custom');
  });

  it('lists the bindings for a command', () => {
    expect(
      createKeymap()
        .forCommand('app.quit')
        .map((entry) => entry.binding),
    ).toEqual(['q', 'ctrl+c']);
  });
});
