import type { CollectibleType } from "isaac-typescript-definitions";

interface StateSlice<T> {
  readonly get: () => T;
  readonly set: (next: T) => void;
}

function createSlice<T>(initial: T): StateSlice<T> {
  let value = initial;
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
    },
  };
}

export const selectedItemType = createSlice<CollectibleType | undefined>(
  undefined,
);
export const selectedItemName = createSlice("");
export const isKeyboardOpen = createSlice(false);
export const overlayPinned = createSlice(false);
