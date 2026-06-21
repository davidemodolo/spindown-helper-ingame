import { CollectibleType } from "isaac-typescript-definitions";
import { getCollectibleSprite } from "../utils/sprite";

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
  private haloSprite: Sprite | undefined;

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
      const step = Math.min(FLY_SPEED * dist, dist);
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
    this.haloSprite.Render(this.pos, HALO_OFFSET, Vector(0, 0));
    sprite.Scale = Vector(FAMILIAR_SCALE, FAMILIAR_SCALE);
    sprite.Color = Color(1, 1, 1, 1);
    sprite.Render(this.pos, Vector(0, 0), Vector(0, 0));
  }

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
    this.yoListenSprite = getCollectibleSprite(collectible.GfxFileName);
    if (this.yoListenSprite !== undefined) {
      this.yoListenSprite.Play("Idle", true);
    }
    return this.yoListenSprite;
  }
}
