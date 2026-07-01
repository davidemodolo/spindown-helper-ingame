import { CollectibleType } from "isaac-typescript-definitions";
import { HIDDEN_SPINDOWN_IDS } from "../constants";
import { getLockedItems } from "./lockedItems";

interface SpinResult {
  /** Display text (e.g. "5", "NO", "DN", "CB") */
  label: string;
  /** Number of spins needed, or negative one if unreachable. */
  spins: number;
  /** Whether the target is reachable. */
  reachable: boolean;
}

function unreachable(label: string): SpinResult {
  return { label, spins: -1, reachable: false };
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
    return unreachable("NO");
  }

  if (HIDDEN_SPINDOWN_IDS.has(toType)) {
    return unreachable("NO");
  }

  const lockedItems = getLockedItems();
  if (lockedItems.has(toType)) {
    return unreachable("NO");
  }

  if (fromType === CollectibleType.DADS_NOTE) {
    return unreachable("NO");
  }

  const dadsNoteID = CollectibleType.DADS_NOTE as number;

  let steps = fromID - toID - countSkippedBetween(fromID, toID);

  const dadsNoteLocked = lockedItems.has(CollectibleType.DADS_NOTE);
  if (!dadsNoteLocked && toID < dadsNoteID && fromID > dadsNoteID) {
    const stepsToNote =
      fromID - dadsNoteID - countSkippedBetween(fromID, dadsNoteID);
    if (!carBattery || stepsToNote % 2 === 0) {
      return unreachable("DN");
    }
  }

  // If many items between fromID and toID are skipped as hidden or locked, the effective step count
  // can drop to zero or negative, making the target unreachable. This is common when many items
  // near the target are locked and the two collectible IDs are close together.
  if (steps <= 0) {
    return unreachable("NO");
  }

  if (carBattery) {
    if (steps % 2 !== 0) {
      return unreachable("CB");
    }
    steps = Math.floor(steps / 2);
  }

  return { label: String(steps), spins: steps, reachable: true };
}
