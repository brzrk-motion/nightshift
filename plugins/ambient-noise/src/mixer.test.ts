import { describe, expect, it } from 'vitest';
import { Mixer } from './mixer.js';
import { CaptureSink } from './sink.js';
import { toneBuffer } from './wav.js';

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

  it('records 0–1 levels while playing', () => {
    const mixer = new Mixer();
    mixer.load('a', toneBuffer(128, 200, 0.5));
    mixer.play('a');
    mixer.tick(32);
    expect(mixer.levels.length).toBeGreaterThan(0);
    expect(mixer.levels.every((value) => value >= 0 && value <= 1)).toBe(true);
  });
});
