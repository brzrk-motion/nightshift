/**
 * Which URLs `PluginContext.fetch` may call.
 * HTTPS is always fine; HTTP is limited to loopback / RFC1918 private IPv4.
 */

export function isLoopbackOrPrivateHttpHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;

  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return false;
  const octets = parts.map(Number);
  if (octets.some((n) => n > 255)) return false;

  const [a = 0, b = 0] = octets;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** True when the parsed URL is allowed for plugin fetch. */
export function isAllowedPluginFetchUrl(parsed: URL): boolean {
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:') return isLoopbackOrPrivateHttpHost(parsed.hostname);
  return false;
}
