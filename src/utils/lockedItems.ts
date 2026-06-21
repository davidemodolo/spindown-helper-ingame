import type {
  CollectibleType,
  ItemPoolType,
} from "isaac-typescript-definitions";
import { getDefaultItemPoolsForCollectibleType } from "isaacscript-common";
import { HIDDEN_SPINDOWN_IDS } from "../constants";

let cachedLockedItems: ReadonlySet<CollectibleType> | undefined;
let lockedItemsBuilt = false;

export function getLockedItems(): ReadonlySet<CollectibleType> {
  if (!lockedItemsBuilt) {
    error(
      "getLockedItems() was called before buildLockedItems(). Call buildLockedItems() first.",
    );
  }
  return cachedLockedItems!;
}

export function buildLockedItems(
  isUnlocked: (type: CollectibleType, poolType: ItemPoolType) => boolean,
): void {
  const locked = new Set<CollectibleType>();
  const numCollectibles = Isaac.GetItemConfig().GetCollectibles().Size;

  for (let id = 1; id <= numCollectibles; id++) {
    const type = id as CollectibleType;
    if (HIDDEN_SPINDOWN_IDS.has(type)) {
      continue;
    }
    const pools = getDefaultItemPoolsForCollectibleType(type);
    if (pools.length === 0) {
      continue;
    }
    if (!isUnlocked(type, pools[0]!)) {
      locked.add(type);
    }
  }

  cachedLockedItems = locked;
  lockedItemsBuilt = true;
}
