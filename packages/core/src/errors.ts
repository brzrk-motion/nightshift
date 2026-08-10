/**
 * Every failure Nightshift raises on purpose carries a stable `code`, so the
 * CLI can decide how to present it without string-matching messages.
 */
export type NightshiftErrorCode =
  | 'CONFIG_INVALID'
  | 'CONFIG_UNREADABLE'
  | 'CONFIG_UNWRITABLE'
  | 'DASHBOARD_NOT_FOUND'
  | 'ENTITY_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'PLUGIN_INCOMPATIBLE'
  | 'PLUGIN_INVALID'
  | 'VIBE_NOT_FOUND'
  | 'NOT_IMPLEMENTED';

export interface NightshiftErrorOptions extends ErrorOptions {
  /** A concrete next step for the user, printed under the error by the CLI. */
  hint?: string;
}

export class NightshiftError extends Error {
  override readonly name = 'NightshiftError';
  readonly code: NightshiftErrorCode;
  readonly hint: string | undefined;

  constructor(code: NightshiftErrorCode, message: string, options: NightshiftErrorOptions = {}) {
    super(message, options);
    this.code = code;
    this.hint = options.hint;
  }
}

/** Marks a surface that is scaffolded but lands in a later phase. */
export function notImplemented(feature: string, phase: string): never {
  throw new NightshiftError('NOT_IMPLEMENTED', `${feature} is not implemented yet.`, {
    hint: `Scheduled for ${phase} of the Nightshift roadmap.`,
  });
}

export function isNightshiftError(value: unknown): value is NightshiftError {
  return value instanceof NightshiftError;
}
