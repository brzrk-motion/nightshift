import { describe, expect, it, vi } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { useKeyboard } from '@opentui/react';
import { act, useState, type ReactNode } from 'react';
import { detectRuntime, MIDNIGHT_THEME, ThemeProvider } from '@nightshift/ui';
import { WidgetPicker } from './WidgetPicker.js';
import { createWidgetRegistry } from './registry.js';
import { BUILT_IN_WIDGETS } from './widgets.js';

const renderable = detectRuntime().ffi;

function registry() {
  const widgets = createWidgetRegistry(BUILT_IN_WIDGETS);
  widgets.registerPlugin('focus', [
    {
      type: 'focus.session',
      title: 'Focus session',
      entities: ['timer.focus'],
      description: 'The running timer.',
      render: () => null,
    },
  ]);
  return widgets;
}

async function press(send: () => void): Promise<void> {
  await act(async () => {
    send();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

async function draw(node: ReactNode, width = 76, height = 22) {
  return testRender(<ThemeProvider theme={MIDNIGHT_THEME}>{node}</ThemeProvider>, {
    width,
    height,
  });
}

describe.skipIf(!renderable)('WidgetPicker', () => {
  it('lists every registered widget when closed query is empty', async () => {
    const setup = await draw(
      <WidgetPicker open registry={registry()} onClose={() => {}} onPick={() => {}} />,
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Focus session');
      expect(frame).toContain('core.entities');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('renders nothing when closed', async () => {
    const setup = await draw(
      <WidgetPicker open={false} registry={registry()} onClose={() => {}} onPick={() => {}} />,
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).not.toContain('Add a widget');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('filters by typing, matching type, title or source', async () => {
    const setup = await draw(
      <WidgetPicker open registry={registry()} onClose={() => {}} onPick={() => {}} />,
    );

    try {
      await setup.renderOnce();
      for (const char of 'focus') await press(() => setup.mockInput.pressKey(char));
      await setup.renderOnce();

      const frame = setup.captureCharFrame();
      expect(frame).toContain('Focus session');
      expect(frame).not.toContain('core.entities');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows a message when nothing matches', async () => {
    const setup = await draw(
      <WidgetPicker open registry={registry()} onClose={() => {}} onPick={() => {}} />,
    );

    try {
      await setup.renderOnce();
      for (const char of 'zzz') await press(() => setup.mockInput.pressKey(char));
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('No widget matches');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('picks the highlighted widget on enter and closes', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const setup = await draw(
      <WidgetPicker open registry={registry()} onClose={onClose} onPick={onPick} />,
    );

    try {
      await setup.renderOnce();
      for (const char of 'focus') await press(() => setup.mockInput.pressKey(char));
      await setup.renderOnce();
      await press(() => setup.mockInput.pressEnter());

      expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ type: 'focus.session' }));
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      setup.renderer.destroy();
    }
  });

  it('closes on escape without picking anything', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const setup = await draw(
      <WidgetPicker open registry={registry()} onClose={onClose} onPick={onPick} />,
    );

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressEscape());

      expect(onClose).toHaveBeenCalledOnce();
      expect(onPick).not.toHaveBeenCalled();
    } finally {
      setup.renderer.destroy();
    }
  });

  it('clears a typed query each time it reopens', async () => {
    const reg = registry();
    // A self-contained harness, the same shape AppShell uses for the command
    // palette: escape closes (via WidgetPicker's own handling), and a
    // ctrl-modified key reopens — plain letters are not usable for the
    // reopen key here, since the picker itself treats any of those as a
    // search character while it is open.
    function Harness() {
      const [open, setOpen] = useState(true);
      useKeyboard((key) => {
        if (key.name === 'o' && key.ctrl) setOpen(true);
      });
      return (
        <WidgetPicker open={open} registry={reg} onClose={() => setOpen(false)} onPick={() => {}} />
      );
    }

    const setup = await draw(<Harness />);

    try {
      await setup.renderOnce();
      for (const char of 'focus') await press(() => setup.mockInput.pressKey(char));
      await setup.renderOnce();
      expect(setup.captureCharFrame()).not.toContain('core.entities');

      await press(() => setup.mockInput.pressEscape());
      await press(() => setup.mockInput.pressKey('o', { ctrl: true }));
      await setup.renderOnce();

      expect(setup.captureCharFrame()).toContain('core.entities');
    } finally {
      setup.renderer.destroy();
    }
  });
});
