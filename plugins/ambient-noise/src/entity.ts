import type { Json } from '@nightshift/sdk';

export const PLAYER_ENTITY = 'ambient-noise.player';
export const SETTINGS_STORAGE_KEY = 'settings';
export const CROSSFADE_MS = 1500;
export const LEVELS_LEN = 48;
export const MIXER_SAMPLE_RATE = 44100;
export const MIXER_CHANNELS = 2;
export const CHUNK_FRAMES = 2205;
export const TICK_MS = 50;

export type ClipStatus = 'ok' | 'unavailable';
export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'fading' | 'unavailable' | 'empty';
export type OutputKind = 'device' | 'silent' | 'error';

export interface ClipPublic {
  id: string;
  name: string;
  status: ClipStatus;
  [key: string]: Json;
}

export interface PlayerState {
  clips: ClipPublic[];
  currentClipId: string | null;
  currentName: string;
  status: PlayerStatus;
  output: OutputKind;
  outputMessage: string | null;
  positionMs: number;
  durationMs: number | null;
  crossfadeMs: number;
  levels: number[];
  error: string | null;
  [key: string]: Json;
}

export interface StoredSettings {
  version: 1;
  currentClipId: string | null;
  [key: string]: Json;
}

export function initialPlayerState(
  clips: ClipPublic[] = [],
  currentClipId: string | null = null,
): PlayerState {
  const selected = selectClip(clips, currentClipId);
  const status: PlayerStatus =
    clips.length === 0 ? 'empty' : selected?.status === 'ok' ? 'paused' : 'unavailable';
  return {
    clips,
    currentClipId: selected?.id ?? null,
    currentName: selected?.name ?? '',
    status,
    output: 'silent',
    outputMessage: null,
    positionMs: 0,
    durationMs: null,
    crossfadeMs: CROSSFADE_MS,
    levels: [],
    error: null,
  };
}

export function selectClip(clips: ClipPublic[], id: string | null): ClipPublic | undefined {
  if (id) {
    const match = clips.find((clip) => clip.id === id);
    if (match) return match;
  }
  return clips.find((clip) => clip.status === 'ok') ?? clips[0];
}

export function isStoredSettings(value: unknown): value is StoredSettings {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record['version'] !== 1) return false;
  const id = record['currentClipId'];
  return id === null || typeof id === 'string';
}

export function hydrateSettings(raw: unknown): StoredSettings {
  if (isStoredSettings(raw)) {
    return { version: 1, currentClipId: raw.currentClipId };
  }
  return { version: 1, currentClipId: null };
}
