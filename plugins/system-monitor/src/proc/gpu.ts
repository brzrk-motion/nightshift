import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const GPU_BUSY_FILES = ['gpu_busy_percent', 'gt_busy_percent'] as const;

export type ReadFileFn = (path: string) => Promise<string>;
export type ReadDirFn = (path: string) => Promise<string[]>;

const defaultReadFile: ReadFileFn = (path) => readFile(path, 'utf8');
const defaultReadDir: ReadDirFn = (path) => readdir(path);

function parsePercent(content: string): number | null {
  const value = Number.parseInt(content.trim(), 10);
  if (Number.isNaN(value)) return null;
  return Math.min(100, Math.max(0, value));
}

async function readGpuFromCard(
  cardPath: string,
  readFileFn: ReadFileFn,
): Promise<number | null> {
  const devicePath = join(cardPath, 'device');
  for (const fileName of GPU_BUSY_FILES) {
    try {
      const content = await readFileFn(join(devicePath, fileName));
      const percent = parsePercent(content);
      if (percent !== null) return percent;
    } catch {
      // Try the next sysfs file.
    }
  }
  return null;
}

/** Best-effort GPU utilization from sysfs under /sys/class/drm/cardN/device/. */
export async function readGpuPercent(
  readFileFn: ReadFileFn = defaultReadFile,
  readDirFn: ReadDirFn = defaultReadDir,
): Promise<number | null> {
  let entries: string[];
  try {
    entries = await readDirFn('/sys/class/drm');
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!/^card\d+-/.test(entry) && !/^card\d+$/.test(entry)) continue;
    const percent = await readGpuFromCard(join('/sys/class/drm', entry), readFileFn);
    if (percent !== null) return percent;
  }

  return null;
}
