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
  CallbackCustom,
  fonts,
  inDeathCertificateArea,
  ModCallbackCustom,
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
import {
  getCollectibleSprite,
  loadAnimatedSprite,
  loadStaticSprite,
} from "../utils/sprite";
import { DeathCertificateFamiliar } from "./deathCertificateFamiliar";

interface ModWithUnlockCheck extends ModUpgraded {
  isCollectibleUnlocked: (
    collectibleType: number,
    itemPoolType: number,
  ) => boolean;
}

const CAR_BATTERY_ID = CollectibleType.CAR_BATTERY;
const SPINDOWN_DICE_ID = CollectibleType.SPINDOWN_DICE;
const INDICATOR_SCALE = 1 / 3;

const INDICATOR_Y_OFFSET = -16;
const SPIN_TEXT_Y_OFFSET = -20;
const FAMILIAR_Y_OFFSET = -10;

const BOTTOM_HUD_Y = 26;
const ITEM_SPRITE_SCALE = 0.5;

function getCollectiblePedestals(): readonly EntityPickup[] {
  const currentRoom = Game().GetLevel().GetCurrentRoomIndex();
  if (roomPedestalCache.room === currentRoom) {
    return roomPedestalCache.pedestals;
  }

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

  roomPedestalCache = { room: currentRoom, pedestals: result };
  return result;
}

interface PedestalCache {
  room: number;
  pedestals: readonly EntityPickup[];
}

let roomPedestalCache: PedestalCache = { room: -1, pedestals: [] };

export class PedestalOverlayFeature extends ModFeature {
  private readonly modRef: ModUpgraded;
  private lastPlayedRoom = -1;
  private lastFoundSpinKey = "";
  private lineDelayFrames = 0;
  private cachedDCRoom = -1;
  private cachedDCItemType: CollectibleType | undefined;
  private cachedDCEntity: EntityPickup | null | undefined;

  private readonly dcFamiliar = new DeathCertificateFamiliar();

  constructor(mod: ModUpgraded) {
    super(mod, false);
    this.modRef = mod;
  }

  @CallbackCustom(ModCallbackCustom.POST_GAME_STARTED_REORDERED, undefined)
  postGameStarted(_isContinued: boolean): void {
    const api = this.modRef as ModWithUnlockCheck;
    buildLockedItems((type, poolType) =>
      api.isCollectibleUnlocked(type as number, poolType as number),
    );
    invalidateRegistryCaches();
  }

  // NOTE: This POST_RENDER callback mutates instance state (lineDelayFrames, lastPlayedRoom,
  // dcFamiliar) during the render phase. Isaac's Lua API executes callbacks synchronously per
  // frame, so state updates here are immediately visible to the next draw call within the same
  // frame and do not cause visual tearing. The alternative MC_POST_UPDATE is not available in the
  // Isaac modding API.
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

    if (this.lineDelayFrames > 0) {
      this.lineDelayFrames--;
    }

    if (inDC) {
      this.renderDeathCertificate(player);
    } else {
      const found = this.renderPedestalSpins(player);
      this.renderBottomHUD(
        found ? `${selectedItemName.get()} here!` : selectedItemName.get(),
        found ? 0.39 : 1,
        found ? 0.94 : 1,
        1,
      );
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
      gfxFileName === undefined ? undefined : getCollectibleSprite(gfxFileName);

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

  private getIndicatorSprite(label: string): Sprite {
    if (label === "NO") {
      return loadStaticSprite("gfx/ui/nospin.anm2", "idle");
    }
    if (label === "CB") {
      return loadStaticSprite("gfx/ui/nospin_cb.anm2", "idle");
    }
    return loadStaticSprite("gfx/ui/nospin_dn.anm2", "idle");
  }

  private renderPedestalSpins(player: EntityPlayer): boolean {
    const targetType = selectedItemType.get();
    if (targetType === undefined) {
      return false;
    }

    const carBattery = player.HasCollectible(CAR_BATTERY_ID);
    const roomIndex = Game().GetLevel().GetCurrentRoomIndex();
    const foundKey = `${roomIndex}:${targetType}`;
    let foundMatch = false;

    for (const pickup of getCollectiblePedestals()) {
      if (pickup.SubType === targetType) {
        foundMatch = true;
        const screenPos = Isaac.WorldToScreen(pickup.Position);

        if (this.lastFoundSpinKey !== foundKey) {
          musicManager.Play(Music.JINGLE_SECRET_ROOM_FIND, 0.4);
          musicManager.UpdateVolume();
          this.lastFoundSpinKey = foundKey;
          this.lineDelayFrames = 15;
        }

        if (this.lineDelayFrames > 0) {
          continue;
        }

        const halo = loadAnimatedSprite("gfx/ui/halo.anm2", "Idle");
        halo.Update();
        halo.Scale = Vector(0.7, 0.7);
        halo.Color = Color(1, 1, 1, 1);
        halo.Render(
          Vector(screenPos.X, screenPos.Y + INDICATOR_Y_OFFSET + 5),
          Vector(0, 0),
          Vector(0, 0),
        );
        continue;
      }

      if (this.lineDelayFrames > 0) {
        continue;
      }

      const result = computeSpins(pickup.SubType, targetType, carBattery);

      const screenPos = Isaac.WorldToScreen(pickup.Position);

      if (!result.reachable) {
        const sprite = this.getIndicatorSprite(result.label);
        sprite.Color = Color(200 / 255, 0, 0, 1);
        sprite.Scale = Vector(INDICATOR_SCALE, INDICATOR_SCALE);
        sprite.Render(
          Vector(screenPos.X, screenPos.Y + INDICATOR_Y_OFFSET),
          Vector(0, 0),
          Vector(0, 0),
        );
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

    if (!foundMatch) {
      this.lastFoundSpinKey = "";
    }
    return foundMatch;
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

    if (foundEntity === null) {
      this.lastPlayedRoom = -1;
      this.lineDelayFrames = 0;
      this.dcFamiliar.reset();
      this.renderBottomHUD(selectedItemName.get());
    } else {
      this.dcFamiliar.setTarget(foundEntity);

      if (roomIndex !== this.lastPlayedRoom) {
        musicManager.Play(Music.JINGLE_SECRET_ROOM_FIND, 0.4);
        musicManager.UpdateVolume();
        this.lastPlayedRoom = roomIndex;
        this.lineDelayFrames = 15;
        this.dcFamiliar.reset();
      }
      this.renderItemFound(player, foundEntity);
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
