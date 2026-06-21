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
import {
  isKeyboardOpen,
  overlayPinned,
  selectedItemName,
  selectedItemType,
} from "../state";
import { computeSpins } from "../utils/calculator";
import { getSpinColor } from "../utils/color";
import { invalidateRegistryCaches } from "../utils/items";
import { buildLockedItems, getLockedItems } from "../utils/lockedItems";
import { getCollectibleSprite } from "../utils/sprite";
import { DeathCertificateFamiliar } from "./deathCertificateFamiliar";

const CAR_BATTERY_ID = CollectibleType.CAR_BATTERY;
const SPINDOWN_DICE_ID = CollectibleType.SPINDOWN_DICE;
const INDICATOR_SCALE = 1 / 3;

const INDICATOR_Y_OFFSET = -16;
const SPIN_TEXT_Y_OFFSET = -20;
const FAMILIAR_Y_OFFSET = -10;

const BOTTOM_HUD_Y = 26;
const ITEM_SPRITE_SCALE = 0.5;

function getCollectiblePedestals(): EntityPickup[] {
  const result: EntityPickup[] = [];
  for (const entity of Isaac.GetRoomEntities()) {
    if (
      entity.Type !== EntityType.PICKUP
      || entity.Variant !== PickupVariant.COLLECTIBLE
    ) {
      continue;
    }
    const pickup = entity.ToPickup();
    if (pickup !== undefined) {
      result.push(pickup);
    }
  }
  return result;
}

export class PedestalOverlayFeature extends ModFeature {
  private readonly modRef: ModUpgraded;
  private lastPlayedRoom = -1;
  private lineDelayFrames = 0;
  private noSprite: Sprite | undefined;
  private noCBSprite: Sprite | undefined;
  private noDNSprite: Sprite | undefined;
  private cachedDCRoom = -1;
  private cachedDCItemType: CollectibleType | undefined;
  private cachedDCEntity: EntityPickup | null | undefined;

  private readonly dcFamiliar = new DeathCertificateFamiliar();

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
    invalidateRegistryCaches();
  }

  @Callback(ModCallback.POST_RENDER)
  postRender(): void {
    if (!overlayPinned.get()) {
      return;
    }
    if (
      selectedItemType.get() === undefined
      || selectedItemName.get().length === 0
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

    if (isKeyboardOpen.get()) {
      this.renderBottomHUD(selectedItemName.get());
      return;
    }

    if (inDC) {
      this.renderDeathCertificate(player);
    } else {
      this.renderBottomHUD(selectedItemName.get());
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

  private getSelectedItemGfxFileName(): string | undefined {
    const itemType = selectedItemType.get();
    if (itemType === undefined) {
      return undefined;
    }
    const collectible = Isaac.GetItemConfig().GetCollectible(itemType);
    if (collectible === undefined) {
      return undefined;
    }
    return collectible.GfxFileName;
  }

  private renderBottomHUD(text: string, r = 1, g = 1, b = 1): void {
    const gfxFileName = this.getSelectedItemGfxFileName();
    const sprite =
      gfxFileName !== undefined ? getCollectibleSprite(gfxFileName) : undefined;

    const sw = Isaac.GetScreenWidth();
    const sh = Isaac.GetScreenHeight();
    const nameW = text.length * 5;
    const blockW = 20 + nameW;
    const startX = Math.floor((sw - blockW) / 2);
    const y = sh - BOTTOM_HUD_Y;
    if (sprite !== undefined) {
      sprite.Color = Color(r, g, b, 1);
      sprite.SetFrame("Idle", 8);
      sprite.Scale = Vector(ITEM_SPRITE_SCALE, ITEM_SPRITE_SCALE);
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
    if (selectedItemType.get() === undefined) {
      return;
    }

    const carBattery = player.HasCollectible(CAR_BATTERY_ID);

    for (const pickup of getCollectiblePedestals()) {
      const result = computeSpins(
        pickup.SubType,
        selectedItemType.get()!,
        carBattery,
      );

      const screenPos = Isaac.WorldToScreen(pickup.Position);

      if (!result.reachable) {
        const sprite = this.getIndicatorSprite(result.label);
        if (sprite !== undefined) {
          sprite.Color = Color(200 / 255, 0, 0, 1);
          sprite.Scale = Vector(INDICATOR_SCALE, INDICATOR_SCALE);
          sprite.Render(
            Vector(screenPos.X, screenPos.Y + INDICATOR_Y_OFFSET),
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
        screenPos.Y + SPIN_TEXT_Y_OFFSET,
        color,
        0,
        false,
      );
    }
  }

  private renderDeathCertificate(player: EntityPlayer): void {
    const itemType = selectedItemType.get();
    if (itemType === undefined) {
      return;
    }

    if (getLockedItems().has(itemType)) {
      this.renderBottomHUD(selectedItemName.get());
      return;
    }

    const roomIndex = Game().GetLevel().GetCurrentRoomIndex();
    if (roomIndex !== this.cachedDCRoom || itemType !== this.cachedDCItemType) {
      this.cachedDCRoom = roomIndex;
      this.cachedDCItemType = itemType;
      this.cachedDCEntity = null;

      for (const pickup of getCollectiblePedestals()) {
        if (pickup.SubType === itemType) {
          this.cachedDCEntity = pickup;
          break;
        }
      }
    }

    const foundEntity = this.cachedDCEntity ?? null;

    if (foundEntity !== null) {
      this.dcFamiliar.setTarget(foundEntity);

      if (roomIndex !== this.lastPlayedRoom) {
        musicManager.Play(Music.JINGLE_SECRET_ROOM_FIND, 0.4);
        musicManager.UpdateVolume();
        this.lastPlayedRoom = roomIndex;
        this.lineDelayFrames = 15;
        this.dcFamiliar.reset();
      }
      if (this.lineDelayFrames > 0) {
        this.lineDelayFrames--;
      }
      this.renderItemFound(player, foundEntity);
    } else {
      this.lastPlayedRoom = -1;
      this.lineDelayFrames = 0;
      this.dcFamiliar.reset();
      this.renderBottomHUD(selectedItemName.get());
    }
  }

  private renderItemFound(player: EntityPlayer, pedestal: EntityPickup): void {
    this.renderBottomHUD(`${selectedItemName.get()} here!`, 0.39, 0.94, 1);

    if (this.lineDelayFrames === 0) {
      const itemPos = Isaac.WorldToScreen(pedestal.Position);
      itemPos.Y += FAMILIAR_Y_OFFSET;

      if (!this.dcFamiliar.isActive) {
        const playerPos = Isaac.WorldToScreen(player.Position);
        playerPos.Y += FAMILIAR_Y_OFFSET;
        this.dcFamiliar.spawnFrom(playerPos);
      }

      this.dcFamiliar.update(itemPos);
      this.dcFamiliar.render();
    }
  }
}
