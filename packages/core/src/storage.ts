import { isRecord } from './yamlUtils.js';

/**
 * Defensive parse of a versioned storage blob. Unknown version, corrupt shapes,
 * or a failed guard become `null` — never throw.
 */
export function parseStoredVersion<T>(
  value: unknown,
  version: number,
  guard: (record: Record<string, unknown>) => record is Record<string, unknown> & T,
): T | null {
  if (!isRecord(value)) return null;
  if (value['version'] !== version) return null;
  return guard(value) ? value : null;
}
