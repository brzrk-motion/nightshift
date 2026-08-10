import { describe, expect, it } from 'vitest';
import { NIGHTSHIFT_API_VERSION, NightshiftError } from '@nightshift/core';
import {
  CAPABILITIES,
  definePlugin,
  Icon,
  isCapability,
  isCompatible,
  StatRow,
  Timeline,
  Toolbar,
} from './index.js';

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

describe('isCapability', () => {
  it('accepts every declared capability', () => {
    for (const capability of CAPABILITIES) {
      expect(isCapability(capability), capability).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isCapability('nope')).toBe(false);
    expect(isCapability(3)).toBe(false);
  });

  it('includes automations:register, granted automatically like widgets and commands', () => {
    expect(CAPABILITIES).toContain('automations:register');
  });
});

describe('phase 7 component re-exports', () => {
  it('re-exports the shell primitives a plugin widget can build with', () => {
    // A type-level check as much as a runtime one: if the SDK stopped
    // re-exporting one of these, this import would fail to compile.
    expect(typeof Icon).toBe('function');
    expect(typeof StatRow).toBe('function');
    expect(typeof Toolbar).toBe('function');
    expect(typeof Timeline).toBe('function');
  });
});
