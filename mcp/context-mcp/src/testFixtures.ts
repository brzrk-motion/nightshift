import { createExtractor } from './extract.js';
import { type QueryContext } from './query.js';
import { createCodeIndex, type FileSystem } from './store.js';
import { TEST_ROOT, testAbsPath, testRelPath } from './testRoot.js';

function createTestFileSystem(sources: Record<string, string>): FileSystem {
  return {
    async stat(path) {
      const source = sources[testRelPath(path)];
      if (source === undefined) throw new Error(`ENOENT ${path}`);
      return { size: source.length, mtimeMs: 1 };
    },
    async readFile(path) {
      const source = sources[testRelPath(path)];
      if (source === undefined) throw new Error(`ENOENT ${path}`);
      return source;
    },
    list: () => Object.keys(sources).sort(),
  };
}

/** Builds a fully indexed {@link QueryContext} from in-memory sources under {@link TEST_ROOT}. */
export async function makeTestIndex(sources: Record<string, string>): Promise<QueryContext> {
  const io = createTestFileSystem(sources);
  const index = createCodeIndex({ root: TEST_ROOT, extractor: await createExtractor(), io });
  await index.reindexAll();
  return { index, readSource: (file) => io.readFile(testAbsPath(file)) };
}
