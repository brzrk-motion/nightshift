import { describe, expect, it } from 'vitest';
import { hydrateSettings, initialSettings, settingsToStorage } from './settings.js';

describe('initialSettings', () => {
  it('enables all graphs by default', () => {
    expect(initialSettings()).toEqual({
      version: 1,
      showCpu: true,
      showGpu: true,
      showNetwork: true,
      showRam: true,
    });
  });
});

describe('hydrateSettings', () => {
  it('returns defaults for corrupt storage', () => {
    expect(hydrateSettings(null)).toEqual(initialSettings());
    expect(hydrateSettings({ version: 2 })).toEqual(initialSettings());
    expect(hydrateSettings({ version: 1, showCpu: 'yes' })).toEqual(initialSettings());
  });

  it('round-trips valid v1 settings', () => {
    const stored = settingsToStorage({
      version: 1,
      showCpu: false,
      showGpu: true,
      showNetwork: false,
      showRam: true,
    });
    expect(hydrateSettings(stored)).toEqual({
      version: 1,
      showCpu: false,
      showGpu: true,
      showNetwork: false,
      showRam: true,
    });
  });
});
