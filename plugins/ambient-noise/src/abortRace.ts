/**
 * Await a sink drain, but resolve early if `signal` aborts.
 * Always removes the abort listener when either side wins (unlike a bare
 * `Promise.race` with a one-shot abort promise, which leaks listeners for
 * every chunk that drains normally).
 */
export function drainOrAbort(drain: Promise<void>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    signal.addEventListener('abort', onAbort);
    drain.then(
      () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
