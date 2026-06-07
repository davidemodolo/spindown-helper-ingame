import type { CollectibleType } from "isaac-typescript-definitions";
import { HIDDEN_SPINDOWN_IDS } from "../constants";

export interface SpinResult {
  /** Display text (e.g. "5", "NO", "DN", "CB") */
  label: string;
  /** Number of spins needed, or -1 if unreachable */
  spins: number;
  /** Whether the target is reachable */
  reachable: boolean;
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

  // Hidden items cannot be targets (Spindown skips them)
  if (HIDDEN_SPINDOWN_IDS.has(toType)) {
    return { label: "NO", spins: -1, reachable: false };
  }

  // Dad's Note is immune to all rerolls
  if (fromType === (668 as CollectibleType)) {
    return { label: "NO", spins: -1, reachable: false };
  }

  let steps = fromID - toID;

  for (const hiddenType of HIDDEN_SPINDOWN_IDS) {
    const hiddenID = hiddenType as number;
    if (hiddenID < fromID && hiddenID > toID) {
      steps--;
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
