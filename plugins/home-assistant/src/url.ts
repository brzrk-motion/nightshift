/**
 * Normalize a user-entered Home Assistant address into an absolute origin.
 * Accepts bare IPv4, `host:port`, or an absolute http(s) URL.
 */

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

const DEFAULT_PORT = '8123';

/**
 * Returns a normalized origin with no trailing slash and no path/query/hash.
 */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new UrlValidationError('Address is required.');
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    // Bare host or host:port — default to http for local HA.
    candidate = `http://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new UrlValidationError(`Invalid address "${input}".`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlValidationError('Address must use http or https.');
  }

  if (!parsed.hostname) {
    throw new UrlValidationError(`Invalid address "${input}".`);
  }

  // HTTP without an explicit port → HA default 8123 (bare IP or hostname).
  // HTTPS is left alone (default 443).
  if (parsed.port === '' && parsed.protocol === 'http:') {
    parsed.port = DEFAULT_PORT;
  }

  return parsed.origin;
}
