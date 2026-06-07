import type { CollectibleType } from "isaac-typescript-definitions";
import type { ItemEntry } from "./utils/items";

const state = {
  selectedItemType: undefined as CollectibleType | undefined,
  selectedItemName: "" as string,

  searchText: "" as string,
  isKeyboardOpen: false as boolean,
  isOverlayActive: false as boolean,

  keyboardCursorRow: 0 as number,
  keyboardCursorCol: 0 as number,
  cursorInResults: false as boolean,

  matchedItems: [] as ItemEntry[],
  selectedResultIndex: 0 as number,

  moveCooldown: 0 as number,
};

export default state;
