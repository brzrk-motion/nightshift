import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { definePlugin, type Json, type PluginContext } from '@nightshift/sdk';
import { defaultCatalogDir, loadCatalog, toPublicClips, type CatalogEntry } from './catalog.js';
import { loadClip } from './decode.js';
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

function runtimeCatalogDir(): string {
  return process.env['VITEST'] ? join(defaultCatalogDir(), 'fixtures') : defaultCatalogDir();
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
    'automations:register',
    'storage',
  ],

  async setup(context: PluginContext) {
    const entries = await loadCatalog(runtimeCatalogDir());
    const mixer = new Mixer(new NullSink());
    let output: OutputKind = 'silent';
    let outputError: string | null = null;
    let announcedOutput: string | null = null;
    let sinkReady = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let levelsTick = 0;
    let generation = 0;

    const beginOp = (): number => {
      generation += 1;
      return generation;
    };

    const isStale = (token: number): boolean => token !== generation;

    const clips: ClipPublic[] = toPublicClips(entries);
    const stored = hydrateSettings(await context.storage.get(SETTINGS_STORAGE_KEY));
    let state = initialPlayerState(clips, stored.currentClipId);

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
        if (mixer.writeError) {
          output = 'silent';
          outputError = mixer.writeError;
          mixer.writeError = null;
          if (announcedOutput !== outputError) {
            announcedOutput = outputError;
            context.notify('Audio output failed.', { tone: 'warning', key: 'output' });
          }
          const current = read();
          if (current.status === 'playing' || current.status === 'fading') {
            write(snapshot(mixer.fading() ? 'fading' : 'playing'));
          }
        }
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

    const okEntries = (): CatalogEntry[] => entries.filter((entry) => entry.status === 'ok');

    const refreshClips = (): ClipPublic[] => {
      const next = toPublicClips(entries);
      clips.splice(0, clips.length, ...next);
      return next;
    };

    const ensureLoaded = async (clipId: string): Promise<boolean> => {
      if (mixer.has(clipId)) return true;
      const entry = entries.find((item) => item.id === clipId);
      if (!entry || entry.status !== 'ok') return false;
      try {
        mixer.load(clipId, await loadClip(await readFile(entry.path)));
        return true;
      } catch (error: unknown) {
        entry.status = 'unavailable';
        refreshClips();
        context.log.warn('Could not decode ambient clip', { id: entry.id, error: `${error}` });
        return false;
      }
    };

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

    const selectClipId = async (clipId: string, fade: boolean): Promise<void> => {
      const clip = clips.find((item) => item.id === clipId);
      if (!clip || clip.status !== 'ok') return;
      const token = beginOp();
      const playing = read().status === 'playing' || read().status === 'fading';
      if (playing) {
        if (!(await ensureLoaded(clipId))) {
          if (isStale(token)) return;
          context.notify('Could not load that clip.', { tone: 'warning', key: 'clip' });
          write(snapshot(mixer.fading() ? 'fading' : 'playing'));
          return;
        }
        if (isStale(token)) return;
        persist(clipId);
        mixer.skipTo(clipId, { fade });
        mixer.retainActive();
        write(snapshot(mixer.fading() ? 'fading' : 'playing'));
        return;
      }
      persist(clipId);
      write({
        ...snapshot('paused'),
        currentClipId: clip.id,
        currentName: clip.name,
        durationMs: mixer.durationMs(clip.id),
      });
    };

    context.registerCommand({
      id: 'ambient-noise.play',
      title: 'Play ambient noise',
      run: async () => {
        const token = beginOp();
        const current = read();
        if (current.status === 'empty') return;
        const clip = selectClip(clips, current.currentClipId);
        if (!clip || clip.status !== 'ok') {
          write({ ...current, status: 'unavailable', error: 'No playable clip.' });
          return;
        }
        if (!(await ensureLoaded(clip.id))) {
          if (!isStale(token)) {
            write({ ...read(), clips, status: 'unavailable', error: 'No playable clip.' });
          }
          return;
        }
        if (isStale(token)) return;
        await ensureSink();
        if (isStale(token)) return;
        mixer.play(clip.id);
        mixer.retainActive();
        startTicks();
        write(snapshot('playing'));
      },
    });

    context.registerCommand({
      id: 'ambient-noise.pause',
      title: 'Pause ambient noise',
      run: () => {
        beginOp();
        const current = read();
        if (current.status !== 'playing' && current.status !== 'fading') return;
        mixer.pause();
        mixer.retainActive();
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
          beginOp();
          mixer.pause();
          mixer.retainActive();
          stopTicks();
          write(snapshot('paused'));
          return;
        }
        const token = beginOp();
        const clip = selectClip(clips, current.currentClipId);
        if (!clip || clip.status !== 'ok') return;
        if (!(await ensureLoaded(clip.id))) return;
        if (isStale(token)) return;
        await ensureSink();
        if (isStale(token)) return;
        mixer.play(clip.id);
        mixer.retainActive();
        startTicks();
        write(snapshot('playing'));
      },
    });

    context.registerCommand({
      id: 'ambient-noise.next',
      title: 'Next ambient clip',
      run: async () => {
        const id = cycleId(1);
        if (id) await selectClipId(id, true);
      },
    });

    context.registerCommand({
      id: 'ambient-noise.previous',
      title: 'Previous ambient clip',
      run: async () => {
        const id = cycleId(-1);
        if (id) await selectClipId(id, true);
      },
    });

    context.registerCommand({
      id: 'ambient-noise.select',
      title: 'Select ambient clip',
      run: async (args) => {
        const id = stringArg(args, 'id');
        if (!id) return;
        await selectClipId(id, true);
      },
    });

    context.registerWidget({
      type: 'ambient-noise.player',
      title: 'Ambient noise',
      entities: [PLAYER_ENTITY],
      description: 'Named ambient clips with play, pause, and crossfade skip.',
      render: PlayerWidget,
    });

    // Widgets cannot call each other; exclusive playback goes through the
    // shared command registry. Pausing Spotify does not set ambient to
    // playing, so the reverse automation does not loop.
    context.registerAutomation({
      name: 'ambient-noise.pause-spotify',
      when: { type: 'entity', entity: PLAYER_ENTITY, key: 'status' },
      and: [{ type: 'equals', entity: PLAYER_ENTITY, key: 'status', value: 'playing' }],
      then: [{ command: 'spotify.pause' }],
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
