import { CollectibleType } from "isaac-typescript-definitions";
import { loadAnimatedSprite } from "../utils/sprite";

const ORBIT_RADIUS = 18;
const ORBIT_RADIUS_GROW = 0.5;
const ORBIT_SPEED = 0.04;
const FLY_SPEED = 0.04;
const ARRIVAL_DIST = 3;
const FAMILIAR_SCALE = 0.5;
const HALO_OFFSET = Vector(0, -10);

export class DeathCertificateFamiliar {
  private pos: Vector | null = null;
  private orbiting = false;
  private orbitAngle = 0;
  private orbitRadius = 0;
  private targetEntity: EntityPickup | null = null;
  private yoListenSprite: Sprite | undefined;

  get isActive(): boolean {
    return this.pos !== null;
  }

  reset(): void {
    this.pos = null;
    this.orbiting = false;
    this.orbitAngle = 0;
    this.targetEntity = null;
  }

  setTarget(target: EntityPickup): void {
    if (target !== this.targetEntity && this.pos !== null) {
      this.orbiting = false;
    }
    this.targetEntity = target;
  }

  spawnFrom(playerPos: Vector): void {
    this.pos = playerPos;
    this.orbiting = false;
    this.orbitAngle = 0;
  }

  update(targetPos: Vector): void {
    if (this.pos === null) {
      return;
    }

    const dx = targetPos.X - this.pos.X;
    const dy = targetPos.Y - this.pos.Y;
    // eslint-disable-next-line unicorn/prefer-modern-math-apis
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.orbiting) {
      this.orbitAngle += ORBIT_SPEED;
      if (this.orbitRadius < ORBIT_RADIUS) {
        this.orbitRadius = Math.min(
          this.orbitRadius + ORBIT_RADIUS_GROW,
          ORBIT_RADIUS,
        );
      }
      this.pos.X = targetPos.X + Math.cos(this.orbitAngle) * this.orbitRadius;
      this.pos.Y = targetPos.Y + Math.sin(this.orbitAngle) * this.orbitRadius;
    } else if (dist < ARRIVAL_DIST) {
      this.orbitAngle = Math.atan2(-dy, -dx);
      this.orbitRadius = dist;
      this.orbiting = true;
    } else {
      const step = FLY_SPEED * dist;
      this.pos.X += (dx / dist) * step;
      this.pos.Y += (dy / dist) * step;
    }
  }

  render(): void {
    if (this.pos === null) {
      return;
    }

    const sprite = this.ensureYoListenSprite();
    if (sprite === undefined) {
      return;
    }

    const halo = loadAnimatedSprite("gfx/ui/halo.anm2", "Idle");

    sprite.Update();
    halo.Update();
    halo.Scale = Vector(FAMILIAR_SCALE * 1.6, FAMILIAR_SCALE * 1.6);
    halo.Color = Color(1, 1, 1, 0.6);
    halo.Render(this.pos, HALO_OFFSET, Vector(0, 0));
    sprite.Scale = Vector(FAMILIAR_SCALE, FAMILIAR_SCALE);
    sprite.Color = Color(1, 1, 1, 1);
    sprite.Render(this.pos, Vector(0, 0), Vector(0, 0));
  }

  // This deliberately does not use the shared sprite cache: the familiar animates the sprite with
  // `Play`, which would conflict with other consumers of the same cached collectible sprite (e.g.
  // Yo Listen showing up as a keyboard search result).
  private ensureYoListenSprite(): Sprite | undefined {
    if (this.yoListenSprite !== undefined) {
      return this.yoListenSprite;
    }
    const collectible = Isaac.GetItemConfig().GetCollectible(
      CollectibleType.YO_LISTEN,
    );
    if (collectible === undefined || collectible.GfxFileName.length === 0) {
      return undefined;
    }
    const sprite = Sprite();
    sprite.Load("gfx/005.100_collectible.anm2", true);
    sprite.ReplaceSpritesheet(1, collectible.GfxFileName);
    sprite.LoadGraphics();
    sprite.Play("Idle", true);
    this.yoListenSprite = sprite;
    return sprite;
  }
}
