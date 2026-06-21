export interface Memo<T> {
  get(): T;
  invalidate(): void;
}

export function memoize<T>(factory: () => T): Memo<T> {
  let cached: T | undefined;
  let initialized = false;
  return {
    get() {
      if (!initialized) {
        cached = factory();
        initialized = true;
      }
      return cached!;
    },
    invalidate() {
      initialized = false;
      cached = undefined;
    },
  };
}
