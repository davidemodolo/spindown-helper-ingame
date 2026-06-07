import { ISCFeature, initModFeatures, upgradeMod } from "isaacscript-common";
import { VirtualKeyboardFeature } from "./features/virtualKeyboard";
import { PedestalOverlayFeature } from "./features/pedestalOverlay";
import { MOD_NAME } from "./constants";

const FEATURES = [VirtualKeyboardFeature, PedestalOverlayFeature] as const;

export function main(): void {
  const modVanilla = RegisterMod(MOD_NAME, 1);
  const mod = upgradeMod(
    modVanilla,
    [ISCFeature.SAVE_DATA_MANAGER] as const,
  );
  initModFeatures(mod, FEATURES);
  Isaac.DebugString(`${MOD_NAME} initialized.`);
}
