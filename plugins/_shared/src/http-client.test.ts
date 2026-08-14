import { describe, expect, it, vi } from 'vitest';
import {
  authorizedFetch,
  bearerHeaders,
  ensureOk,
  HttpError,
  httpErrorFromResponse,
} from './http-client.js';

describe('bearerHeaders', () => {
  it('adds Authorization and Accept', () => {
    expect(bearerHeaders('tok')).toEqual({
      Authorization: 'Bearer tok',
      Accept: 'application/json',
    });
  });

  it('adds Content-Type when a body is present', () => {
    expect(bearerHeaders('tok', '{}')).toEqual({
      Authorization: 'Bearer tok',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });
});

describe('authorizedFetch', () => {
  it('merges bearer headers with init', async () => {
    const fetchFn = vi.fn(async () => new Response('ok', { status: 200 }));
    await authorizedFetch(fetchFn, 'tok', 'https://api.example/v1/foo', {
      method: 'POST',
      body: '{"x":1}',
      headers: { 'X-Custom': 'yes' },
    });
    expect(fetchFn).toHaveBeenCalledWith('https://api.example/v1/foo', {
      method: 'POST',
      body: '{"x":1}',
      headers: {
        Authorization: 'Bearer tok',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Custom': 'yes',
      },
    });
  });
});

describe('ensureOk', () => {
  it('accepts 2xx and 204', async () => {
    await expect(ensureOk(new Response(null, { status: 204 }))).resolves.toBeUndefined();
    await expect(ensureOk(new Response('ok', { status: 200 }))).resolves.toBeUndefined();
  });

  it('throws HttpError for other statuses', async () => {
    await expect(ensureOk(new Response('nope', { status: 500 }))).rejects.toBeInstanceOf(HttpError);
  });

  it('preserves a formatter reason on thrown errors', async () => {
    await expect(
      ensureOk(new Response('{"error":{"reason":"NO_ACTIVE_DEVICE"}}', { status: 404 }), () => ({
        message: 'hint',
        reason: 'NO_ACTIVE_DEVICE',
      })),
    ).rejects.toMatchObject({
      status: 404,
      message: 'hint',
      reason: 'NO_ACTIVE_DEVICE',
    });
  });
});

describe('httpErrorFromResponse', () => {
  it('uses a custom formatter when provided', async () => {
    const error = await httpErrorFromResponse(
      new Response('bad token', { status: 401 }),
      (status) => (status === 401 ? 'Invalid token' : 'fail'),
    );
    expect(error).toMatchObject({ status: 401, message: 'Invalid token', body: 'bad token' });
  });

  it('accepts structured formatter results with reason', async () => {
    const error = await httpErrorFromResponse(new Response('body', { status: 404 }), () => ({
      message: 'No device',
      reason: 'NO_ACTIVE_DEVICE',
    }));
    expect(error).toMatchObject({
      status: 404,
      message: 'No device',
      reason: 'NO_ACTIVE_DEVICE',
      body: 'body',
    });
  });
});
