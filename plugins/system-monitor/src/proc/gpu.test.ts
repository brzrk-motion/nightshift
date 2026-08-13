import { describe, expect, it, vi } from 'vitest';
import { readGpuPercent } from './gpu.js';

describe('readGpuPercent', () => {
  it('reads gpu_busy_percent when present', async () => {
    const readFile = vi.fn(async (path: string) => {
      if (path.endsWith('gpu_busy_percent')) return '42\n';
      throw new Error('missing');
    });
    const readDir = vi.fn(async () => ['card0']);

    expect(await readGpuPercent(readFile, readDir)).toBe(42);
  });

  it('returns null when sysfs is unavailable', async () => {
    const readDir = vi.fn(async () => {
      throw new Error('missing');
    });
    expect(await readGpuPercent(vi.fn(), readDir)).toBeNull();
  });
});
