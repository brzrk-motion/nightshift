import type { PluginFetch, PluginFetchInit } from '@nightshift/sdk';

export class HttpError extends Error {
  readonly status: number;
  readonly body: string;
  readonly reason: string | null;

  constructor(status: number, body: string, message?: string, reason?: string | null) {
    super(message ?? defaultHttpErrorMessage(status, body));
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.reason = reason ?? null;
  }
}

export type HttpErrorMessageFormatter = (status: number, body: string) => string;

function defaultHttpErrorMessage(status: number, body: string): string {
  const trimmed = body.trim();
  return trimmed || `HTTP error (${status})`;
}

export function bearerHeaders(token: string, body?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  };
}

/** Bearer-authenticated fetch with JSON Accept (and Content-Type when a body is sent). */
export async function authorizedFetch(
  fetchFn: PluginFetch,
  token: string,
  url: string,
  init?: PluginFetchInit,
): Promise<Response> {
  return fetchFn(url, {
    ...init,
    headers: {
      ...bearerHeaders(token, init?.body),
      ...init?.headers,
    },
  });
}

export async function httpErrorFromResponse(
  response: Response,
  formatMessage?: HttpErrorMessageFormatter,
): Promise<HttpError> {
  const body = await response.text();
  const message =
    formatMessage?.(response.status, body) ?? defaultHttpErrorMessage(response.status, body);
  return new HttpError(response.status, body, message);
}

/** Treat 204 and 2xx as success; otherwise throw {@link HttpError}. */
export async function ensureOk(
  response: Response,
  formatMessage?: HttpErrorMessageFormatter,
): Promise<void> {
  if (response.status === 204 || response.ok) return;
  throw await httpErrorFromResponse(response, formatMessage);
}
