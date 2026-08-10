/** A value that survives a round trip through JSON. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Cancels a subscription. Calling it more than once must be safe. */
export type Unsubscribe = () => void;

/** Anything holding a resource that has to be released on shutdown. */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/** Recursively marks every property optional — used for partial config merges. */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
