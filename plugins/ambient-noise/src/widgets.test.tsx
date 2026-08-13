import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import {
  createAppRuntime,
  detectRuntime,
  MIDNIGHT_THEME,
  RuntimeProvider,
  ThemeProvider,
} from '@nightshift/ui';
import { PLAYER_ENTITY, initialPlayerState, type PlayerState } from './entity.js';
import { PlayerWidget } from './widgets.js';

const renderable = detectRuntime().ffi;

function playingState(): PlayerState {
  return {
    ...initialPlayerState(
      [
        { id: 'rainy-day', name: 'Rainy Day', status: 'ok' },
        { id: 'white-noise', name: 'White Noise', status: 'ok' },
      ],
      'rainy-day',
    ),
    status: 'playing',
    output: 'device',
    levels: [0.2, 0.8, 0.4, 0.9, 0.1],
  };
}

function runtimeWith(state: PlayerState): ReturnType<typeof createAppRuntime> {
  const entities = createEntityStore();
  entities.register(PLAYER_ENTITY, state);
  const runtime = createAppRuntime({ entities });
  for (const id of [
    'ambient-noise.play',
    'ambient-noise.pause',
    'ambient-noise.toggle',
    'ambient-noise.next',
    'ambient-noise.previous',
  ]) {
    runtime.commands.register({ id, title: id, run: () => {} });
  }
  return runtime;
}

describe.skipIf(!renderable)('PlayerWidget', () => {
  it('draws the clip display name and a play control', async () => {
    const state = initialPlayerState(
      [{ id: 'rainy-day', name: 'Rainy Day', status: 'ok' }],
      'rainy-day',
    );
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtimeWith(state)}>
          <PlayerWidget options={{}} width={48} height={12} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 52, height: 14 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Rainy Day');
      expect(frame).toMatch(/▶|▮/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('keeps the name and play/pause in a compact slot without skip glyphs', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtimeWith(playingState())}>
          <PlayerWidget options={{}} width={28} height={8} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 32, height: 10 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Rainy Day');
      expect(frame).not.toContain('◀◀');
      expect(frame).not.toContain('▶▶');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows an activity waveform when wide and playing', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtimeWith(playingState())}>
          <PlayerWidget options={{}} width={64} height={14} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 68, height: 16 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Rainy Day');
      expect(frame).toMatch(/[▁▂▃▄▅▆▇█]/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('omits the waveform in compact layout', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtimeWith(playingState())}>
          <PlayerWidget options={{}} width={24} height={7} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 28, height: 9 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Rainy Day');
      expect(frame).not.toMatch(/[▁▂▃▄▅▆▇█]{4,}/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('hints at clips.json when the catalog is empty', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtimeWith(initialPlayerState())}>
          <PlayerWidget options={{}} width={72} height={12} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 76, height: 14 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('No ambient clips');
      expect(frame).toMatch(/clips\.\s*json/);
    } finally {
      setup.renderer.destroy();
    }
  });
});
