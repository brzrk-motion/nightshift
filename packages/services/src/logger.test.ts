import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger, createNullLogger } from './logger.js';

function captureStream(): { stream: Writable; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  return { stream, lines: () => chunks.join('').split('\n').filter(Boolean) };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nightshift-log-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createLogger', () => {
  it('drops records below the configured level', () => {
    const { stream, lines } = captureStream();
    const log = createLogger({ level: 'warn', stream, color: false });
    log.info('hidden');
    log.warn('shown');
    log.error('also shown');
    expect(lines()).toHaveLength(2);
  });

  it('tags child loggers with a nested scope', () => {
    const { stream, lines } = captureStream();
    const log = createLogger({ level: 'info', stream, color: false, scope: 'cli' });
    log.child('doctor').info('checking');
    expect(lines()[0]).toContain('cli:doctor');
  });

  it('emits no ANSI when colour is off', () => {
    const { stream, lines } = captureStream();
    createLogger({ level: 'info', stream, color: false }).info('plain');
    expect(lines()[0]).not.toContain('[');
  });

  it('respects a level changed at runtime', () => {
    const { stream, lines } = captureStream();
    const log = createLogger({ level: 'error', stream, color: false });
    log.debug('no');
    log.setLevel('debug');
    log.debug('yes');
    expect(lines()).toHaveLength(1);
  });

  it('writes JSON lines to the log file', async () => {
    const file = join(dir, 'logs', 'nightshift.log');
    const log = createLogger({ level: 'info', stream: null, file });
    log.info('to disk', { dashboard: 'home' });
    await log.close();

    const parsed = (await readFile(file, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      level: 'info',
      message: 'to disk',
      fields: { dashboard: 'home' },
    });
  });

  it('closes cleanly even without a file sink', async () => {
    await expect(createNullLogger().close()).resolves.toBeUndefined();
  });
});
