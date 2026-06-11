import {
  CollectibleType,
  EntityType,
  ModCallback,
  PickupVariant,
  SoundEffect,
} from "isaac-typescript-definitions";
import type { ModUpgraded } from "isaacscript-common";
import {
  Callback,
  fonts,
  inDeathCertificateArea,
  ModFeature,
  sfxManager,
} from "isaacscript-common";
import state from "../state";
import { computeSpins } from "../utils/calculator";
import { getSpinColor } from "../utils/color";

const CAR_BATTERY_ID = CollectibleType.CAR_BATTERY; // 356

export class PedestalOverlayFeature extends ModFeature {
  private itemSprite: Sprite | undefined;
  private lastGfxFileName = "";
  private lastPlayedRoom = -1;
  private lineDelayFrames = 0;
  private noSprite: Sprite | undefined;
  private noCBSprite: Sprite | undefined;
  private noDNSprite: Sprite | undefined;

  constructor(mod: ModUpgraded) {
    super(mod, false);
  }

  @Callback(ModCallback.POST_RENDER)
  postRender(): void {
    if (!state.overlayPinned) {
      return;
    }
    if (
      state.selectedItemType === undefined
      || state.selectedItemName.length === 0
    ) {
      return;
    }
    const player = Isaac.GetPlayer(0);
    if (player === undefined) {
      return;
    }

    if (state.isKeyboardOpen) {
      this.renderBottomHUD(state.selectedItemName);
      return;
    }

    if (inDeathCertificateArea()) {
      this.renderDeathCertificate(player);
    } else {
      this.renderBottomHUD(state.selectedItemName);
      this.renderPedestalSpins(player);
    }
  }

  private ensureItemSprite(): Sprite | undefined {
    if (state.selectedItemType === undefined) {
      return undefined;
    }
    const collectible = Isaac.GetItemConfig().GetCollectible(
      state.selectedItemType,
    );
    if (collectible === undefined) {
      return undefined;
    }
    const gfxFileName = collectible.GfxFileName;
    if (this.itemSprite === undefined || this.lastGfxFileName !== gfxFileName) {
      this.itemSprite = Sprite();
      this.itemSprite.Load("gfx/005.100_collectible.anm2", true);
      this.itemSprite.ReplaceSpritesheet(1, gfxFileName);
      this.itemSprite.LoadGraphics();
      this.lastGfxFileName = gfxFileName;
    }
    return this.itemSprite;
  }

  private renderBottomHUD(text: string, r = 1, g = 1, b = 1): void {
    const sprite = this.ensureItemSprite();
    const sw = Isaac.GetScreenWidth();
    const sh = Isaac.GetScreenHeight();
    const nameW = text.length * 5;
    const blockW = 20 + nameW;
    const startX = Math.floor((sw - blockW) / 2);
    const y = sh - 26;
    if (sprite !== undefined) {
      sprite.Color = Color(r, g, b, 1);
      sprite.SetFrame("Idle", 8);
      sprite.Scale = Vector(0.5, 0.5);
      sprite.Render(Vector(startX + 8, y + 18), Vector(0, 0), Vector(0, 0));
    }
    Isaac.RenderScaledText(text, startX + 20, y, 0.75, 0.75, r, g, b, 0.9);
  }

  private getIndicatorSprite(label: string): Sprite | undefined {
    if (label === "NO") {
      if (this.noSprite === undefined) {
        this.noSprite = Sprite();
        this.noSprite.Load("gfx/ui/nospin.anm2", true);
        this.noSprite.SetFrame("idle", 0);
        this.noSprite.LoadGraphics();
      }
      return this.noSprite;
    }
    if (label === "CB") {
      if (this.noCBSprite === undefined) {
        this.noCBSprite = Sprite();
        this.noCBSprite.Load("gfx/ui/nospin_cb.anm2", true);
        this.noCBSprite.SetFrame("idle", 0);
        this.noCBSprite.LoadGraphics();
      }
      return this.noCBSprite;
    }
    if (label === "DN") {
      if (this.noDNSprite === undefined) {
        this.noDNSprite = Sprite();
        this.noDNSprite.Load("gfx/ui/nospin_dn.anm2", true);
        this.noDNSprite.SetFrame("idle", 0);
        this.noDNSprite.LoadGraphics();
      }
      return this.noDNSprite;
    }
    return undefined;
  }

  private renderPedestalSpins(player: EntityPlayer): void {
    if (state.selectedItemType === undefined) {
      return;
    }

    const carBattery = player.HasCollectible(CAR_BATTERY_ID);

    const entities = Isaac.GetRoomEntities();
    for (const entity of entities) {
      if (
        entity.Type !== EntityType.PICKUP
        || entity.Variant !== PickupVariant.COLLECTIBLE
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

      if (!result.reachable) {
        const sprite = this.getIndicatorSprite(result.label);
        if (sprite !== undefined) {
          sprite.Color = Color(200 / 255, 0, 0, 1);
          sprite.Scale = Vector(1, 1);
          sprite.Render(
            Vector(screenPos.X, screenPos.Y - 16),
            Vector(0, 0),
            Vector(0, 0),
          );
        }
        continue;
      }

      const color = getSpinColor(result.spins);
      const text = result.label;
      const textWidth = text.length * 5;
      fonts.terminus.DrawString(
        text,
        screenPos.X - textWidth / 2,
        screenPos.Y - 20,
        color,
        0,
        false,
      );
    }
  }

  private renderDeathCertificate(player: EntityPlayer): void {
    if (state.selectedItemType === undefined) {
      return;
    }

    const entities = Isaac.GetRoomEntities();
    let foundEntity: EntityPickup | null = null;

    for (const entity of entities) {
      if (
        entity.Type !== EntityType.PICKUP
        || entity.Variant !== PickupVariant.COLLECTIBLE
      ) {
        continue;
      }
      const pickup = entity.ToPickup();
      if (pickup !== undefined && pickup.SubType === state.selectedItemType) {
        foundEntity = pickup;
        break;
      }
    }

    if (foundEntity) {
      const roomIndex = Game().GetLevel().GetCurrentRoomIndex();
      if (roomIndex !== this.lastPlayedRoom) {
        sfxManager.Play(SoundEffect.HOLY_CARD, 1, 0, false, 1, 0);
        this.lastPlayedRoom = roomIndex;
        this.lineDelayFrames = 15;
      }
      if (this.lineDelayFrames > 0) {
        this.lineDelayFrames--;
      }
      this.renderItemFound(player, foundEntity);
    } else {
      this.lastPlayedRoom = -1;
      this.lineDelayFrames = 0;
      this.renderBottomHUD(state.selectedItemName);
    }
  }

  private renderItemFound(player: EntityPlayer, pedestal: EntityPickup): void {
    this.renderBottomHUD(`${state.selectedItemName} here!`, 0.1, 1, 0.1);

    const playerPos = Isaac.WorldToScreen(player.Position);
    playerPos.Y -= 10;
    const itemPos = Isaac.WorldToScreen(pedestal.Position);
    itemPos.Y -= 10;
    const greenColor = KColor(0.1, 1, 0.1, 1);

    if (this.lineDelayFrames === 0) {
      const dx = itemPos.X - playerPos.X;
      const dy = itemPos.Y - playerPos.Y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const dotSpacing = 10;
      const numDots = Math.floor(distance / dotSpacing);

      for (let i = 1; i <= numDots; i++) {
        const t = i / (numDots + 1);
        const x = playerPos.X + dx * t;
        const y = playerPos.Y + dy * t;
        fonts.terminus.DrawStringScaled(
          ".",
          x - 2,
          y - 2,
          1,
          1,
          greenColor,
          0,
          false,
        );
      }
    }
  }
}
