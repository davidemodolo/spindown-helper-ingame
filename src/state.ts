import type { CollectibleType } from "isaac-typescript-definitions";

export interface StateSlice<T> {
  readonly get: () => T;
  readonly set: (next: T) => void;
  subscribe(fn: () => void): () => void;
}

function createSlice<T>(initial: T): StateSlice<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      for (const fn of listeners) {
        fn();
      }
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

export const selectedItemType = createSlice<CollectibleType | undefined>(
  undefined,
);
export const selectedItemName = createSlice("");
export const isKeyboardOpen = createSlice(false);
export const overlayPinned = createSlice(false);
