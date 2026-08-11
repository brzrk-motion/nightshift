import { type IncomingMessage, type ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';

import { ideOriginValidation } from './httpGuards.js';

function mockResponse(): ServerResponse & { status?: number; body?: string } {
  const response = {
    status: undefined as number | undefined,
    body: undefined as string | undefined,
    writeHead(status: number, _headers: Record<string, string>) {
      this.status = status;
    },
    end(body: string) {
      this.body = body;
    },
  };
  return response as unknown as ServerResponse & { status?: number; body?: string };
}

function check(origin: string | undefined): { ok: boolean; status?: number } {
  const validate = ideOriginValidation();
  const request = { headers: { origin } } as IncomingMessage;
  const response = mockResponse();
  const ok = validate(request, response);
  const result: { ok: boolean; status?: number } = { ok };
  if (response.status !== undefined) {
    result.status = response.status;
  }
  return result;
}

describe('ideOriginValidation', () => {
  it('allows requests with no Origin header', () => {
    expect(check(undefined)).toEqual({ ok: true, status: undefined });
  });

  it('allows localhost http origins', () => {
    expect(check('http://127.0.0.1')).toEqual({ ok: true, status: undefined });
    expect(check('http://localhost:7411')).toEqual({ ok: true, status: undefined });
  });

  it('allows Cursor and VS Code desktop origins', () => {
    expect(check('vscode-file://vscode-app')).toEqual({ ok: true, status: undefined });
    expect(check('cursor://anysphere.cursor-mcp')).toEqual({ ok: true, status: undefined });
    expect(check('null')).toEqual({ ok: true, status: undefined });
  });

  it('rejects remote origins', () => {
    const result = check('https://evil.example');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });
});
