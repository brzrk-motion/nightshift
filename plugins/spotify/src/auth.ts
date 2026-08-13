import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { PluginFetch } from '@nightshift/sdk';
import {
  SPOTIFY_CALLBACK_PORT,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  type SpotifyStoredAuth,
} from './entity.js';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

/** Base64url without padding (RFC 7636). */
export function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

export function generateState(): string {
  return base64Url(randomBytes(16));
}

export function codeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

export function buildAuthorizeUrl(clientId: string, state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

export async function exchangeAuthorizationCode(
  fetchFn: PluginFetch,
  params: {
    clientId: string;
    clientSecret: string;
    code: string;
    codeVerifier: string;
  },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });

  const response = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.clientId, params.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  return (await response.json()) as TokenResponse;
}

export async function refreshAccessToken(
  fetchFn: PluginFetch,
  params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  });

  const response = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(params.clientId, params.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  return (await response.json()) as TokenResponse;
}

export function applyTokenResponse(
  stored: SpotifyStoredAuth,
  tokens: TokenResponse,
  now = Date.now(),
): SpotifyStoredAuth {
  return {
    ...stored,
    accessToken: tokens.access_token,
    expiresAt: now + tokens.expires_in * 1000,
    ...(tokens.refresh_token === undefined ? {} : { refreshToken: tokens.refresh_token }),
  };
}

/** Access token with a 60s skew buffer; refreshes when missing or near expiry. */
export async function ensureAccessToken(
  fetchFn: PluginFetch,
  stored: SpotifyStoredAuth,
  now = Date.now(),
): Promise<{ token: string; stored: SpotifyStoredAuth }> {
  const skewMs = 60_000;
  if (
    stored.accessToken &&
    typeof stored.expiresAt === 'number' &&
    stored.expiresAt - skewMs > now
  ) {
    return { token: stored.accessToken, stored };
  }

  if (!stored.refreshToken) {
    throw new Error('Not connected to Spotify — run Connect first.');
  }

  const tokens = await refreshAccessToken(fetchFn, {
    clientId: stored.clientId,
    clientSecret: stored.clientSecret,
    refreshToken: stored.refreshToken,
  });
  const next = applyTokenResponse(stored, tokens, now);
  return { token: next.accessToken!, stored: next };
}

export interface AuthCallbackResult {
  code: string;
  state: string;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

/** Landing page that always gives the browser a real link, not only a Location header. */
export function loginRedirectHtml(authorizeUrl: string): string {
  const href = escapeHtmlAttr(authorizeUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${href}" />
  <title>Redirecting to Spotify</title>
</head>
<body>
  <p>Redirecting to Spotify…</p>
  <p><a href="${href}">Continue to Spotify</a></p>
  <script>location.replace(${JSON.stringify(authorizeUrl)});</script>
</body>
</html>`;
}

/**
 * Pull `code` + `state` out of a pasted Spotify redirect URL (or query string).
 * After authorize, the browser address bar still has these even when localhost
 * cannot connect (typical over SSH).
 */
export function parseAuthRedirect(input: string): AuthCallbackResult | undefined {
  const trimmed = input.trim();
  if (trimmed === '') return undefined;

  const fromParams = (params: URLSearchParams): AuthCallbackResult | undefined => {
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return undefined;
    return { code, state };
  };

  try {
    if (/^https?:\/\//iu.test(trimmed) || trimmed.startsWith('http://127.0.0.1')) {
      return fromParams(new URL(trimmed).searchParams);
    }
  } catch {
    // fall through
  }

  const query = trimmed.includes('?') ? trimmed.slice(trimmed.indexOf('?') + 1) : trimmed;
  if (query.includes('code=') && query.includes('state=')) {
    return fromParams(new URLSearchParams(query));
  }

  return undefined;
}

export interface AuthWaiter {
  authorizeUrl: string;
  /** Resolves with the OAuth code from loopback or a pasted redirect. */
  result: Promise<AuthCallbackResult>;
  /** Accept a pasted callback URL / query string. Returns false if invalid. */
  submitRedirect(input: string): boolean;
  /** Stop the loopback server (if any) without resolving. */
  dispose(): void;
  /** Bound loopback port when listening; null when loopback is disabled or failed. */
  boundPort(): number | null;
}

/**
 * Wait for a Spotify auth code via:
 * 1. optional loopback server on 127.0.0.1 (same-machine browsers), and/or
 * 2. `submitRedirect()` with the URL from the browser address bar (SSH / remote).
 */
export function createAuthWaiter(options: {
  expectedState: string;
  authorizeUrl: string;
  timeoutMs?: number;
  /** Defaults to the fixed Nightshift Spotify port; pass `0` for an ephemeral test port. */
  port?: number;
  /** When false, only the paste path is available (useful in tests). */
  enableLoopback?: boolean;
}): AuthWaiter {
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const listenPort = options.port ?? SPOTIFY_CALLBACK_PORT;
  const enableLoopback = options.enableLoopback !== false;

  let settled = false;
  let server: Server | undefined;
  let boundPort: number | null = null;
  let resolveResult!: (value: AuthCallbackResult) => void;
  let rejectResult!: (error: Error) => void;

  const result = new Promise<AuthCallbackResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const timer = setTimeout(() => {
    finish(new Error('Timed out waiting for Spotify authorization.'));
  }, timeoutMs);
  timer.unref?.();

  const finish = (error: Error | null, payload?: AuthCallbackResult): void => {
    if (settled) return;
    settled = true;
    if (timer !== undefined) clearTimeout(timer);
    const close = (): void => {
      if (error) rejectResult(error);
      else if (payload) resolveResult(payload);
      else rejectResult(new Error('Auth callback closed without a result.'));
    };
    if (server) {
      server.close(() => close());
      server = undefined;
    } else {
      close();
    }
  };

  const submitRedirect = (input: string): boolean => {
    const parsed = parseAuthRedirect(input);
    if (!parsed) return false;
    if (parsed.state !== options.expectedState) {
      finish(new Error('Auth callback state mismatch — press Connect and try again.'));
      return true;
    }
    finish(null, parsed);
    return true;
  };

  if (enableLoopback) {
    const respond = (res: ServerResponse, status: number, body: string): void => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(body);
    };

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      try {
        const host = req.headers.host ?? `127.0.0.1:${listenPort}`;
        const url = new URL(req.url ?? '/', `http://${host}`);
        const path = url.pathname.replace(/\/+$/u, '') || '/';

        if (path === '/login' || path === '/') {
          res.writeHead(302, {
            Location: options.authorizeUrl,
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(loginRedirectHtml(options.authorizeUrl));
          return;
        }

        if (path !== '/callback') {
          respond(res, 404, '<html><body>Not found.</body></html>');
          return;
        }

        const error = url.searchParams.get('error');
        if (error) {
          respond(
            res,
            400,
            `<html><body><h1>Authorization failed</h1><p>${error}</p><p>You can close this tab.</p></body></html>`,
          );
          finish(new Error(`Spotify authorization denied: ${error}`));
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) {
          respond(res, 400, '<html><body><h1>Missing code or state.</h1></body></html>');
          finish(new Error('Auth callback missing code or state.'));
          return;
        }
        if (state !== options.expectedState) {
          respond(res, 400, '<html><body><h1>Invalid state.</h1></body></html>');
          finish(new Error('Auth callback state mismatch.'));
          return;
        }

        respond(
          res,
          200,
          '<html><body><h1>Connected to Nightshift</h1><p>You can close this tab and return to the terminal.</p></body></html>',
        );
        finish(null, { code, state });
      } catch (err) {
        respond(res, 500, '<html><body><h1>Error</h1></body></html>');
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });

    server.on('error', () => {
      // Loopback is best-effort — paste still works over SSH / when the port is busy.
      if (server) {
        try {
          server.close();
        } catch {
          // ignore
        }
        server = undefined;
      }
      boundPort = null;
    });

    server.listen(listenPort, '127.0.0.1', () => {
      const address = server?.address();
      boundPort = typeof address === 'object' && address !== null ? address.port : listenPort;
    });
  }

  return {
    authorizeUrl: options.authorizeUrl,
    result,
    submitRedirect,
    boundPort: () => boundPort,
    dispose: () => {
      if (!settled) finish(new Error('Spotify connect cancelled.'));
    },
  };
}

export interface StartConnectResult {
  /** Spotify authorize URL to open in a browser (works over SSH). */
  authUrl: string;
  /** Completes when the user finishes (or fails) the browser flow. */
  completed: Promise<SpotifyStoredAuth>;
  submitRedirect(input: string): boolean;
  dispose(): void;
}

/** Kick off PKCE authorize; resolve via loopback callback and/or pasted redirect URL. */
export function startConnectFlow(
  fetchFn: PluginFetch,
  stored: SpotifyStoredAuth,
): StartConnectResult {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = codeChallenge(verifier);
  const authorizeUrl = buildAuthorizeUrl(stored.clientId, state, challenge);

  const waiter = createAuthWaiter({
    expectedState: state,
    authorizeUrl,
  });

  const completed = waiter.result.then(async ({ code }) => {
    const tokens = await exchangeAuthorizationCode(fetchFn, {
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
      code,
      codeVerifier: verifier,
    });
    return applyTokenResponse(stored, tokens);
  });

  return {
    authUrl: authorizeUrl,
    completed,
    submitRedirect: waiter.submitRedirect,
    dispose: waiter.dispose,
  };
}
