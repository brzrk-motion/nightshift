import { describe, expect, it } from 'vitest';
import { Mixer } from './mixer.js';
import { CaptureSink, type AudioSink } from './sink.js';
import { toneBuffer, type PcmBuffer } from './wav.js';

function filled(frameCount: number, sample: number): PcmBuffer {
  const frames = new Int16Array(frameCount * 2);
  frames.fill(sample);
  return { sampleRate: 44100, channels: 2, frames, frameCount };
}

function maxAbs(chunk: Int16Array): number {
  let max = 0;
  for (const sample of chunk) {
    const abs = Math.abs(sample);
    if (abs > max) max = abs;
  }
  return max;
}

describe('Mixer', () => {
  it('wraps the playhead so looping continues', () => {
    const mixer = new Mixer(new CaptureSink());
    mixer.load('a', toneBuffer(16, 220));
    mixer.play('a');
    mixer.tick(16);
    const before = mixer.positionMs();
    mixer.tick(16);
    expect(mixer.currentClipId()).toBe('a');
    expect(mixer.positionMs()).toBe(before);
  });

  it('emits silence and does not advance after pause', () => {
    const sink = new CaptureSink();
    const mixer = new Mixer(sink);
    mixer.load('a', toneBuffer(64, 440, 0.8));
    mixer.play('a');
    const playing = mixer.tick(8);
    expect(maxAbs(playing)).toBeGreaterThan(0);
    mixer.pause();
    const paused = mixer.tick(8);
    expect(maxAbs(paused)).toBe(0);
    expect(sink.chunks.length).toBe(1);
  });

  it('returns an interleaved s16 chunk of the requested frame count', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(32, 100));
    mixer.play('a');
    const chunk = mixer.tick(10);
    expect(chunk.length).toBe(20);
  });

  it('crossfades instead of cutting to the next clip', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(44100, 220, 0.9));
    mixer.load('b', toneBuffer(44100, 880, 0.9));
    mixer.play('a');
    mixer.tick(64);
    mixer.skipTo('b', { fade: true });
    expect(mixer.fading()).toBe(true);
    const mixed = mixer.tick(64);
    const onlyB = new Mixer();
    onlyB.load('b', toneBuffer(44100, 880, 0.9));
    onlyB.play('b');
    const bChunk = onlyB.tick(64);
    let sameAsB = 0;
    for (let i = 0; i < mixed.length; i += 1) {
      if (mixed[i] === bChunk[i]) sameAsB += 1;
    }
    expect(sameAsB).toBeLessThan(mixed.length);
    expect(maxAbs(mixed)).toBeGreaterThan(0);
  });

  it('clamps fade length to the shorter clip', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(100, 220));
    mixer.load('b', toneBuffer(80, 880));
    mixer.play('a');
    mixer.skipTo('b', { fade: true });
    mixer.tick(80);
    expect(mixer.fading()).toBe(false);
    expect(mixer.currentClipId()).toBe('b');
  });

  it('replaces an in-progress fade on a rapid skipTo', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(44100, 110));
    mixer.load('b', toneBuffer(44100, 330));
    mixer.load('c', toneBuffer(44100, 550));
    mixer.play('a');
    mixer.skipTo('b', { fade: true });
    mixer.tick(32);
    mixer.skipTo('c', { fade: true });
    mixer.tick(32);
    expect(mixer.currentClipId() === 'b' || mixer.currentClipId() === 'c').toBe(true);
    expect(mixer.fading()).toBe(true);
  });

  it('keeps the incoming clip when paused mid-crossfade', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(44100, 220));
    mixer.load('b', toneBuffer(44100, 880));
    mixer.play('a');
    mixer.skipTo('b', { fade: true });
    mixer.tick(32);
    expect(mixer.fading()).toBe(true);
    mixer.pause();
    expect(mixer.fading()).toBe(false);
    expect(mixer.currentClipId()).toBe('b');
    mixer.play();
    expect(mixer.currentClipId()).toBe('b');
  });

  it('skips ticks while a device write is still in flight', async () => {
    let writes = 0;
    let release!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sink: AudioSink = {
      backend: 'device',
      write: () => {
        writes += 1;
        return writes === 1 ? firstWrite : Promise.resolve();
      },
      close() {},
    };
    const mixer = new Mixer(sink);
    mixer.load('a', toneBuffer(32, 100));
    mixer.play('a');
    mixer.tick(4);
    mixer.tick(4);
    mixer.tick(4);
    expect(writes).toBe(1);
    release();
    await firstWrite;
    mixer.tick(4);
    expect(writes).toBe(2);
  });

  it('falls back to a silent sink when device writes reject', async () => {
    const sink: AudioSink = {
      backend: 'device',
      write: () => Promise.reject(new Error('disconnected')),
      close() {},
    };
    const mixer = new Mixer(sink);
    mixer.load('a', toneBuffer(32, 100));
    mixer.play('a');
    mixer.tick(4);
    await Promise.resolve();
    expect(mixer.sinkBackend).toBe('silent');
    expect(mixer.writeError).toMatch(/disconnected/);
    expect(() => mixer.tick(4)).not.toThrow();
  });

  it('uses the incoming buffer for the rest of a chunk after a fade completes', () => {
    const mixer = new Mixer();
    mixer.load('a', filled(8, 1000));
    mixer.load('b', filled(8, 2000));
    mixer.play('a');
    mixer.skipTo('b', { fade: true });
    const chunk = mixer.tick(12);
    expect(mixer.fading()).toBe(false);
    expect(mixer.currentClipId()).toBe('b');
    expect(chunk[8 * 2]).toBe(2000);
    expect(chunk[11 * 2]).toBe(2000);
    expect(mixer.has('a')).toBe(false);
    expect(mixer.has('b')).toBe(true);
  });

  it('records 0–1 levels while playing', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(128, 200, 0.5));
    mixer.play('a');
    mixer.tick(32);
    expect(mixer.levels.length).toBeGreaterThan(0);
    expect(mixer.levels.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('drops inactive clip buffers', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(16, 220));
    mixer.load('b', toneBuffer(16, 440));
    mixer.play('a');
    mixer.retainActive();
    expect(mixer.has('a')).toBe(true);
    expect(mixer.has('b')).toBe(false);
  });

  it('keeps both buffers while a crossfade is in progress', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(44100, 220));
    mixer.load('b', toneBuffer(44100, 880));
    mixer.play('a');
    mixer.skipTo('b', { fade: true });
    mixer.retainActive();
    expect(mixer.has('a')).toBe(true);
    expect(mixer.has('b')).toBe(true);
  });
});
