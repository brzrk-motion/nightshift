import { describe, expect, it, vi } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { detectRuntime, MIDNIGHT_THEME, ThemeProvider } from '@nightshift/ui';
import { act, type ReactNode } from 'react';
import { OnboardingModal } from './Onboarding.js';

const renderable = detectRuntime().ffi;

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

describe.skipIf(!renderable)('OnboardingModal', () => {
  it('draws nothing when closed', async () => {
    const setup = await draw(<OnboardingModal open={false} onClose={vi.fn()} />);

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).not.toContain('Welcome to Nightshift');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('shows the welcome copy when open', async () => {
    const setup = await draw(<OnboardingModal open onClose={vi.fn()} />);

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('Welcome to Nightshift');
      expect(frame).toContain('command palette');
    } finally {
      setup.renderer.destroy();
    }
  });

  it('calls onClose on any keypress', async () => {
    const onClose = vi.fn();
    const setup = await draw(<OnboardingModal open onClose={onClose} />);

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('x'));
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      setup.renderer.destroy();
    }
  });

  it('does not call onClose for a keypress while closed', async () => {
    const onClose = vi.fn();
    const setup = await draw(<OnboardingModal open={false} onClose={onClose} />);

    try {
      await setup.renderOnce();
      await press(() => setup.mockInput.pressKey('x'));
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      setup.renderer.destroy();
    }
  });
});
