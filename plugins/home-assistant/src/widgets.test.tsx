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
import {
  HOME_ASSISTANT_CONNECTION_ENTITY,
  HOME_ASSISTANT_SCENES_ENTITY,
  initialConnectionState,
  initialScenesState,
} from './entity.js';
import { ScenesWidget } from './widgets.js';

const renderable = detectRuntime().ffi;

function unconfiguredRuntime(): ReturnType<typeof createAppRuntime> {
  const entities = createEntityStore();
  entities.register(HOME_ASSISTANT_CONNECTION_ENTITY, initialConnectionState());
  entities.register(HOME_ASSISTANT_SCENES_ENTITY, initialScenesState());
  const runtime = createAppRuntime({ entities });
  for (const id of [
    'home-assistant.configure',
    'home-assistant.clear',
    'home-assistant.refresh',
    'home-assistant.activate-scene',
    'home-assistant.widget-mounted',
    'home-assistant.widget-unmounted',
  ]) {
    runtime.commands.register({ id, title: id, run: () => {} });
  }
  return runtime;
}

function connectedRuntime(): ReturnType<typeof createAppRuntime> {
  const entities = createEntityStore();
  entities.register(HOME_ASSISTANT_CONNECTION_ENTITY, {
    configured: true,
    baseUrl: 'http://192.168.1.10:8123',
    status: 'connected',
    error: null,
    lastSyncedAt: Date.now(),
  });
  entities.register(HOME_ASSISTANT_SCENES_ENTITY, {
    scenes: [{ entityId: 'scene.focus', name: 'Focus', state: 'scening' }],
    loading: false,
    error: null,
    activatingId: null,
  });
  const runtime = createAppRuntime({ entities });
  for (const id of [
    'home-assistant.configure',
    'home-assistant.clear',
    'home-assistant.refresh',
    'home-assistant.activate-scene',
    'home-assistant.widget-mounted',
    'home-assistant.widget-unmounted',
  ]) {
    runtime.commands.register({ id, title: id, run: () => {} });
  }
  return runtime;
}

describe.skipIf(!renderable)('ScenesWidget', () => {
  it('shows the configure form when unconfigured', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={unconfiguredRuntime()}>
          <ScenesWidget options={{}} width={60} height={16} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 64, height: 18 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toMatch(/Address|Token|long-lived|Home Assistant/i);
    } finally {
      setup.renderer.destroy();
    }
  });

  it('lists scenes when connected', async () => {
    const setup = await testRender(
      <ThemeProvider theme={MIDNIGHT_THEME}>
        <RuntimeProvider runtime={connectedRuntime()}>
          <ScenesWidget options={{}} width={60} height={16} />
        </RuntimeProvider>
      </ThemeProvider>,
      { width: 64, height: 18 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toMatch(/Focus/);
      expect(frame).toMatch(/Activate/);
    } finally {
      setup.renderer.destroy();
    }
  });
});
