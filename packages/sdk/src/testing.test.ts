import { describe, expect, it, vi } from 'vitest';
import { NIGHTSHIFT_API_VERSION } from '@nightshift/core';
import { createPluginTestContext } from './testing.js';

describe('createPluginTestContext', () => {
  it('defaults the manifest and rejects fetch until overridden', async () => {
    const { context, notify } = createPluginTestContext();

    expect(context.manifest).toEqual({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '0.0.0',
      apiVersion: NIGHTSHIFT_API_VERSION,
      capabilities: [],
    });
    expect(notify).not.toHaveBeenCalled();
    await expect(context.fetch('https://example.com')).rejects.toThrow(
      'unexpected fetch in plugin test',
    );
  });

  it('seeds storage, accepts a custom fetch, and records registrations', async () => {
    const fetch = vi.fn(async () => new Response('ok'));
    const { context, entities, commands, widgets, automations, storageData, disposers, notify } =
      createPluginTestContext({
        manifest: {
          id: 'demo',
          name: 'Demo',
          version: '1.2.3',
          apiVersion: NIGHTSHIFT_API_VERSION,
          capabilities: ['network'],
        },
        storageData: { settings: { hour12: true } },
        fetch,
        fetchErrorMessage: 'should not be used',
      });

    expect(await context.storage.get('settings')).toEqual({ hour12: true });
    await context.storage.set('settings', { hour12: false });
    expect(storageData.get('settings')).toEqual({ hour12: false });
    await context.storage.delete('settings');
    expect(storageData.has('settings')).toBe(false);

    await expect(context.fetch('https://example.com')).resolves.toBeInstanceOf(Response);
    expect(fetch).toHaveBeenCalledOnce();

    context.registerEntity('demo.state', { ready: true });
    expect(entities.get('demo.state')).toEqual({ ready: true });
    expect(context.entities.get('demo.state')?.state).toEqual({ ready: true });

    context.entities.update('demo.state', { ready: false });
    expect(entities.get('demo.state')).toEqual({ ready: false });

    context.registerCommand({
      id: 'demo.run',
      title: 'Run',
      run: async () => {},
    });
    context.registerWidget({ type: 'demo.widget', title: 'Demo', entities: ['demo.state'] });
    context.registerAutomation({
      name: 'demo.rule',
      when: { type: 'entity', entity: 'demo.state', key: 'ready' },
      then: [{ command: 'demo.run' }],
    });
    expect([...commands.keys()]).toEqual(['demo.run']);
    expect(widgets).toHaveLength(1);
    expect(automations.map((a) => a.name)).toEqual(['demo.rule']);

    const dispose = vi.fn();
    context.own(dispose);
    context.own({ dispose });
    expect(disposers).toHaveLength(2);
    for (const release of disposers) release();
    expect(dispose).toHaveBeenCalledTimes(2);

    context.notify('hello', { tone: 'info' });
    expect(notify).toHaveBeenCalledWith('hello', { tone: 'info' });
  });
});
