import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import type { ReactNode } from 'react';
import { detectRuntime } from '../app/runtime.js';
import { ThemeProvider } from '../app/context.js';
import { MIDNIGHT_THEME } from '../theme.js';
import { Icon, iconGlyph } from './Icon.js';
import { Divider, KeyHint, Metric, StatRow, StatusDot } from './Primitives.js';
import { IconButton, Toolbar } from './Toolbar.js';
import { EmptyState, ErrorState, LoadingState } from './States.js';
import { ActivityWaveform, Meter, Timeline } from './visuals.js';
import { Panel } from './Panel.js';

const renderable = detectRuntime().ffi;

async function draw(node: ReactNode, width = 60, height = 12): Promise<string> {
  const setup = await testRender(<ThemeProvider theme={MIDNIGHT_THEME}>{node}</ThemeProvider>, {
    width,
    height,
  });
  try {
    await setup.renderOnce();
    return setup.captureCharFrame();
  } finally {
    setup.renderer.destroy();
  }
}

describe('iconGlyph', () => {
  it('resolves a known icon', () => {
    expect(iconGlyph('dashboard')).toBe('▦');
  });

  it('falls back to the first letter of an unknown name', () => {
    expect(iconGlyph('mystery')).toBe('M');
  });

  it('prefers an explicit fallback over the letter guess', () => {
    expect(iconGlyph('mystery', '?')).toBe('?');
  });
});

describe.skipIf(!renderable)('phase 7 primitives', () => {
  it('draws an icon glyph', async () => {
    expect(await draw(<Icon name="settings" />, 10, 3)).toContain('⚙');
  });

  it('draws a status dot in the tone it is given', async () => {
    expect(await draw(<StatusDot tone="success" />, 10, 3)).toContain('●');
  });

  it('draws a key hint as keys and a label', async () => {
    const frame = await draw(<KeyHint keys="ctrl+p" label="commands" />, 30, 3);
    expect(frame).toContain('ctrl+p');
    expect(frame).toContain('commands');
  });

  it('draws a stat row with the label on the left and the value on the right', async () => {
    const frame = await draw(<StatRow label="Plugins" value="3" />, 30, 3);
    expect(frame).toContain('Plugins');
    expect(frame).toContain('3');
  });

  it('draws a metric as a bold value over its label', async () => {
    const frame = await draw(<Metric label="Sessions" value="12" />, 30, 4);
    expect(frame).toContain('12');
    expect(frame).toContain('Sessions');
  });

  it('draws a divider', async () => {
    const frame = await draw(
      <Panel>
        <Divider />
      </Panel>,
      30,
      5,
    );
    // The divider is a solid-colour bar rather than a drawn character, so the
    // useful assertion is that the panel renders without error around it.
    expect(frame).toContain('╭');
  });

  it('draws an icon button and calls back when pressed', async () => {
    let pressed = 0;
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <IconButton icon="play" label="Start" onPress={() => (pressed += 1)} />
      </ThemeProvider>,
      { width: 20, height: 3 },
    );
    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Start');
      await setup.mockMouse.click(1, 0);
      await setup.renderOnce();
      expect(pressed).toBe(1);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('draws a toolbar of icon buttons', async () => {
    const frame = await draw(
      <Toolbar>
        <IconButton icon="play" label="Play" />
        <IconButton icon="pause" label="Pause" />
      </Toolbar>,
      30,
      3,
    );
    expect(frame).toContain('Play');
    expect(frame).toContain('Pause');
  });

  it('draws an empty state message', async () => {
    expect(await draw(<EmptyState message="Nothing here yet" />, 30, 6)).toContain(
      'Nothing here yet',
    );
  });

  it('draws an error state message', async () => {
    expect(await draw(<ErrorState message="Could not load" hint="try again" />, 30, 6)).toContain(
      'Could not load',
    );
  });

  it('draws a loading state message and a spinner glyph', async () => {
    const frame = await draw(<LoadingState message="Working…" />, 30, 6);
    expect(frame).toContain('Working');
    expect(frame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/u);
  });

  it('draws a compact meter', async () => {
    const frame = await draw(<Meter value={0.5} width={10} label="CPU" />, 30, 3);
    expect(frame).toContain('CPU');
  });

  it('draws an activity waveform', async () => {
    const frame = await draw(<ActivityWaveform values={[0, 1, 5, 2]} />, 30, 3);
    expect(frame.replaceAll(' ', '')).not.toBe('');
  });

  it('draws a timeline and highlights the current entry', async () => {
    const frame = await draw(
      <Timeline
        items={[
          { id: 'a', time: '9:00', label: 'Focus' },
          { id: 'b', time: '9:50', label: 'Break', current: true },
        ]}
      />,
      30,
      6,
    );
    expect(frame).toContain('Focus');
    expect(frame).toContain('Break');
    expect(frame).toContain('●');
  });

  it('shows the empty message when a timeline has nothing scheduled', async () => {
    expect(await draw(<Timeline items={[]} />, 30, 4)).toContain('Nothing scheduled');
  });

  it('draws a panel at each density without erroring', async () => {
    for (const density of ['compact', 'normal', 'spacious'] as const) {
      const frame = await draw(
        <Panel density={density} title="Density">
          <text>content</text>
        </Panel>,
        30,
        6,
      );
      expect(frame).toContain('content');
    }
  });
});
