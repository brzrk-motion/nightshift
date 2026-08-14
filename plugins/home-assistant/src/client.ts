import {
  HttpError,
  authorizedFetch,
  ensureOk,
  type HttpErrorMessageFormatter,
} from '@nightshift/plugin-shared';
import type { PluginFetch } from '@nightshift/sdk';
import type { Scene } from './entity.js';
import { scenesFromStates, type HaStateRow } from './scenes.js';

const haErrorMessage: HttpErrorMessageFormatter = (status, body) => {
  const trimmed = body.trim();
  if (status === 401 || status === 403) {
    return trimmed || 'Invalid Home Assistant access token.';
  }
  return trimmed || `Home Assistant API error (${status})`;
};

/** Lightweight reachability + auth check: GET /api/ */
export async function checkConnection(
  fetchFn: PluginFetch,
  baseUrl: string,
  token: string,
): Promise<void> {
  const response = await authorizedFetch(fetchFn, token, `${baseUrl}/api/`);
  await ensureOk(response, haErrorMessage);
}

/** GET /api/states → scene.* only */
export async function listScenes(
  fetchFn: PluginFetch,
  baseUrl: string,
  token: string,
): Promise<Scene[]> {
  const response = await authorizedFetch(fetchFn, token, `${baseUrl}/api/states`);
  await ensureOk(response, haErrorMessage);
  const json: unknown = await response.json();
  if (!Array.isArray(json)) {
    throw new HttpError(response.status, '', 'Home Assistant /api/states was not an array.');
  }
  return scenesFromStates(json as HaStateRow[]);
}

/** POST /api/services/scene/turn_on */
export async function activateScene(
  fetchFn: PluginFetch,
  baseUrl: string,
  token: string,
  entityId: string,
): Promise<void> {
  const body = JSON.stringify({ entity_id: entityId });
  const response = await authorizedFetch(fetchFn, token, `${baseUrl}/api/services/scene/turn_on`, {
    method: 'POST',
    body,
  });
  await ensureOk(response, haErrorMessage);
}
