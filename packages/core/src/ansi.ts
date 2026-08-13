import { styleText } from 'node:util';

export type AnsiFormat = Parameters<typeof styleText>[0];

export interface ShouldUseColorOptions {
  /** Forces colour on or off. When set, env/TTY detection is skipped. */
  override?: boolean;
  /** Stream used for TTY detection. Defaults to `process.stdout`. */
  stream?: NodeJS.WritableStream | null;
}

/** Whether ANSI colour should be used, honouring NO_COLOR, FORCE_COLOR, and TTY. */
export function shouldUseColor(options: ShouldUseColorOptions = {}): boolean {
  const { override, stream = process.stdout } = options;
  if (override !== undefined) return override;
  if (process.env['NO_COLOR'] !== undefined && process.env['NO_COLOR'] !== '') return false;
  if (process.env['FORCE_COLOR'] !== undefined && process.env['FORCE_COLOR'] !== '0') return true;
  if (!stream) return false;
  return (stream as NodeJS.WriteStream).isTTY === true;
}

/** Applies an ANSI style when `enabled`, otherwise returns plain text. */
export function ansi(enabled: boolean, format: AnsiFormat, text: string): string {
  if (!enabled) return text;
  return styleText(format, text, { validateStream: false });
}
