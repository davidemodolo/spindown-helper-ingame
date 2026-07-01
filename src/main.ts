import { ISCFeature, initModFeatures, upgradeMod } from "isaacscript-common";
import { MOD_NAME } from "./constants";
import { PedestalOverlayFeature } from "./features/pedestalOverlay";
import { VirtualKeyboardFeature } from "./features/virtualKeyboard";

const FEATURES = [VirtualKeyboardFeature, PedestalOverlayFeature] as const;

const ISC_FEATURES = [
  ISCFeature.SAVE_DATA_MANAGER,
  ISCFeature.ITEM_POOL_DETECTION,
] as const;

function upgradeSpindownMod(modVanilla: Mod) {
  return upgradeMod(modVanilla, ISC_FEATURES);
}

/** The mod object upgraded with the ISC features that this mod uses. */
export type SpindownMod = ReturnType<typeof upgradeSpindownMod>;

export function main(): void {
  const modVanilla = RegisterMod(MOD_NAME, 1);
  const mod = upgradeSpindownMod(modVanilla);
  initModFeatures(mod, FEATURES);
  Isaac.DebugString(`${MOD_NAME} initialized.`);
}
