import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNullLogger, DEFAULT_CONFIG, resolvePaths } from '@nightshift/services';
import type { CliContext } from '../context.js';
import { collectReport } from './doctor.js';

let dir: string;

function contextFor(overrides: Partial<CliContext> = {}): CliContext {
  return {
    config: { ...DEFAULT_CONFIG },
    paths: resolvePaths({ configDir: dir }),
    configExists: true,
    log: createNullLogger(),
    json: true,
    ...overrides,
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nightshift-doctor-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('collectReport', () => {
  it('reports on every check and summarises the worst status', async () => {
    const report = await collectReport(contextFor());
    const names = report.checks.map((check) => check.name);
    expect(names).toContain('node');
    expect(names).toContain('config directory');
    expect(names).toContain('theme');
    expect(['ok', 'warn', 'fail']).toContain(report.status);
    expect(report.configDir).toBe(dir);
  });

  it('passes the config directory check for a writable directory', async () => {
    const report = await collectReport(contextFor());
    const check = report.checks.find((entry) => entry.name === 'config directory');
    expect(check?.status).toBe('ok');
  });

  it('warns when the config file has not been created yet', async () => {
    const report = await collectReport(contextFor({ configExists: false }));
    const check = report.checks.find((entry) => entry.name === 'config file');
    expect(check?.status).toBe('warn');
    expect(check?.hint).toBeTruthy();
  });

  it('warns about an unknown theme and an unknown default vibe', async () => {
    const report = await collectReport(
      contextFor({ config: { ...DEFAULT_CONFIG, theme: 'nope', defaultVibe: 'nope' } }),
    );
    expect(report.checks.find((entry) => entry.name === 'theme')?.status).toBe('warn');
    const vibes = report.checks.find((entry) => entry.name === 'vibes');
    expect(vibes?.status).toBe('warn');
    expect(vibes?.detail).toMatch(/default "nope" not found/);
    expect(report.status).not.toBe('ok');
  });

  it('accepts a null default vibe, and counts the three built-ins', async () => {
    const report = await collectReport(contextFor());
    const check = report.checks.find((entry) => entry.name === 'vibes');
    expect(check?.status).toBe('ok');
    expect(check?.detail).toBe('3 available');
  });
});
