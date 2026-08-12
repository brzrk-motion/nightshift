import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { createEntityStore } from '@nightshift/entities';
import { detectRuntime } from '../runtime.js';
import { createAppRuntime } from '../app.js';
import { RuntimeProvider, ThemeProvider } from '../context.js';
import { MIDNIGHT_THEME } from '../../theme.js';
import { VibeEditor } from './VibeEditor.js';
import { emptyDraft } from './vibeDraft.js';

const renderable = detectRuntime().ffi;

describe.skipIf(!renderable)('VibeEditor responsive layout', () => {
  it('keeps save controls visible on a narrow terminal', async () => {
    const entities = createEntityStore();
    entities.register('nightshift.dashboards', { dashboards: [] });
    const runtime = createAppRuntime({ entities });
    runtime.size = { width: 48, height: 16 };

    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={runtime}>
          <VibeEditor draft={emptyDraft()} onSave={() => {}} onCancel={() => {}} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 48, height: 16 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toContain('New vibe');
      expect(frame).toContain('Save');
      expect(frame).toContain('esc cancel');
      expect(frame).not.toContain('same format as a hand-edited file');
    } finally {
      setup.renderer.destroy();
    }
  });
});
