import {
  CollectibleType,
  EntityType,
  ModCallback,
  PickupVariant,
  SoundEffect,
} from "isaac-typescript-definitions";
import { Callback, inDeathCertificateArea, ModFeature, sfxManager } from "isaacscript-common";
import type { ModUpgraded } from "isaacscript-common";
import state from "../state";
import { computeSpins } from "../utils/calculator";
import { getSpinColor, getUnreachableColor } from "../utils/color";

const CAR_BATTERY_ID = CollectibleType.CAR_BATTERY; // 356

export class PedestalOverlayFeature extends ModFeature {
  private spinFont: Font | undefined;
  private itemSprite: Sprite | undefined;
  private lastGfxFileName = "";
  private lastPlayedRoom = -1;
  private lineDelayFrames = 0;

  constructor(mod: ModUpgraded) {
    super(mod, false);
  }

  @Callback(ModCallback.POST_RENDER)
  postRender(): void {
    if (!state.overlayPinned || state.isKeyboardOpen) {
      return;
    }
    if (state.selectedItemType === undefined || state.selectedItemName.length === 0) {
      return;
    }
    this.renderBottomHUD();
    const player = Isaac.GetPlayer(0);
    if (player === undefined) {
      return;
    }

    if (inDeathCertificateArea()) {
      this.renderDeathCertificate(player);
    } else {
      this.renderPedestalSpins(player);
    }
  }

  private ensureItemSprite(): Sprite | undefined {
    if (state.selectedItemType === undefined) {
      return undefined;
    }
    const collectible = Isaac.GetItemConfig().GetCollectible(state.selectedItemType);
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

  private renderBottomHUD(): void {
    const sprite = this.ensureItemSprite();
    const sw = Isaac.GetScreenWidth();
    const sh = Isaac.GetScreenHeight();
    const nameW = state.selectedItemName.length * 5;
    const blockW = 20 + nameW;
    const startX = Math.floor((sw - blockW) / 2);
    const y = sh - 26;
    if (sprite !== undefined) {
      sprite.Color = Color(1, 1, 1, 1);
      sprite.SetFrame("Idle", 8);
      sprite.Scale = Vector(0.5, 0.5);
      sprite.Render(Vector(startX + 8, y + 15), Vector(0, 0), Vector(0, 0));
    }
    Isaac.RenderScaledText(state.selectedItemName, startX + 20, y, 0.75, 0.75, 1, 1, 1, 0.9);
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

  private renderDeathCertificate(player: EntityPlayer): void {
    if (state.selectedItemType === undefined) {
      return;
    }

    const entities = Isaac.GetRoomEntities();
    let foundEntity: EntityPickup | null = null;

    for (const entity of entities) {
      if (
        entity.Type !== EntityType.PICKUP ||
        entity.Variant !== PickupVariant.COLLECTIBLE
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
    }
  }

  private renderItemFound(player: EntityPlayer, pedestal: EntityPickup): void {
    if (this.spinFont === undefined) {
      this.spinFont = Font();
      this.spinFont.Load("font/pftempestasevencondensed.fnt");
    }

    const playerPos = Isaac.WorldToScreen(player.Position);
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
        this.spinFont.DrawStringScaled(".", x - 2, y - 2, 1, 1, greenColor, 0, false);
      }
    }

    Isaac.RenderScaledText(
      `${state.selectedItemName} here!`,
      85,
      255,
      0.75,
      0.75,
      0.1,
      1,
      0.1,
      0.9,
    );
  }
}
