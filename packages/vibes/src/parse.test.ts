import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isNightshiftError } from '@nightshift/core';
import {
  loadVibeFile,
  loadVibes,
  parseVibe,
  deleteVibe,
  saveVibe,
  serializeVibe,
} from './parse.js';

const LOCKED_IN = `
name: locked-in
title: Locked In
description: Deep work.
theme: midnight
dashboard: home
entities:
  timer.focus:
    status: idle
onActivate:
  - command: focus.start
    args:
      minutes: 50
onDeactivate:
  - focus.pause
`;

describe('parseVibe', () => {
  it('parses a complete vibe', () => {
    const vibe = parseVibe(LOCKED_IN);

    expect(vibe).toEqual({
      name: 'locked-in',
      title: 'Locked In',
      description: 'Deep work.',
      theme: 'midnight',
      dashboard: 'home',
      entities: { 'timer.focus': { status: 'idle' } },
      onActivate: [{ command: 'focus.start', args: { minutes: 50 } }],
      onDeactivate: [{ command: 'focus.pause' }],
    });
  });

  it('accepts a bare command string as shorthand for an action', () => {
    expect(parseVibe(LOCKED_IN).onDeactivate).toEqual([{ command: 'focus.pause' }]);
  });

  it('takes the name from the file when the document omits it', () => {
    expect(parseVibe('theme: midnight', { name: 'quiet' }).name).toBe('quiet');
  });

  it('rejects a document that is not a mapping', () => {
    expect(() => parseVibe('- one\n- two')).toThrowError(/must be a YAML mapping/);
  });

  it.each([
    ['theme: 3', /theme must be a theme name/],
    ['dashboard: 3', /dashboard must be a dashboard name/],
    ['entities: nope', /entities must be an object keyed by entity id/],
    ['entities:\n  bad-id: {}', /entities\.bad-id must be an entity id/],
    ['entities:\n  timer.focus: 3', /entities\.timer\.focus must be an object/],
    ['onActivate: nope', /onActivate must be a list of commands/],
    ['onActivate:\n  - {}', /onActivate\[0\].command must be a command id/],
    ['onActivate:\n  - {command: x, args: 3}', /onActivate\[0\].args must be an object/],
  ])('rejects %o', (source, message) => {
    expect(() => parseVibe(source, { name: 'test', source: 'test' })).toThrowError(message);
  });

  it('rejects invalid YAML with a hint', () => {
    try {
      parseVibe('theme: [\n  unclosed');
      expect.unreachable('parse should have thrown');
    } catch (error) {
      expect(isNightshiftError(error) && error.code).toBe('CONFIG_INVALID');
      expect(isNightshiftError(error) && error.hint).toBeTruthy();
    }
  });
});

describe('loadVibes', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-vibes-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads every YAML file, named after the file', async () => {
    await writeFile(join(dir, 'focus.yaml'), 'theme: midnight');
    await writeFile(join(dir, 'chill.yml'), 'theme: daylight');
    await writeFile(join(dir, 'notes.md'), 'ignore me');

    const result = await loadVibes(dir);

    expect(result.vibes.map((vibe) => vibe.name)).toEqual(['chill', 'focus']);
    expect(result.failed).toEqual([]);
  });

  it('reports a broken file instead of hiding the rest', async () => {
    await writeFile(join(dir, 'good.yaml'), 'theme: midnight');
    await writeFile(join(dir, 'bad.yaml'), 'theme: 3');

    const result = await loadVibes(dir);

    expect(result.vibes.map((vibe) => vibe.name)).toEqual(['good']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.path).toBe(join(dir, 'bad.yaml'));
  });

  it('is quiet about a directory that does not exist', async () => {
    expect(await loadVibes(join(dir, 'nope'))).toEqual({ vibes: [], failed: [] });
  });

  it('reports a missing file by path', async () => {
    await expect(loadVibeFile(join(dir, 'nope.yaml'))).rejects.toThrowError(/Could not read/);
  });
});

describe('serializeVibe', () => {
  it('round-trips a complete vibe', () => {
    const vibe = parseVibe(LOCKED_IN);
    expect(parseVibe(serializeVibe(vibe))).toEqual(vibe);
  });

  it('round-trips a minimal vibe', () => {
    const vibe = parseVibe('theme: midnight', { name: 'quiet' });
    const reparsed = parseVibe(serializeVibe(vibe));
    expect(reparsed).toEqual({ name: 'quiet', theme: 'midnight' });
  });

  it('round-trips title and description', () => {
    const vibe = parseVibe('title: Quiet\ndescription: Shhh', { name: 'quiet' });
    expect(parseVibe(serializeVibe(vibe))).toEqual({
      name: 'quiet',
      title: 'Quiet',
      description: 'Shhh',
    });
  });
});

describe('saveVibe', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-vibe-save-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes <name>.yaml and round-trips', async () => {
    const vibe = parseVibe(LOCKED_IN);
    const path = await saveVibe(dir, vibe);
    expect(path).toBe(join(dir, 'locked-in.yaml'));
    expect(await loadVibeFile(path)).toEqual(vibe);
  });

  it('creates the directory when needed', async () => {
    const nested = join(dir, 'nested');
    await saveVibe(nested, { name: 'quiet', theme: 'midnight' });
    expect(await readFile(join(nested, 'quiet.yaml'), 'utf8')).toContain('theme: midnight');
  });

  it('overwrites an existing file of the same name', async () => {
    await saveVibe(dir, { name: 'quiet', title: 'Quiet' });
    await saveVibe(dir, { name: 'quiet', title: 'Renamed' });
    expect(await loadVibeFile(join(dir, 'quiet.yaml'))).toEqual({
      name: 'quiet',
      title: 'Renamed',
    });
  });
});

describe('deleteVibe', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nightshift-vibe-delete-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('deletes an existing vibe file', async () => {
    await saveVibe(dir, { name: 'quiet', theme: 'midnight' });
    await deleteVibe(dir, 'quiet');
    await expect(loadVibeFile(join(dir, 'quiet.yaml'))).rejects.toThrowError(/Could not read/);
  });

  it('errors when the file is missing', async () => {
    await expect(deleteVibe(dir, 'nope')).rejects.toThrowError(/No user vibe file/);
  });

  it('errors when the directory is missing', async () => {
    await expect(deleteVibe(join(dir, 'nested', 'missing'), 'quiet')).rejects.toThrowError(
      /No user vibe file/,
    );
  });
});
