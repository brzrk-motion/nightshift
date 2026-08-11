import { describe, expect, it } from 'vitest';
import {
  applyTokenResponse,
  base64Url,
  buildAuthorizeUrl,
  codeChallenge,
  createAuthWaiter,
  generateCodeVerifier,
  generateState,
  loginRedirectHtml,
  parseAuthRedirect,
} from './auth.js';
import {
  SPOTIFY_LOGIN_URI,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_SCOPES,
  isSpotifyStoredAuth,
  sessionFromStored,
} from './entity.js';

describe('PKCE helpers', () => {
  it('base64Url strips padding and uses url-safe alphabet', () => {
    expect(base64Url(Buffer.from([0xff, 0xee, 0xdd]))).toBe('_-7d');
  });

  it('generateCodeVerifier returns a non-empty url-safe string', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThan(20);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('codeChallenge is deterministic for a verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(codeChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('generateState returns a unique-looking token', () => {
    expect(generateState()).not.toEqual(generateState());
  });
});

describe('buildAuthorizeUrl', () => {
  it('includes client id, PKCE, scopes and the fixed redirect', () => {
    const url = new URL(buildAuthorizeUrl('cid', 'st', 'ch'));
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('code_challenge')).toBe('ch');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe(SPOTIFY_REDIRECT_URI);
    expect(url.searchParams.get('scope')).toBe(SPOTIFY_SCOPES.join(' '));
  });
});

describe('short login URI', () => {
  it('stays short enough that the terminal will not wrap it', () => {
    expect(SPOTIFY_LOGIN_URI).toBe('http://127.0.0.1:43891/login');
    expect(SPOTIFY_LOGIN_URI.length).toBeLessThan(40);
  });
});

describe('loginRedirectHtml', () => {
  it('embeds the authorize URL as a clickable link', () => {
    const html = loginRedirectHtml('https://accounts.spotify.com/authorize?x=1&y=2');
    expect(html).toContain('href="https://accounts.spotify.com/authorize?x=1&amp;y=2"');
    expect(html).toContain('Continue to Spotify');
  });
});

describe('parseAuthRedirect', () => {
  it('parses a full callback URL', () => {
    expect(parseAuthRedirect('http://127.0.0.1:43891/callback?code=abc&state=xyz')).toEqual({
      code: 'abc',
      state: 'xyz',
    });
  });

  it('parses a bare query string', () => {
    expect(parseAuthRedirect('code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('returns undefined for garbage', () => {
    expect(parseAuthRedirect('not a url')).toBeUndefined();
    expect(parseAuthRedirect('')).toBeUndefined();
  });
});

describe('createAuthWaiter paste path', () => {
  it('resolves when a matching redirect URL is submitted', async () => {
    const authorizeUrl = buildAuthorizeUrl('cid', 'state-token', 'challenge');
    const waiter = createAuthWaiter({
      expectedState: 'state-token',
      authorizeUrl,
      enableLoopback: false,
      timeoutMs: 5_000,
    });

    expect(
      waiter.submitRedirect('http://127.0.0.1:43891/callback?code=from-paste&state=state-token'),
    ).toBe(true);
    await expect(waiter.result).resolves.toEqual({
      code: 'from-paste',
      state: 'state-token',
    });
  });

  it('rejects a mismatched state', async () => {
    const waiter = createAuthWaiter({
      expectedState: 'expected',
      authorizeUrl: 'https://example.com',
      enableLoopback: false,
      timeoutMs: 5_000,
    });
    expect(waiter.submitRedirect('http://127.0.0.1:43891/callback?code=x&state=wrong')).toBe(true);
    await expect(waiter.result).rejects.toThrow(/state mismatch/i);
  });
});

describe('createAuthWaiter loopback', () => {
  it('accepts a /callback hit on an ephemeral port', async () => {
    const authorizeUrl = buildAuthorizeUrl('cid', 'state-token', 'challenge');
    const waiter = createAuthWaiter({
      expectedState: 'state-token',
      authorizeUrl,
      timeoutMs: 5_000,
      port: 0,
    });

    let port: number | null = null;
    for (let i = 0; i < 40; i += 1) {
      port = waiter.boundPort();
      if (port !== null) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(port).not.toBeNull();

    const login = await fetch(`http://127.0.0.1:${port}/login`, { redirect: 'manual' });
    expect(login.status).toBe(302);
    expect(login.headers.get('location')).toBe(authorizeUrl);

    const callback = new URL(`http://127.0.0.1:${port}/callback`);
    callback.searchParams.set('code', 'loop-code');
    callback.searchParams.set('state', 'state-token');
    const done = await fetch(callback);
    expect(done.status).toBe(200);
    await expect(waiter.result).resolves.toEqual({ code: 'loop-code', state: 'state-token' });
  });
});

describe('applyTokenResponse', () => {
  it('stores access token, expiry and optional refresh token', () => {
    const next = applyTokenResponse(
      { clientId: 'id', clientSecret: 'secret', refreshToken: 'old' },
      {
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new',
      },
      1_000_000,
    );
    expect(next.accessToken).toBe('access');
    expect(next.refreshToken).toBe('new');
    expect(next.expiresAt).toBe(1_000_000 + 3600 * 1000);
  });

  it('keeps the previous refresh token when Spotify omits one', () => {
    const next = applyTokenResponse(
      { clientId: 'id', clientSecret: 'secret', refreshToken: 'keep' },
      { access_token: 'access', token_type: 'Bearer', expires_in: 60 },
      0,
    );
    expect(next.refreshToken).toBe('keep');
  });
});

describe('sessionFromStored', () => {
  it('maps missing storage to needs_credentials', () => {
    expect(sessionFromStored(undefined).status).toBe('needs_credentials');
  });

  it('maps credentials without refresh to needs_auth', () => {
    expect(sessionFromStored({ clientId: 'a', clientSecret: 'b' }).status).toBe('needs_auth');
  });

  it('maps a refresh token to ready', () => {
    const session = sessionFromStored({
      clientId: 'a',
      clientSecret: 'b',
      refreshToken: 'r',
      userDisplayName: 'Ada',
    });
    expect(session.status).toBe('ready');
    expect(session.userDisplayName).toBe('Ada');
  });
});

describe('isSpotifyStoredAuth', () => {
  it('accepts objects with non-empty client id and secret', () => {
    expect(isSpotifyStoredAuth({ clientId: 'x', clientSecret: 'y' })).toBe(true);
    expect(isSpotifyStoredAuth({ clientId: '', clientSecret: 'y' })).toBe(false);
    expect(isSpotifyStoredAuth(null)).toBe(false);
  });
});
