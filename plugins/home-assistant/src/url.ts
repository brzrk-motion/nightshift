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

function isIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

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

  // Bare IPv4 without an explicit port → HA default 8123.
  if (
    parsed.port === '' &&
    isIpv4(parsed.hostname) &&
    (parsed.protocol === 'http:' || parsed.protocol === 'https:')
  ) {
    // Only default port for http (local). HTTPS remote IPs keep default 443.
    if (parsed.protocol === 'http:') {
      parsed.port = DEFAULT_PORT;
    }
  }

  // Host without port that isn't IPv4 — for http, still apply 8123 when the
  // user typed a LAN hostname without a scheme (already handled above as
  // http://). Leave https alone (443).
  if (parsed.port === '' && parsed.protocol === 'http:' && !isIpv4(parsed.hostname)) {
    // User wrote "homeassistant.local" → http://homeassistant.local:8123
    parsed.port = DEFAULT_PORT;
  }

  return parsed.origin;
}
