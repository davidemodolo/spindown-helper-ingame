const collectibleSpriteCache = new Map<string, Sprite>();

export function getCollectibleSprite(gfxFileName: string): Sprite | undefined {
  if (gfxFileName.length === 0) {
    return undefined;
  }
  let sprite = collectibleSpriteCache.get(gfxFileName);
  if (sprite !== undefined) {
    return sprite;
  }
  sprite = Sprite();
  sprite.Load("gfx/005.100_collectible.anm2", true);
  sprite.ReplaceSpritesheet(1, gfxFileName);
  sprite.LoadGraphics();
  collectibleSpriteCache.set(gfxFileName, sprite);
  return sprite;
}

const genericSpriteCache = new Map<string, Sprite>();

function getOrCreateGenericSprite(anm2Path: string, key: string): Sprite {
  let sprite = genericSpriteCache.get(key);
  if (sprite !== undefined) {
    return sprite;
  }
  sprite = Sprite();
  sprite.Load(anm2Path, true);
  sprite.LoadGraphics();
  genericSpriteCache.set(key, sprite);
  return sprite;
}

export function loadStaticSprite(
  anm2Path: string,
  frameName: string,
  frameIndex = 0,
): Sprite {
  const key = `${anm2Path}::${frameName}::${frameIndex}`;
  const sprite = getOrCreateGenericSprite(anm2Path, key);
  sprite.SetFrame(frameName, frameIndex);
  return sprite;
}

const animatedSpriteKeys = new Set<string>();

export function loadAnimatedSprite(anm2Path: string, animName: string): Sprite {
  const key = `${anm2Path}::${animName}`;
  const sprite = getOrCreateGenericSprite(anm2Path, key);
  if (!animatedSpriteKeys.has(key)) {
    sprite.Play(animName, true);
    animatedSpriteKeys.add(key);
  }
  return sprite;
}
