import type { Json } from '@nightshift/sdk';

/**
 * Live, non-secret Home Assistant state. Credentials live only in plugin storage.
 */

export const HOME_ASSISTANT_CONNECTION_ENTITY = 'home-assistant.connection';
export const HOME_ASSISTANT_SCENES_ENTITY = 'home-assistant.scenes';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
  configured: boolean;
  baseUrl: string | null;
  status: ConnectionStatus;
  error: string | null;
  lastSyncedAt: number | null;
  [key: string]: Json;
}

export interface Scene {
  entityId: string;
  name: string;
  state: string | null;
  [key: string]: Json;
}

export interface ScenesState {
  scenes: Scene[];
  loading: boolean;
  error: string | null;
  activatingId: string | null;
  [key: string]: Json;
}

export function initialConnectionState(): ConnectionState {
  return {
    configured: false,
    baseUrl: null,
    status: 'idle',
    error: null,
    lastSyncedAt: null,
  };
}

export function initialScenesState(): ScenesState {
  return {
    scenes: [],
    loading: false,
    error: null,
    activatingId: null,
  };
}
