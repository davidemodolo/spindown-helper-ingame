import {
  ActiveSlot,
  CollectibleType,
  EntityType,
  ModCallback,
  Music,
  PickupVariant,
} from "isaac-typescript-definitions";
import type { ModUpgraded } from "isaacscript-common";
import {
  Callback,
  fonts,
  inDeathCertificateArea,
  ModFeature,
  musicManager,
} from "isaacscript-common";
import state from "../state";
import { buildLockedItems, computeSpins } from "../utils/calculator";
import { getSpinColor } from "../utils/color";

const CAR_BATTERY_ID = CollectibleType.CAR_BATTERY; // 356
const SPINDOWN_DICE_ID = CollectibleType.SPINDOWN_DICE; // 723
const INDICATOR_SCALE = 1 / 3;

const ORBIT_RADIUS = 18;
const ORBIT_RADIUS_GROW = 0.5;
const ORBIT_SPEED = 0.04;
const FLY_SPEED = 0.04;
const ARRIVAL_DIST = 3;
const FAMILIAR_SCALE = 0.5;

export class PedestalOverlayFeature extends ModFeature {
  private readonly modRef: ModUpgraded;
  private itemSprite: Sprite | undefined;
  private lastGfxFileName = "";
  private lastPlayedRoom = -1;
  private lineDelayFrames = 0;
  private noSprite: Sprite | undefined;
  private noCBSprite: Sprite | undefined;
  private noDNSprite: Sprite | undefined;
  private cachedDCRoom = -1;
  private cachedDCItemType: CollectibleType | undefined;
  private cachedDCEntity: EntityPickup | null | undefined;
  private familiarPos: Vector | null = null;
  private familiarOrbiting = false;
  private familiarOrbitAngle = 0;
  private orbitRadius = 0;
  private lastDCTargetEntity: EntityPickup | null = null;
  private yoListenSprite: Sprite | undefined;
  private haloSprite: Sprite | undefined;

  constructor(mod: ModUpgraded) {
    super(mod, false);
    this.modRef = mod;
  }

  @Callback(ModCallback.POST_GAME_STARTED)
  postGameStarted(): void {
    const api = this.modRef as unknown as {
      isCollectibleUnlocked: (
        collectibleType: number,
        itemPoolType: number,
      ) => boolean;
    };
    buildLockedItems((type, poolType) =>
      api.isCollectibleUnlocked(type as number, poolType as number),
    );
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

    const inDC = inDeathCertificateArea();
    if (!inDC && !this.hasSpindownDice(player)) {
      return;
    }

    if (state.isKeyboardOpen) {
      this.renderBottomHUD(state.selectedItemName);
      return;
    }

    if (inDC) {
      this.renderDeathCertificate(player);
    } else {
      this.renderBottomHUD(state.selectedItemName);
      this.renderPedestalSpins(player);
    }
  }

  private hasSpindownDice(player: EntityPlayer): boolean {
    return (
      player.GetActiveItem(ActiveSlot.PRIMARY) === SPINDOWN_DICE_ID
      || player.GetActiveItem(ActiveSlot.SECONDARY) === SPINDOWN_DICE_ID
      || player.GetActiveItem(ActiveSlot.POCKET) === SPINDOWN_DICE_ID
    );
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
          sprite.Scale = Vector(INDICATOR_SCALE, INDICATOR_SCALE);
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
    const itemType = state.selectedItemType;
    if (itemType === undefined) {
      return;
    }

    const roomIndex = Game().GetLevel().GetCurrentRoomIndex();
    if (roomIndex !== this.cachedDCRoom || itemType !== this.cachedDCItemType) {
      this.cachedDCRoom = roomIndex;
      this.cachedDCItemType = itemType;
      this.cachedDCEntity = null;

      const entities = Isaac.GetRoomEntities();
      for (const entity of entities) {
        if (
          entity.Type !== EntityType.PICKUP
          || entity.Variant !== PickupVariant.COLLECTIBLE
        ) {
          continue;
        }
        const pickup = entity.ToPickup();
        if (pickup !== undefined && pickup.SubType === itemType) {
          this.cachedDCEntity = pickup;
          break;
        }
      }
    }

    const foundEntity = this.cachedDCEntity ?? null;

    if (foundEntity) {
      if (
        foundEntity !== this.lastDCTargetEntity
        && this.familiarPos !== null
      ) {
        this.familiarOrbiting = false;
      }
      this.lastDCTargetEntity = foundEntity;

      if (roomIndex !== this.lastPlayedRoom) {
        musicManager.Play(Music.JINGLE_SECRET_ROOM_FIND, 0.4);
        musicManager.UpdateVolume();
        this.lastPlayedRoom = roomIndex;
        this.lineDelayFrames = 15;
        this.familiarPos = null;
      }
      if (this.lineDelayFrames > 0) {
        this.lineDelayFrames--;
      }
      this.renderItemFound(player, foundEntity);
    } else {
      this.lastPlayedRoom = -1;
      this.lineDelayFrames = 0;
      this.familiarPos = null;
      this.lastDCTargetEntity = null;
      this.renderBottomHUD(state.selectedItemName);
    }
  }

  private renderItemFound(player: EntityPlayer, pedestal: EntityPickup): void {
    this.renderBottomHUD(`${state.selectedItemName} here!`, 0.39, 0.94, 1);

    if (this.lineDelayFrames === 0) {
      const itemPos = Isaac.WorldToScreen(pedestal.Position);
      itemPos.Y -= 10;

      if (this.familiarPos === null) {
        const playerPos = Isaac.WorldToScreen(player.Position);
        playerPos.Y -= 10;
        this.familiarPos = playerPos;
        this.familiarOrbiting = false;
        this.familiarOrbitAngle = 0;
      }

      this.updateFamiliar(itemPos);
      this.renderFamiliar();
    }
  }

  // ==================================================================
  // DC familiar
  // ==================================================================

  private ensureYoListenSprite(): Sprite | undefined {
    if (this.yoListenSprite !== undefined) {
      return this.yoListenSprite;
    }
    const collectible = Isaac.GetItemConfig().GetCollectible(
      CollectibleType.YO_LISTEN,
    );
    if (collectible === undefined) {
      return undefined;
    }
    this.yoListenSprite = Sprite();
    this.yoListenSprite.Load("gfx/005.100_collectible.anm2", false);
    this.yoListenSprite.ReplaceSpritesheet(1, collectible.GfxFileName);
    this.yoListenSprite.LoadGraphics();
    this.yoListenSprite.Play("Idle", true);
    return this.yoListenSprite;
  }

  private updateFamiliar(targetPos: Vector): void {
    if (this.familiarPos === null) {
      return;
    }

    const dx = targetPos.X - this.familiarPos.X;
    const dy = targetPos.Y - this.familiarPos.Y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.familiarOrbiting) {
      this.familiarOrbitAngle += ORBIT_SPEED;
      if (this.orbitRadius < ORBIT_RADIUS) {
        this.orbitRadius = Math.min(
          this.orbitRadius + ORBIT_RADIUS_GROW,
          ORBIT_RADIUS,
        );
      }
      this.familiarPos.X =
        targetPos.X + Math.cos(this.familiarOrbitAngle) * this.orbitRadius;
      this.familiarPos.Y =
        targetPos.Y + Math.sin(this.familiarOrbitAngle) * this.orbitRadius;
    } else if (dist < ARRIVAL_DIST) {
      this.familiarOrbitAngle = Math.atan2(-dy, -dx);
      this.orbitRadius = dist;
      this.familiarOrbiting = true;
    } else {
      const step = Math.min(FLY_SPEED * dist, dist);
      this.familiarPos.X += (dx / dist) * step;
      this.familiarPos.Y += (dy / dist) * step;
    }
  }

  private renderFamiliar(): void {
    if (this.familiarPos === null) {
      return;
    }
    const sprite = this.ensureYoListenSprite();
    if (sprite === undefined) {
      return;
    }

    if (this.haloSprite === undefined) {
      this.haloSprite = Sprite();
      this.haloSprite.Load("gfx/ui/halo.anm2", true);
      this.haloSprite.Play("Idle", true);
      this.haloSprite.LoadGraphics();
    }

    sprite.Update();
    this.haloSprite.Update();
    this.haloSprite.Scale = Vector(FAMILIAR_SCALE * 1.6, FAMILIAR_SCALE * 1.6);
    this.haloSprite.Color = Color(1, 1, 1, 0.6);
    this.haloSprite.Render(this.familiarPos, Vector(0, -10), Vector(0, 0));
    sprite.Scale = Vector(FAMILIAR_SCALE, FAMILIAR_SCALE);
    sprite.Color = Color(1, 1, 1, 1);
    sprite.Render(this.familiarPos, Vector(0, 0), Vector(0, 0));
  }
}
