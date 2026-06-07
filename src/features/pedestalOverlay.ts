import {
  CollectibleType,
  EntityType,
  ModCallback,
  PickupVariant,
} from "isaac-typescript-definitions";
import { ModFeature, Callback } from "isaacscript-common";
import type { ModUpgraded } from "isaacscript-common";
import state from "../state";
import { computeSpins } from "../utils/calculator";
import { getSpinColor, getUnreachableColor } from "../utils/color";
import { screenToRenderPos } from "../utils/render";

const v = {
  run: {},
};

const CAR_BATTERY_ID = CollectibleType.CAR_BATTERY; // 356

export class PedestalOverlayFeature extends ModFeature {
  v = v;

  private spinFont: Font | undefined;
  private itemSprite: Sprite | undefined;
  private lastGfxFileName = "";

  constructor(mod: ModUpgraded) {
    super(mod, false);
  }

  @Callback(ModCallback.POST_RENDER)
  postRender(): void {
    if (!state.isOverlayActive) {
      return;
    }

    if (
      state.selectedItemType === undefined ||
      state.selectedItemName.length === 0
    ) {
      this.renderNoTargetMessage();
      return;
    }

    const player = Isaac.GetPlayer(0);
    if (player === undefined) {
      return;
    }

    this.renderTargetInfo();
    this.renderPedestalSpins(player);
  }

  private renderNoTargetMessage(): void {
    Isaac.RenderText(
      "No target item selected (press F2)",
      10, 10,
      1, 1, 1, 1,
    );
  }

  private renderTargetInfo(): void {
    if (state.selectedItemType === undefined) {
      return;
    }

    const itemConfig = Isaac.GetItemConfig();
    const collectible = itemConfig.GetCollectible(state.selectedItemType);
    if (collectible !== undefined) {
      const gfxFileName = collectible.GfxFileName;

      if (
        this.itemSprite === undefined ||
        this.lastGfxFileName !== gfxFileName
      ) {
        this.itemSprite = Sprite();
        this.itemSprite.Load("gfx/005.100_collectible.anm2", true);
        this.itemSprite.ReplaceSpritesheet(1, gfxFileName);
        this.itemSprite.LoadGraphics();
        this.lastGfxFileName = gfxFileName;
      }

      this.itemSprite.Color = Color(1, 1, 1, 1);
      this.itemSprite.SetFrame("Idle", 8);
      this.itemSprite.Scale = Vector(0.5, 0.5);
      this.itemSprite.Render(
        screenToRenderPos(20, 28),
        Vector(0, 0),
        Vector(0, 0),
      );
    }

    Isaac.RenderText(
      state.selectedItemName,
      48, 28,
      1, 1, 1, 0.8,
    );
  }

  private renderPedestalSpins(player: EntityPlayer): void {
    if (state.selectedItemType === undefined) {
      return;
    }

    if (this.spinFont === undefined) {
      this.spinFont = Font();
      this.spinFont.Load("font/pftempestasevencondensed.fnt");
    }

    const carBattery = player.HasCollectible(CAR_BATTERY_ID);

    const entities = Isaac.GetRoomEntities();
    for (const entity of entities) {
      if (
        entity.Type !== EntityType.PICKUP ||
        entity.Variant !== PickupVariant.COLLECTIBLE
      ) {
        continue;
      }

      const pickup = entity.ToPickup();
      if (pickup === undefined) {
        continue;
      }

      const result = computeSpins(
        pickup.SubType,
        state.selectedItemType,
        carBattery,
      );

      const screenPos = Isaac.WorldToScreen(entity.Position);
      const color = result.reachable
        ? getSpinColor(result.spins)
        : getUnreachableColor();

      const text = result.label;
      const textWidth = text.length * 4;
      this.spinFont.DrawString(
        text,
        screenPos.X - textWidth / 2,
        screenPos.Y - 20,
        color,
        0,
        false,
      );
    }
  }
}
