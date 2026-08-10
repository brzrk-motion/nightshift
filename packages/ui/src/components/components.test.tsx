import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { act, useState, type ReactNode } from 'react';
import { createEntityStore } from '@nightshift/entities';
import { detectRuntime } from '../app/runtime.js';
import { createAppRuntime } from '../app/app.js';
import { AppShell } from '../app/AppShell.js';
import { RuntimeProvider, ThemeProvider, useEntity } from '../app/context.js';
import { MIDNIGHT_THEME } from '../theme.js';
import { Card, Panel } from './Panel.js';
import { Button, TextInput, Toggle } from './controls.js';
import { ProgressBar, progressTrack } from './ProgressBar.js';
import { Tabs } from './Tabs.js';
import { List, Table } from './Table.js';
import { StatusBadge } from './StatusBadge.js';
import { BarChart, LineChart, Sparkline } from './charts.js';
import { Modal } from './Modal.js';
import { Toasts } from './Toasts.js';
import { createToastStore } from '../toasts.js';

describe('progressTrack', () => {
  it('fills nothing at zero and everything at one', () => {
    expect(progressTrack(0, 10)).toEqual({ filled: '', empty: '░'.repeat(10) });
    expect(progressTrack(1, 10)).toEqual({ filled: '█'.repeat(10), empty: '' });
  });

  it('clamps outside 0..1', () => {
    expect(progressTrack(-1, 4).filled).toBe('');
    expect(progressTrack(9, 4).filled).toBe('████');
  });

  it('shows a sliver as soon as there is any progress', () => {
    expect(progressTrack(0.01, 10).filled).not.toBe('');
  });

  it('always fills exactly the width it is given', () => {
    for (const value of [0, 0.13, 0.5, 0.87, 1]) {
      const track = progressTrack(value, 17);
      expect([...track.filled].length + [...track.empty].length).toBe(17);
    }
  });

  it('draws nothing with no room', () => {
    expect(progressTrack(0.5, 0)).toEqual({ filled: '', empty: '' });
  });

  it('treats a non-finite value as zero', () => {
    expect(progressTrack(Number.NaN, 5).filled).toBe('');
  });
});

/**
 * Everything below drives the real OpenTUI renderer, which needs native FFI.
 * On a runtime without it these skip rather than fail — the rest of Nightshift
 * is expected to work there.
 */
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

describe.skipIf(!renderable)('components', () => {
  it('draws a panel with its title and children', async () => {
    const frame = await draw(
      <Panel title="Focus" footer="25:00">
        <text>Deep work</text>
      </Panel>,
    );

    expect(frame).toContain('Focus');
    expect(frame).toContain('Deep work');
    expect(frame).toContain('25:00');
    expect(frame).toContain('╭');
  });

  it('draws a card value and subtitle', async () => {
    const frame = await draw(<Card title="Today" value="3 sessions" subtitle="2h 15m" />);

    expect(frame).toContain('3 sessions');
    expect(frame).toContain('2h 15m');
  });

  it('draws a button and calls back when it is clicked', async () => {
    let pressed = 0;
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <Button label="Start" onPress={() => (pressed += 1)} />
      </ThemeProvider>,
      { width: 30, height: 5 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Start');

      await setup.mockMouse.click(3, 1);
      await setup.renderOnce();
      expect(pressed).toBe(1);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows a toggle in both states', async () => {
    expect(await draw(<Toggle label="Focus mode" value />, 30, 3)).toContain('[▮ ]');
    expect(await draw(<Toggle label="Focus mode" value={false} />, 30, 3)).toContain('[ ▮]');
  });

  it('draws a text input with its placeholder and prefix', async () => {
    const frame = await draw(<TextInput prefix="›" placeholder="Type a command…" />, 40, 3);

    expect(frame).toContain('›');
    expect(frame).toContain('Type a command');
  });

  it('a focused text input captures the keyboard, and releases it when it unmounts', async () => {
    const runtime = createAppRuntime();
    let hide: (() => void) | undefined;

    function Wrapper(): ReactNode {
      const [visible, setVisible] = useState(true);
      hide = () => setVisible(false);
      return visible ? <TextInput focused /> : null;
    }

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <Wrapper />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 40, height: 3 },
    );

    try {
      await setup.renderOnce();
      // So AppShell's/DashboardApp's global shortcuts don't also fire while
      // this is being typed into — see `keyboardCapture.ts`.
      expect(runtime.keyboardCapture.isCaptured()).toBe(true);

      act(() => hide?.());
      await setup.renderOnce();
      expect(runtime.keyboardCapture.isCaptured()).toBe(false);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('an unfocused text input does not capture the keyboard', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <TextInput />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 40, height: 3 },
    );

    try {
      await setup.renderOnce();
      expect(runtime.keyboardCapture.isCaptured()).toBe(false);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('draws a progress bar with a percentage', async () => {
    const frame = await draw(<ProgressBar value={0.5} width={10} showPercent />, 30, 3);

    expect(frame).toContain('█████░░░░░');
    expect(frame).toContain('50%');
  });

  it('draws tabs and marks the active one', async () => {
    const frame = await draw(
      <Tabs
        items={[
          { id: 'a', label: 'Today' },
          { id: 'b', label: 'Week' },
        ]}
        value="b"
      >
        <text>Body</text>
      </Tabs>,
      40,
      6,
    );

    expect(frame).toContain('Today');
    expect(frame).toContain('Week');
    expect(frame).toContain('Body');
  });

  it('draws a table with aligned columns', async () => {
    const frame = await draw(
      <Table
        width={40}
        columns={[
          { key: 'name', header: 'Session' },
          { key: 'minutes', header: 'Min', align: 'right' },
        ]}
        rows={[
          { name: 'Writing', minutes: 50 },
          { name: 'Review', minutes: 25 },
        ]}
      />,
      44,
      6,
    );

    expect(frame).toContain('Session');
    expect(frame).toContain('Writing');
    expect(frame).toContain('25');
  });

  it('tells the user when a table is empty', async () => {
    const frame = await draw(
      <Table columns={[{ key: 'name', header: 'Session' }]} rows={[]} empty="No sessions yet" />,
      40,
      4,
    );

    expect(frame).toContain('No sessions yet');
  });

  it('draws a list and marks the selection', async () => {
    const frame = await draw(
      <List
        selected={1}
        items={[
          { id: 'a', label: 'Locked In' },
          { id: 'b', label: 'Morning' },
        ]}
      />,
      40,
      5,
    );

    expect(frame).toContain('Locked In');
    expect(frame).toContain('▸ Morning');
  });

  it('draws a status badge', async () => {
    expect(await draw(<StatusBadge label="running" tone="success" />, 20, 3)).toContain(
      '● running',
    );
  });

  it('draws the three chart types', async () => {
    expect(await draw(<Sparkline values={[1, 5, 3, 8]} caption="8" />, 30, 3)).toMatch(/[▁-█]/u);
    expect(await draw(<LineChart values={[1, 4, 2, 9]} width={20} height={3} />, 30, 5)).toMatch(
      /[⠀-⣿]/u,
    );
    expect(
      await draw(<BarChart data={[{ label: 'mon', value: 4 }]} width={24} />, 30, 4),
    ).toContain('mon');
  });

  it('centres a modal and hides it when closed', async () => {
    expect(await draw(<Modal title="Commands">{<text>Body</text>}</Modal>)).toContain('Body');
    expect(
      await draw(
        <Modal title="Commands" open={false}>
          {<text>Body</text>}
        </Modal>,
      ),
    ).not.toContain('Body');
  });

  it('draws queued toasts', async () => {
    const toasts = createToastStore({ defaultTimeout: 0 });
    toasts.push('Session finished', { tone: 'success' });

    const frame = await draw(<Toasts store={toasts} />, 60, 8);

    expect(frame).toContain('Session finished');
    toasts.dispose();
  });
});

/**
 * Input arrives from outside React, so the state it causes has to be flushed
 * before the next frame is captured — that is what `act` does. The wait is for
 * the terminal's own escape-sequence timeout: a lone ESC is held back until the
 * parser can rule out a longer sequence starting with it.
 */
async function press(send: () => void): Promise<void> {
  await act(async () => {
    send();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

function Timer(): ReactNode {
  const entity = useEntity<{ remaining: number }>('timer.focus');
  return <text>remaining {entity?.state.remaining ?? 0}</text>;
}

describe.skipIf(!renderable)('AppShell', () => {
  it('renders its children, a status bar, and reacts to the keymap', async () => {
    const runtime = createAppRuntime({ size: { width: 80, height: 20 } });
    const setup = await testRender(
      <AppShell runtime={runtime} title="nightshift · home">
        <text>Dashboard body</text>
      </AppShell>,
      { width: 80, height: 20 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('Dashboard body');
      expect(setup.captureCharFrame()).toContain('nightshift · home');

      // ctrl+p is the default binding for the palette.
      await press(() => setup.mockInput.pressKey('p', { ctrl: true }));
      const opened = await setup.waitForFrame((frame) => frame.includes('Commands'));
      expect(opened).toContain('Type a command');

      await press(() => setup.mockInput.pressEscape());
      const closed = await setup.waitForFrame((frame) => !frame.includes('Type a command'));
      expect(closed).toContain('Dashboard body');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('quits through the command registry when the binding fires', async () => {
    let quit = 0;
    const runtime = createAppRuntime({ onQuit: () => (quit += 1) });
    const setup = await testRender(
      <AppShell runtime={runtime}>
        <text>Body</text>
      </AppShell>,
      { width: 60, height: 16 },
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('q'));
      expect(quit).toBe(1);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('re-renders a widget when its entity changes', async () => {
    const entities = createEntityStore();
    entities.register('timer.focus', { remaining: 60 });
    const runtime = createAppRuntime({ entities });

    const setup = await testRender(
      <AppShell runtime={runtime}>
        <Timer />
      </AppShell>,
      { width: 40, height: 14 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('remaining 60');

      await act(async () => {
        entities.update('timer.focus', { remaining: 59 });
        await Promise.resolve();
      });
      expect(await setup.waitForFrame((frame) => frame.includes('remaining 59'))).toBeTruthy();
    } finally {
      setup.renderer.destroy();
    }
  });

  it('refuses to draw a dashboard into a terminal that is too small', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <AppShell runtime={runtime}>
        <text>Dashboard body</text>
      </AppShell>,
      { width: 30, height: 8 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('too small');
      expect(frame).not.toContain('Dashboard body');
    } finally {
      setup.renderer.destroy();
    }
  });
});
