import { CollectibleType, ItemPoolType } from "isaac-typescript-definitions";
import { getDefaultItemPoolsForCollectibleType } from "isaacscript-common";
import { HIDDEN_SPINDOWN_IDS } from "../constants";

export interface SpinResult {
  /** Display text (e.g. "5", "NO", "DN", "CB") */
  label: string;
  /** Number of spins needed, or -1 if unreachable */
  spins: number;
  /** Whether the target is reachable */
  reachable: boolean;
}

let cachedLockedItems: ReadonlySet<CollectibleType> | undefined;

export function getLockedItems(): ReadonlySet<CollectibleType> {
  if (cachedLockedItems !== undefined) {
    return cachedLockedItems;
  }
  return new Set<CollectibleType>();
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
}

export function computeSpins(
  fromType: CollectibleType,
  toType: CollectibleType,
  carBattery: boolean,
): SpinResult {
  const fromID = fromType as number;
  const toID = toType as number;

  if (fromID <= toID) {
    return { label: "NO", spins: -1, reachable: false };
  }

  if (HIDDEN_SPINDOWN_IDS.has(toType)) {
    return { label: "NO", spins: -1, reachable: false };
  }

  const lockedItems = getLockedItems();
  if (lockedItems.has(toType)) {
    return { label: "NO", spins: -1, reachable: false };
  }

  if (fromType === CollectibleType.DADS_NOTE) {
    return { label: "NO", spins: -1, reachable: false };
  }

  const dadsNoteID = CollectibleType.DADS_NOTE as number;

  let steps = fromID - toID;

  for (const hiddenType of HIDDEN_SPINDOWN_IDS) {
    const hiddenID = hiddenType as number;
    if (hiddenID < fromID && hiddenID > toID) {
      steps--;
    }
  }

  for (const lockedType of lockedItems) {
    const lockedID = lockedType as number;
    if (lockedID < fromID && lockedID > toID) {
      steps--;
    }
  }

  if (toID < dadsNoteID && fromID > dadsNoteID) {
    let stepsToNote = fromID - dadsNoteID;
    for (const hiddenType of HIDDEN_SPINDOWN_IDS) {
      const hiddenID = hiddenType as number;
      if (hiddenID < fromID && hiddenID > dadsNoteID) {
        stepsToNote--;
      }
    }
    for (const lockedType of lockedItems) {
      const lockedID = lockedType as number;
      if (lockedID < fromID && lockedID > dadsNoteID) {
        stepsToNote--;
      }
    }
    if (!carBattery || stepsToNote % 2 === 0) {
      return { label: "DN", spins: -1, reachable: false };
    }
  }

  if (steps <= 0) {
    return { label: "NO", spins: -1, reachable: false };
  }

  if (carBattery) {
    if (steps % 2 !== 0) {
      return { label: "CB", spins: -1, reachable: false };
    }
    steps = Math.floor(steps / 2);
  }

  return { label: String(steps), spins: steps, reachable: true };
}
