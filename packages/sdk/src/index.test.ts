import { describe, expect, it } from 'vitest';
import { NIGHTSHIFT_API_VERSION, NightshiftError } from '@nightshift/core';
import { definePlugin, isCompatible } from './index.js';

const base = {
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  capabilities: [] as never[],
  setup: () => {},
};

describe('definePlugin', () => {
  it('defaults apiVersion to the current contract', () => {
    expect(definePlugin(base).manifest.apiVersion).toBe(NIGHTSHIFT_API_VERSION);
  });

  it('freezes the manifest so the runtime can trust it', () => {
    const plugin = definePlugin(base);
    expect(Object.isFrozen(plugin.manifest)).toBe(true);
  });

  it('rejects an id that is not kebab-case', () => {
    expect(() => definePlugin({ ...base, id: 'Demo Plugin' })).toThrow(NightshiftError);
  });

  it('rejects an empty name', () => {
    expect(() => definePlugin({ ...base, name: '  ' })).toThrow(NightshiftError);
  });

  it('copies capabilities rather than aliasing the caller array', () => {
    const capabilities = ['network'] as const;
    const plugin = definePlugin({ ...base, capabilities: [...capabilities] });
    expect(plugin.manifest.capabilities).toEqual(['network']);
    expect(plugin.manifest.capabilities).not.toBe(capabilities);
  });
});

describe('isCompatible', () => {
  it('accepts the current contract and rejects anything else', () => {
    expect(isCompatible(definePlugin(base).manifest)).toBe(true);
    expect(isCompatible(definePlugin({ ...base, apiVersion: 99 }).manifest)).toBe(false);
  });
});
