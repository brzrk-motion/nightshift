import { type IncomingMessage, type ServerResponse } from 'node:http';

import { localhostAllowedOrigins, validateOriginHeader } from '@modelcontextprotocol/server';

/** Desktop MCP clients (Cursor, VS Code) send non-http Origin values. */
function isDesktopClientOrigin(origin: string): boolean {
  return origin === 'null' || origin.startsWith('vscode-file://') || origin.startsWith('cursor://');
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  if (isDesktopClientOrigin(origin)) return true;
  return validateOriginHeader(origin, localhostAllowedOrigins()).ok;
}

function rejectOrigin(response: ServerResponse): void {
  response.writeHead(403, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32_000, message: 'Origin not allowed' },
      id: null,
    }),
  );
}

/**
 * Localhost origin guard that also accepts Cursor and VS Code desktop clients.
 * Host validation still limits the server to loopback; this only widens Origin.
 */
export function ideOriginValidation(): (request: IncomingMessage, response: ServerResponse) => boolean {
  return (request, response) => {
    if (isAllowedOrigin(request.headers.origin)) return true;
    rejectOrigin(response);
    return false;
  };
}
