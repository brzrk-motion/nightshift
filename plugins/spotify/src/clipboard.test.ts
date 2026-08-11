import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOsc52Sequence, copyToClipboard } from './clipboard.js';

describe('buildOsc52Sequence', () => {
  const previousTmux = process.env.TMUX;
  const previousSty = process.env.STY;

  afterEach(() => {
    if (previousTmux === undefined) delete process.env.TMUX;
    else process.env.TMUX = previousTmux;
    if (previousSty === undefined) delete process.env.STY;
    else process.env.STY = previousSty;
  });

  it('encodes the payload as OSC 52 base64', () => {
    delete process.env.TMUX;
    delete process.env.STY;
    const text = 'https://accounts.spotify.com/authorize?x=1';
    const sequence = buildOsc52Sequence(text);
    expect(sequence.startsWith('\x1b]52;c;')).toBe(true);
    expect(sequence.endsWith('\x07')).toBe(true);
    const b64 = sequence.slice('\x1b]52;c;'.length, -1);
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe(text);
  });

  it('wraps the OSC for tmux', () => {
    process.env.TMUX = '1';
    delete process.env.STY;
    const sequence = buildOsc52Sequence('hi');
    expect(sequence.startsWith('\x1bPtmux;\x1b\x1b]52;c;')).toBe(true);
    expect(sequence.endsWith('\x07\x1b\\')).toBe(true);
  });
});

describe('copyToClipboard', () => {
  it('writes the OSC sequence through the supplied writer', () => {
    delete process.env.TMUX;
    delete process.env.STY;
    const write = vi.fn();
    expect(copyToClipboard('hello', write)).toBe(true);
    expect(write).toHaveBeenCalledWith(buildOsc52Sequence('hello'));
  });

  it('returns false when the writer throws', () => {
    expect(
      copyToClipboard('hello', () => {
        throw new Error('no tty');
      }),
    ).toBe(false);
  });
});
