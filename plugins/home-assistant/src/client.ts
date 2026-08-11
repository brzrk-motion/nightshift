import type { PluginFetchInit } from '@nightshift/sdk';
import type { Scene } from './entity.js';
import { scenesFromStates, type HaStateRow } from './scenes.js';

export type HaFetch = (url: string, init?: PluginFetchInit) => Promise<Response>;

export class HomeAssistantApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HomeAssistantApiError';
    this.status = status;
  }
}

function authHeaders(token: string, body?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.text();
  const trimmed = body.trim();
  if (response.status === 401 || response.status === 403) {
    return trimmed || 'Invalid Home Assistant access token.';
  }
  return trimmed || `Home Assistant API error (${response.status})`;
}

/** Lightweight reachability + auth check: GET /api/ */
export async function checkConnection(
  fetchFn: HaFetch,
  baseUrl: string,
  token: string,
): Promise<void> {
  const response = await fetchFn(`${baseUrl}/api/`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new HomeAssistantApiError(response.status, await readErrorMessage(response));
  }
}

/** GET /api/states → scene.* only */
export async function listScenes(
  fetchFn: HaFetch,
  baseUrl: string,
  token: string,
): Promise<Scene[]> {
  const response = await fetchFn(`${baseUrl}/api/states`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new HomeAssistantApiError(response.status, await readErrorMessage(response));
  }
  const json: unknown = await response.json();
  if (!Array.isArray(json)) {
    throw new HomeAssistantApiError(response.status, 'Home Assistant /api/states was not an array.');
  }
  return scenesFromStates(json as HaStateRow[]);
}

/** POST /api/services/scene/turn_on */
export async function activateScene(
  fetchFn: HaFetch,
  baseUrl: string,
  token: string,
  entityId: string,
): Promise<void> {
  const body = JSON.stringify({ entity_id: entityId });
  const response = await fetchFn(`${baseUrl}/api/services/scene/turn_on`, {
    method: 'POST',
    headers: authHeaders(token, body),
    body,
  });
  if (!response.ok) {
    throw new HomeAssistantApiError(response.status, await readErrorMessage(response));
  }
}
