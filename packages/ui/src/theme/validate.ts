/** Validates a single hex color field while typing. */
export function isValidHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/.test(value.trim());
}
