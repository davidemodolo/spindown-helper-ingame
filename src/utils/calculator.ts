import { CollectibleType } from "isaac-typescript-definitions";
import { HIDDEN_SPINDOWN_IDS } from "../constants";
import { getLockedItems } from "./lockedItems";

export interface SpinResult {
  /** Display text (e.g. "5", "NO", "DN", "CB") */
  label: string;
  /** Number of spins needed, or -1 if unreachable */
  spins: number;
  /** Whether the target is reachable */
  reachable: boolean;
}

function countSkippedBetween(fromID: number, toID: number): number {
  let skipped = 0;
  const lockedItems = getLockedItems();

  for (const hiddenType of HIDDEN_SPINDOWN_IDS) {
    const hiddenID = hiddenType as number;
    if (hiddenID < fromID && hiddenID > toID) {
      skipped++;
    }
  }

  for (const lockedType of lockedItems) {
    const lockedID = lockedType as number;
    if (lockedID < fromID && lockedID > toID) {
      skipped++;
    }
  }

  return skipped;
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

  let steps = fromID - toID - countSkippedBetween(fromID, toID);

  if (toID < dadsNoteID && fromID > dadsNoteID) {
    const stepsToNote =
      fromID - dadsNoteID - countSkippedBetween(fromID, dadsNoteID);
    if (!carBattery || stepsToNote % 2 === 0) {
      return { label: "DN", spins: -1, reachable: false };
    }
  }

  // When many items between `fromID` and `toID` are skipped (hidden/locked), the
  // effective step count can drop to zero or below, making the target unreachable.
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
