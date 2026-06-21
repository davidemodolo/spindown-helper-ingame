import { ISCFeature, initModFeatures, upgradeMod } from "isaacscript-common";
import { MOD_NAME } from "./constants";
import { PedestalOverlayFeature } from "./features/pedestalOverlay";
import { VirtualKeyboardFeature } from "./features/virtualKeyboard";

const FEATURES = [VirtualKeyboardFeature, PedestalOverlayFeature] as const;

export function main(): void {
  const modVanilla = RegisterMod(MOD_NAME, 1);
  const mod = upgradeMod(modVanilla, [
    ISCFeature.SAVE_DATA_MANAGER,
    ISCFeature.ITEM_POOL_DETECTION,
  ] as const);
  initModFeatures(mod, FEATURES);
  Isaac.DebugString(`${MOD_NAME} initialized.`);
}
