import {
  CROSSFADE_MS,
  LEVELS_LEN,
  MIXER_CHANNELS,
  MIXER_SAMPLE_RATE,
  SEAM_FADE_FRAMES,
} from './entity.js';
import type { AudioSink } from './sink.js';
import { NullSink } from './sink.js';
import type { PcmBuffer } from './wav.js';

export interface MixerSource {
  clipId: string;
  frame: number;
}

function clampInt16(value: number): number {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return value | 0;
}

function durationFrames(buffer: PcmBuffer): number {
  return Math.max(1, buffer.frameCount);
}

function seamLength(buffer: PcmBuffer): number {
  if (buffer.frameCount < SEAM_FADE_FRAMES * 2) return 0;
  return SEAM_FADE_FRAMES;
}

function readFrame(buffer: PcmBuffer, frame: number, channel: number): number {
  const wrapped = ((frame % buffer.frameCount) + buffer.frameCount) % buffer.frameCount;
  return buffer.frames[wrapped * MIXER_CHANNELS + channel] ?? 0;
}

function mixLoopSample(buffer: PcmBuffer, frame: number, channel: number): number {
  const n = durationFrames(buffer);
  const seam = seamLength(buffer);
  const current = readFrame(buffer, frame, channel);
  if (seam === 0 || frame < n - seam) return current;
  const k = frame - (n - seam);
  const theta = k / seam;
  const incoming = readFrame(buffer, k, channel);
  return clampInt16(
    current * Math.cos((theta * Math.PI) / 2) + incoming * Math.sin((theta * Math.PI) / 2),
  );
}

function advanceSource(source: MixerSource, buffer: PcmBuffer): void {
  const n = durationFrames(buffer);
  const seam = seamLength(buffer);
  source.frame += 1;
  if (source.frame >= n) source.frame = seam;
}

function rms(chunk: Int16Array): number {
  if (chunk.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < chunk.length; i += 1) {
    const sample = chunk[i] ?? 0;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / chunk.length) / 32768);
}

function copyPcm(chunk: Int16Array): Buffer {
  return Buffer.from(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
}

export class Mixer {
  private readonly buffers = new Map<string, PcmBuffer>();
  private sink: AudioSink;
  private primary: MixerSource | null = null;
  private incoming: MixerSource | null = null;
  private fadeRemaining = 0;
  private fadeTotal = 0;
  playing = false;
  writeError: string | null = null;
  readonly levels: number[] = [];
  private inflight: Promise<void> | null = null;
  private queued: Buffer[] = [];
  private writeGen = 0;

  constructor(sink: AudioSink = new NullSink()) {
    this.sink = sink;
  }

  get sinkBackend(): AudioSink['backend'] {
    return this.sink.backend;
  }

  setSink(sink: AudioSink): void {
    this.writeGen += 1;
    this.queued = [];
    this.inflight = null;
    this.sink.close();
    this.sink = sink;
  }

  load(clipId: string, buffer: PcmBuffer): void {
    this.buffers.set(clipId, buffer);
  }

  has(clipId: string): boolean {
    return this.buffers.has(clipId);
  }

  durationMs(clipId: string): number | null {
    const buffer = this.buffers.get(clipId);
    if (!buffer) return null;
    return Math.round((buffer.frameCount / MIXER_SAMPLE_RATE) * 1000);
  }

  currentClipId(): string | null {
    return this.incoming?.clipId ?? this.primary?.clipId ?? null;
  }

  retainActive(): void {
    const keep = new Set<string>();
    if (this.primary) keep.add(this.primary.clipId);
    if (this.incoming) keep.add(this.incoming.clipId);
    for (const id of this.buffers.keys()) {
      if (!keep.has(id)) this.buffers.delete(id);
    }
  }

  positionMs(): number {
    const source = this.incoming ?? this.primary;
    if (!source) return 0;
    const buffer = this.buffers.get(source.clipId);
    if (!buffer) return 0;
    return Math.round((source.frame / MIXER_SAMPLE_RATE) * 1000);
  }

  fading(): boolean {
    return this.incoming !== null && this.fadeRemaining > 0;
  }

  play(clipId?: string): void {
    if (clipId && this.buffers.has(clipId) && this.primary?.clipId !== clipId && !this.playing) {
      this.primary = { clipId, frame: 0 };
      this.incoming = null;
      this.fadeRemaining = 0;
    } else if (!this.primary && clipId && this.buffers.has(clipId)) {
      this.primary = { clipId, frame: 0 };
    }
    this.playing = this.primary !== null;
  }

  pause(): void {
    this.playing = false;
    // Drop anything not yet handed to the device so pause is snappy and a
    // follow-up play cannot share the previous write generation's queue.
    this.writeGen += 1;
    this.queued = [];
    this.inflight = null;
    if (this.incoming) {
      this.primary = this.incoming;
      this.incoming = null;
    }
    this.fadeRemaining = 0;
  }

  skipTo(clipId: string, options: { fade: boolean }): void {
    if (!this.buffers.has(clipId)) return;
    if (!this.playing || !options.fade || !this.primary) {
      this.primary = { clipId, frame: 0 };
      this.incoming = null;
      this.fadeRemaining = 0;
      return;
    }
    if (this.incoming) {
      this.primary = this.incoming;
      this.incoming = null;
    }
    if (this.primary.clipId === clipId) {
      return;
    }
    const outgoing = this.buffers.get(this.primary.clipId);
    const next = this.buffers.get(clipId);
    if (!outgoing || !next) return;
    const fadeMs = Math.min(
      CROSSFADE_MS,
      (outgoing.frameCount / MIXER_SAMPLE_RATE) * 1000,
      (next.frameCount / MIXER_SAMPLE_RATE) * 1000,
    );
    this.fadeTotal = Math.max(1, Math.round((fadeMs / 1000) * MIXER_SAMPLE_RATE));
    this.fadeRemaining = this.fadeTotal;
    this.incoming = { clipId, frame: 0 };
  }

  tick(frameCount: number): Int16Array {
    const chunk = new Int16Array(frameCount * MIXER_CHANNELS);
    if (!this.playing || !this.primary) {
      this.pushLevel(0);
      return chunk;
    }

    if (!this.buffers.has(this.primary.clipId)) {
      this.pushLevel(0);
      return chunk;
    }

    for (let i = 0; i < frameCount; i += 1) {
      const outBuf = this.buffers.get(this.primary.clipId);
      if (!outBuf) {
        chunk[i * 2] = 0;
        chunk[i * 2 + 1] = 0;
        continue;
      }
      let left = mixLoopSample(outBuf, this.primary.frame, 0);
      let right = mixLoopSample(outBuf, this.primary.frame, 1);
      advanceSource(this.primary, outBuf);

      if (this.incoming && this.fadeRemaining > 0) {
        const inBuf = this.buffers.get(this.incoming.clipId);
        if (inBuf) {
          const theta = 1 - this.fadeRemaining / this.fadeTotal;
          const outGain = Math.cos((theta * Math.PI) / 2);
          const inGain = Math.sin((theta * Math.PI) / 2);
          const inLeft = mixLoopSample(inBuf, this.incoming.frame, 0);
          const inRight = mixLoopSample(inBuf, this.incoming.frame, 1);
          left = clampInt16(left * outGain + inLeft * inGain);
          right = clampInt16(right * outGain + inRight * inGain);
          advanceSource(this.incoming, inBuf);
          this.fadeRemaining -= 1;
          if (this.fadeRemaining <= 0) {
            this.primary = this.incoming;
            this.incoming = null;
            this.fadeRemaining = 0;
            this.retainActive();
          }
        }
      }

      chunk[i * 2] = left;
      chunk[i * 2 + 1] = right;
    }

    this.pushLevel(rms(chunk));
    this.writeChunk(chunk);
    return chunk;
  }

  waitForDrain(): Promise<void> | null {
    return this.inflight;
  }

  close(): void {
    this.playing = false;
    this.writeGen += 1;
    this.queued = [];
    this.inflight = null;
    this.sink.close();
  }

  private writeChunk(chunk: Int16Array): void {
    const bytes = copyPcm(chunk);
    if (this.inflight) {
      this.queued.push(bytes);
      return;
    }
    this.dispatch(bytes);
  }

  private dispatch(bytes: Buffer): void {
    try {
      const result = this.sink.write(bytes);
      if (!(result instanceof Promise)) {
        this.flushQueuedSync();
        return;
      }
      this.inflight = this.watch(result, this.writeGen);
    } catch (error: unknown) {
      this.failSink(error);
    }
  }

  private flushQueuedSync(): void {
    while (this.queued.length > 0 && this.inflight === null) {
      const next = this.queued.shift();
      if (!next) return;
      this.dispatch(next);
    }
  }

  private async watch(first: Promise<void>, gen: number): Promise<void> {
    try {
      await first;
      while (this.queued.length > 0 && this.writeGen === gen) {
        const next = this.queued.shift();
        if (!next) break;
        const result = this.sink.write(next);
        if (result instanceof Promise) await result;
      }
    } catch (error: unknown) {
      this.queued = [];
      this.failSink(error);
    } finally {
      if (this.writeGen === gen) this.inflight = null;
    }
  }

  private failSink(error: unknown): void {
    if (this.writeError === null) {
      this.writeError = error instanceof Error ? error.message : String(error);
    }
    if (this.sink.backend === 'silent') return;
    this.setSink(new NullSink());
  }

  private pushLevel(value: number): void {
    this.levels.push(Math.min(1, Math.max(0, value)));
    if (this.levels.length > LEVELS_LEN) {
      this.levels.splice(0, this.levels.length - LEVELS_LEN);
    }
  }
}
