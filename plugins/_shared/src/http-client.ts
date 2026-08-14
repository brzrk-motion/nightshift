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

export type HttpErrorDetails = {
  message: string;
  reason?: string | null;
};

/** Return a message string, or `{ message, reason }` when the API exposes a machine reason. */
export type HttpErrorMessageFormatter = (status: number, body: string) => string | HttpErrorDetails;

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
  if (!formatMessage) {
    return new HttpError(response.status, body);
  }
  const formatted = formatMessage(response.status, body);
  if (typeof formatted === 'string') {
    return new HttpError(response.status, body, formatted);
  }
  return new HttpError(response.status, body, formatted.message, formatted.reason);
}

/** Treat 204 and 2xx as success; otherwise throw {@link HttpError}. */
export async function ensureOk(
  response: Response,
  formatMessage?: HttpErrorMessageFormatter,
): Promise<void> {
  if (response.status === 204 || response.ok) return;
  throw await httpErrorFromResponse(response, formatMessage);
}
