import { describe, expect, it } from 'vitest';
import { drainOrAbort } from './abortRace.js';

describe('drainOrAbort', () => {
  it('removes the abort listener when drain wins', async () => {
    const ac = new AbortController();
    let adds = 0;
    let removes = 0;
    const signal = new Proxy(ac.signal, {
      get(target, prop, receiver) {
        if (prop === 'addEventListener') {
          return (...args: Parameters<AbortSignal['addEventListener']>) => {
            adds += 1;
            return target.addEventListener(...args);
          };
        }
        if (prop === 'removeEventListener') {
          return (...args: Parameters<AbortSignal['removeEventListener']>) => {
            removes += 1;
            return target.removeEventListener(...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as AbortSignal;

    await drainOrAbort(Promise.resolve(), signal);
    expect(adds).toBe(1);
    expect(removes).toBe(1);
  });

  it('resolves on abort without rejecting a pending drain', async () => {
    const ac = new AbortController();
    let settle!: () => void;
    const drain = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const raced = drainOrAbort(drain, ac.signal);
    ac.abort();
    await expect(raced).resolves.toBeUndefined();
    settle();
  });
});
