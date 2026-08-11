import { describe, expect, it, vi } from 'vitest';
import { activateScene, checkConnection, HomeAssistantApiError, listScenes } from './client.js';

describe('checkConnection', () => {
  it('succeeds on HTTP 200', async () => {
    const fetchFn = vi.fn(async () => new Response('{"message":"API running."}', { status: 200 }));
    await expect(checkConnection(fetchFn, 'http://192.168.1.10:8123', 'tok')).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledWith('http://192.168.1.10:8123/api/', {
      headers: {
        Authorization: 'Bearer tok',
        Accept: 'application/json',
      },
    });
  });

  it('throws on 401', async () => {
    const fetchFn = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
    await expect(checkConnection(fetchFn, 'http://192.168.1.10:8123', 'bad')).rejects.toMatchObject({
      name: 'HomeAssistantApiError',
      status: 401,
    });
  });

  it('propagates network failures', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(checkConnection(fetchFn, 'http://192.168.1.10:8123', 'tok')).rejects.toThrow(
      'ECONNREFUSED',
    );
  });
});

describe('listScenes', () => {
  it('GETs /api/states with Bearer auth and returns scenes', async () => {
    const fetchFn = vi.fn(
      async (_url: string, _init?: { headers?: Record<string, string> }) =>
        new Response(
          JSON.stringify([
            { entity_id: 'scene.focus', state: 'scening', attributes: { friendly_name: 'Focus' } },
            { entity_id: 'light.x', state: 'on' },
          ]),
          { status: 200 },
        ),
    );
    const scenes = await listScenes(fetchFn, 'http://ha:8123', 'tok');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://ha:8123/api/states',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    );
    expect(scenes).toEqual([{ entityId: 'scene.focus', name: 'Focus', state: 'scening' }]);
  });

  it('throws HomeAssistantApiError on non-OK', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    await expect(listScenes(fetchFn, 'http://ha:8123', 'tok')).rejects.toBeInstanceOf(
      HomeAssistantApiError,
    );
  });
});

describe('activateScene', () => {
  it('POSTs scene.turn_on with entity_id body', async () => {
    const fetchFn = vi.fn(async () => new Response('[]', { status: 200 }));
    await activateScene(fetchFn, 'http://ha:8123', 'tok', 'scene.focus');
    expect(fetchFn).toHaveBeenCalledWith('http://ha:8123/api/services/scene/turn_on', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer tok',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entity_id: 'scene.focus' }),
    });
  });

  it('throws on non-OK', async () => {
    const fetchFn = vi.fn(async () => new Response('fail', { status: 400 }));
    await expect(activateScene(fetchFn, 'http://ha:8123', 'tok', 'scene.x')).rejects.toMatchObject({
      status: 400,
    });
  });
});
