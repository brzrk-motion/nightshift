import { describe, expect, it } from 'vitest';
import { testRender } from '@opentui/react/test-utils';
import { detectRuntime } from '../app/runtime.js';
import { createAppRuntime } from '../app/app.js';
import { ColorField } from './ColorField.js';

const renderable = detectRuntime().ffi;

describe.skipIf(!renderable)('ColorField', () => {
  it('renders a swatch for valid hex input', async () => {
    const runtime = createAppRuntime();
    const setup = await testRender(
      <ColorField label="Accent" value="#7aa2ff" focused />,
      { width: 60, height: 10 },
    );

    try {
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain('#7aa2ff');
    } finally {
      setup.renderer.destroy();
    }
  });
});
