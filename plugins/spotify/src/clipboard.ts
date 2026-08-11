import { closeSync, openSync, writeSync } from 'node:fs';

/** OSC 52 sequence that asks the terminal to put `text` on the system clipboard. */
export function buildOsc52Sequence(text: string): string {
  const base64 = Buffer.from(text, 'utf8').toString('base64');
  const osc52 = `\x1b]52;c;${base64}\x07`;
  // tmux / screen need a DCS wrap so the outer terminal sees the OSC.
  if (process.env.TMUX || process.env.STY) {
    return `\x1bPtmux;\x1b${osc52}\x1b\\`;
  }
  return osc52;
}

export type ClipboardWriter = (sequence: string) => void;

function writeViaTty(sequence: string): void {
  const ttyPath = process.env.SSH_TTY || '/dev/tty';
  try {
    const fd = openSync(ttyPath, 'w');
    try {
      writeSync(fd, sequence);
    } finally {
      closeSync(fd);
    }
  } catch {
    process.stdout.write(sequence);
  }
}

/** Copy `text` via OSC 52 (works over SSH). Returns false if the write failed. */
export function copyToClipboard(text: string, write: ClipboardWriter = writeViaTty): boolean {
  try {
    write(buildOsc52Sequence(text));
    return true;
  } catch {
    return false;
  }
}
