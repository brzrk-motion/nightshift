import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClipPublic, ClipStatus } from './entity.js';

const CLIP_ID = /^[a-z][a-z0-9-]*$/;

export interface CatalogEntry {
  id: string;
  name: string;
  file: string;
  path: string;
  status: ClipStatus;
}

export function defaultCatalogDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'test-audio');
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export async function loadCatalog(rootDir: string = defaultCatalogDir()): Promise<CatalogEntry[]> {
  const root = resolve(rootDir);
  let parsed: unknown;
  try {
    const raw = await readFile(join(root, 'clips.json'), 'utf8');
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Map<string, CatalogEntry>();
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record['id'] === 'string' ? record['id'].trim() : '';
    const name = typeof record['name'] === 'string' ? record['name'].trim() : '';
    const file = typeof record['file'] === 'string' ? record['file'].trim() : '';
    if (!CLIP_ID.test(id) || name === '' || file === '') continue;
    const path = resolve(root, file);
    if (!isInside(root, path)) continue;
    let status: ClipStatus = 'ok';
    try {
      await readFile(path);
    } catch {
      status = 'unavailable';
    }
    seen.set(id, { id, name, file, path, status });
  }
  return [...seen.values()];
}

export function toPublicClips(entries: CatalogEntry[]): ClipPublic[] {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    status: entry.status,
  }));
}
