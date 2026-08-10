import { NightshiftError } from '@nightshift/core';

/**
 * Keyboard shortcuts. Bindings are written the way people write them —
 * `ctrl+p`, `shift+tab`, `?` — parsed once into a normalised shape, and then
 * matched against the key events OpenTUI delivers.
 */
export interface KeyChord {
  /** Lower-case key name, e.g. `p`, `escape`, `tab`, `f1`. */
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/** The shape of a key event, kept structural so it matches OpenTUI's. */
export interface KeyEventLike {
  name?: string | undefined;
  sequence?: string | undefined;
  ctrl?: boolean | undefined;
  shift?: boolean | undefined;
  alt?: boolean | undefined;
  meta?: boolean | undefined;
  option?: boolean | undefined;
  super?: boolean | undefined;
}

const MODIFIERS: Record<string, keyof Omit<KeyChord, 'key'>> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  shift: 'shift',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
};

/** Names people write one way and terminals report another. */
const ALIASES: Record<string, string> = {
  esc: 'escape',
  del: 'delete',
  ins: 'insert',
  pgup: 'pageup',
  pgdn: 'pagedown',
  spacebar: 'space',
  ' ': 'space',
  enter: 'return',
  cr: 'return',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
};

/**
 * Named keys are case-insensitive; single characters are not, because an
 * authored `A` means the shifted letter.
 */
function normaliseKey(key: string): string {
  if (key.length === 1) return ALIASES[key] ?? key;
  const lower = key.toLowerCase();
  return ALIASES[lower] ?? lower;
}

/**
 * Parses `ctrl+shift+p` into a chord. `+` is both the separator and a key, so
 * a binding ending in `++` — or consisting of a lone `+` — binds the plus key.
 */
export function parseChord(binding: string): KeyChord {
  const trimmed = binding.trim();
  if (trimmed === '') {
    throw new NightshiftError('CONFIG_INVALID', 'A key binding cannot be empty.');
  }

  const plusIsKey = trimmed === '+' || trimmed.endsWith('++');
  const body = plusIsKey ? trimmed.slice(0, -1) : trimmed;
  const parts = body === '' ? [] : body.split('+');
  const chord: KeyChord = { key: '', ctrl: false, shift: false, alt: false, meta: false };

  for (const [index, raw] of parts.entries()) {
    const part = raw.trim();
    const modifier = MODIFIERS[part.toLowerCase()];
    // The last part is the key unless the plus itself is the key, in which
    // case every part is a modifier.
    if (modifier !== undefined && (plusIsKey || index < parts.length - 1)) {
      chord[modifier] = true;
      continue;
    }
    if (chord.key !== '') {
      throw new NightshiftError('CONFIG_INVALID', `"${binding}" names more than one key.`);
    }
    chord.key = normaliseKey(part);
  }

  if (plusIsKey) chord.key = '+';

  if (chord.key === '') {
    throw new NightshiftError('CONFIG_INVALID', `"${binding}" does not name a key.`, {
      hint: 'Bindings look like `ctrl+p`, `shift+tab` or `?`.',
    });
  }

  // Terminals report shifted letters as the upper-case letter with no shift
  // flag, so an authored `shift+a` and an authored `A` have to normalise the
  // same way. Everything else keeps shift as a modifier.
  if (chord.shift && chord.key.length === 1 && /[a-z]/.test(chord.key)) {
    chord.shift = false;
    chord.key = chord.key.toUpperCase();
  }

  return chord;
}

/** Renders a chord back to its canonical string, for help text. */
export function formatChord(chord: KeyChord): string {
  const parts: string[] = [];
  if (chord.ctrl) parts.push('ctrl');
  if (chord.alt) parts.push('alt');
  if (chord.shift) parts.push('shift');
  if (chord.meta) parts.push('meta');
  parts.push(chord.key);
  return parts.join('+');
}

/** Shift+Tab arrives as its own escape sequence, with no shift flag set. */
const BACK_TAB = '\u001b[Z';

/** Normalises a key event into the same shape `parseChord` produces. */
export function eventChord(event: KeyEventLike): KeyChord {
  if (event.sequence === BACK_TAB) {
    return { key: 'tab', ctrl: false, shift: true, alt: false, meta: false };
  }
  return {
    key: normaliseKey(event.name ?? event.sequence ?? ''),
    ctrl: event.ctrl ?? false,
    shift: event.shift ?? false,
    alt: event.alt ?? event.option ?? false,
    meta: event.meta ?? event.super ?? false,
  };
}

export function matchesChord(event: KeyEventLike, chord: KeyChord): boolean {
  const actual = eventChord(event);
  return (
    actual.key === chord.key &&
    actual.ctrl === chord.ctrl &&
    actual.alt === chord.alt &&
    actual.meta === chord.meta &&
    // Shift is only meaningful for keys that have no shifted character of
    // their own; for those the terminal reports the character instead.
    (chord.key.length === 1 || actual.shift === chord.shift)
  );
}

export interface KeyBinding {
  /** Binding as authored, e.g. `ctrl+p`. */
  binding: string;
  /** Command id to run. */
  command: string;
  /** Shown in the help panel; falls back to the command's own title. */
  description?: string;
  /** Only active in this context, e.g. `palette`. Omit for global. */
  when?: string;
}

export interface ResolvedBinding extends KeyBinding {
  chord: KeyChord;
}

export interface Keymap {
  bindings: readonly ResolvedBinding[];
  /** The command bound to this event in this context, if any. */
  resolve(event: KeyEventLike, context?: string): ResolvedBinding | undefined;
  /** The bindings that would run a command, for help text. */
  forCommand(command: string): ResolvedBinding[];
  /** A keymap with extra bindings layered on top; later ones win. */
  extend(bindings: readonly KeyBinding[]): Keymap;
}

/** What Nightshift ships with. Plugins and settings layer on top. */
export const DEFAULT_KEYBINDINGS: readonly KeyBinding[] = [
  { binding: 'ctrl+p', command: 'palette.open', description: 'Open the command palette' },
  { binding: ':', command: 'palette.open', description: 'Open the command palette' },
  { binding: '?', command: 'help.toggle', description: 'Show the keyboard shortcuts' },
  { binding: 'ctrl+k', command: 'dashboard.switch', description: 'Switch dashboard' },
  { binding: 'ctrl+r', command: 'dashboard.refresh', description: 'Refresh every widget' },
  { binding: 'tab', command: 'focus.next', description: 'Focus the next widget' },
  { binding: 'shift+tab', command: 'focus.previous', description: 'Focus the previous widget' },
  { binding: 'q', command: 'app.quit', description: 'Quit Nightshift' },
  { binding: 'ctrl+c', command: 'app.quit', description: 'Quit Nightshift' },
  {
    binding: 'escape',
    command: 'overlay.close',
    when: 'overlay',
    description: 'Close the overlay',
  },
];

export function createKeymap(bindings: readonly KeyBinding[] = DEFAULT_KEYBINDINGS): Keymap {
  const resolved: ResolvedBinding[] = bindings.map((binding) => ({
    ...binding,
    chord: parseChord(binding.binding),
  }));

  return {
    bindings: resolved,

    resolve(event, context) {
      // A binding scoped to the active context beats a global one; among
      // equals the last wins, so an override does not have to remove the
      // binding it replaces.
      let best: ResolvedBinding | undefined;
      let bestScore = 0;
      for (const binding of resolved) {
        if (!matchesChord(event, binding.chord)) continue;
        const score = binding.when === undefined ? 1 : binding.when === context ? 2 : 0;
        if (score >= bestScore && score > 0) {
          best = binding;
          bestScore = score;
        }
      }
      return best;
    },

    forCommand(command) {
      return resolved.filter((binding) => binding.command === command);
    },

    extend(extra) {
      return createKeymap([...bindings, ...extra]);
    },
  };
}
