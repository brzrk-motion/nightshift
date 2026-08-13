import { readFile } from 'node:fs/promises';
import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';
import { loadCatalog, toPublicClips, type CatalogEntry } from './catalog.js';
import {
  CHUNK_FRAMES,
  CROSSFADE_MS,
  PLAYER_ENTITY,
  SETTINGS_STORAGE_KEY,
  TICK_MS,
  hydrateSettings,
  initialPlayerState,
  selectClip,
  type ClipPublic,
  type OutputKind,
  type PlayerState,
  type PlayerStatus,
} from './entity.js';
import { Mixer } from './mixer.js';
import { createDeviceSink, NullSink, type AudioSink } from './sink.js';
import { loadWav } from './wav.js';
import { PlayerWidget } from './widgets.js';

function stringArg(args: Record<string, Json> | undefined, key: string): string | undefined {
  const value = args?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function outputMessage(kind: OutputKind): string | null {
  if (kind === 'silent') return 'No audio device — playback is silent.';
  if (kind === 'error') return 'Could not open audio output.';
  return null;
}

async function defaultSink(): Promise<AudioSink> {
  if (process.env['VITEST']) return new NullSink();
  return createDeviceSink();
}

export default definePlugin({
  id: 'ambient-noise',
  name: 'Ambient Noise',
  version: '0.1.0',
  description: 'Looping ambient clips with play/pause and crossfade skip.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    const entries = await loadCatalog();
    const mixer = new Mixer(new NullSink());
    let output: OutputKind = 'silent';
    let outputError: string | null = null;
    let announcedOutput: string | null = null;
    let sinkReady = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let levelsTick = 0;

    for (const entry of entries) {
      if (entry.status !== 'ok') continue;
      try {
        const bytes = await readFile(entry.path);
        mixer.load(entry.id, loadWav(bytes));
      } catch (error: unknown) {
        entry.status = 'unavailable';
        context.log.warn('Could not decode ambient clip', { id: entry.id, error: `${error}` });
      }
    }

    const clips: ClipPublic[] = toPublicClips(entries);
    const stored = hydrateSettings(await context.storage.get(SETTINGS_STORAGE_KEY));
    let state = initialPlayerState(clips, stored.currentClipId);
    const selected = selectClip(clips, state.currentClipId);
    if (selected?.status === 'ok') {
      mixer.skipTo(selected.id, { fade: false });
      state = {
        ...state,
        durationMs: mixer.durationMs(selected.id),
      };
    }

    context.registerEntity(PLAYER_ENTITY, state, {
      title: 'Ambient noise',
      owner: 'ambient-noise',
    });

    const read = (): PlayerState =>
      context.entities.get<PlayerState>(PLAYER_ENTITY)?.state ?? state;

    const persist = (clipId: string | null): void => {
      context.storage
        .set(SETTINGS_STORAGE_KEY, { version: 1, currentClipId: clipId })
        .catch((error: unknown) => {
          context.log.warn('Could not save ambient clip selection', { error: `${error}` });
        });
    };

    const write = (next: PlayerState): void => {
      state = next;
      context.entities.set(PLAYER_ENTITY, next);
    };

    const snapshot = (status: PlayerStatus): PlayerState => {
      const currentId = mixer.currentClipId() ?? read().currentClipId;
      const clip = selectClip(clips, currentId);
      return {
        ...read(),
        clips,
        currentClipId: clip?.id ?? null,
        currentName: clip?.name ?? '',
        status,
        output,
        outputMessage: outputMessage(output),
        positionMs: mixer.positionMs(),
        durationMs: clip ? mixer.durationMs(clip.id) : null,
        crossfadeMs: CROSSFADE_MS,
        levels: [...mixer.levels],
        error: outputError,
      };
    };

    const stopTicks = (): void => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };

    const startTicks = (): void => {
      if (timer !== undefined) return;
      timer = setInterval(() => {
        mixer.tick(CHUNK_FRAMES);
        levelsTick += 1;
        const current = read();
        if (current.status !== 'playing' && current.status !== 'fading') return;
        if (levelsTick % 2 !== 0) return;
        write(snapshot(mixer.fading() ? 'fading' : 'playing'));
      }, TICK_MS);
      timer.unref?.();
    };

    const ensureSink = async (): Promise<void> => {
      if (sinkReady) return;
      try {
        const sink = await defaultSink();
        mixer.setSink(sink);
        output = sink.backend;
        sinkReady = true;
        outputError = sink.backend === 'error' ? 'Could not open audio output.' : null;
      } catch (error: unknown) {
        output = 'error';
        outputError = `${error}`;
        mixer.setSink(new NullSink());
        sinkReady = true;
      }
      if (output === 'error' && announcedOutput !== outputError) {
        announcedOutput = outputError;
        context.notify(outputError ?? 'Could not open audio output.', {
          tone: 'warning',
          key: 'output',
        });
      }
    };

    const okEntries = (): CatalogEntry[] =>
      entries.filter((entry) => entry.status === 'ok' && mixer.has(entry.id));

    const cycleId = (delta: number): string | null => {
      const ok = okEntries();
      if (ok.length === 0) return null;
      const current = read().currentClipId;
      const index = Math.max(
        0,
        ok.findIndex((entry) => entry.id === current),
      );
      const next = ok[(index + delta + ok.length) % ok.length];
      return next?.id ?? null;
    };

    const selectClipId = (clipId: string, fade: boolean): void => {
      if (!mixer.has(clipId)) return;
      const playing = read().status === 'playing' || read().status === 'fading';
      mixer.skipTo(clipId, { fade: fade && playing });
      persist(clipId);
      write(snapshot(playing ? (mixer.fading() ? 'fading' : 'playing') : 'paused'));
    };

    context.registerCommand({
      id: 'ambient-noise.play',
      title: 'Play ambient noise',
      run: async () => {
        const current = read();
        if (current.status === 'empty') return;
        const clip = selectClip(clips, current.currentClipId);
        if (!clip || clip.status !== 'ok' || !mixer.has(clip.id)) {
          write({ ...current, status: 'unavailable', error: 'No playable clip.' });
          return;
        }
        await ensureSink();
        mixer.play(clip.id);
        startTicks();
        write(snapshot('playing'));
      },
    });

    context.registerCommand({
      id: 'ambient-noise.pause',
      title: 'Pause ambient noise',
      run: () => {
        const current = read();
        if (current.status !== 'playing' && current.status !== 'fading') return;
        mixer.pause();
        stopTicks();
        write(snapshot('paused'));
      },
    });

    context.registerCommand({
      id: 'ambient-noise.toggle',
      title: 'Play or pause ambient noise',
      run: async () => {
        const current = read();
        if (current.status === 'playing' || current.status === 'fading') {
          mixer.pause();
          stopTicks();
          write(snapshot('paused'));
          return;
        }
        const clip = selectClip(clips, current.currentClipId);
        if (!clip || clip.status !== 'ok' || !mixer.has(clip.id)) return;
        await ensureSink();
        mixer.play(clip.id);
        startTicks();
        write(snapshot('playing'));
      },
    });

    context.registerCommand({
      id: 'ambient-noise.next',
      title: 'Next ambient clip',
      run: () => {
        const id = cycleId(1);
        if (id) selectClipId(id, true);
      },
    });

    context.registerCommand({
      id: 'ambient-noise.previous',
      title: 'Previous ambient clip',
      run: () => {
        const id = cycleId(-1);
        if (id) selectClipId(id, true);
      },
    });

    context.registerCommand({
      id: 'ambient-noise.select',
      title: 'Select ambient clip',
      run: (args) => {
        const id = stringArg(args, 'id');
        if (!id || !mixer.has(id)) return;
        selectClipId(id, true);
      },
    });

    context.registerWidget({
      type: 'ambient-noise.player',
      title: 'Ambient noise',
      entities: [PLAYER_ENTITY],
      description: 'Named ambient clips with play, pause, and crossfade skip.',
      render: PlayerWidget,
    });

    context.own(() => {
      stopTicks();
      mixer.close();
    });

    context.log.info('Ambient noise plugin ready', { clips: clips.length });
  },
});

export { PLAYER_ENTITY } from './entity.js';
export { resolveLayout } from './scale.js';
export { PlayerWidget } from './widgets.js';
