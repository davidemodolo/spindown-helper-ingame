const HUE_SEGMENTS = 100;
const rainbowColors: KColor[] = [];

function hslToRGB(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const hueSegment = (h % 360) / 360;

  if (s === 0) {
    return { r: l, g: l, b: l };
  }

  const hueToRGB = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) {
      tt += 1;
    }
    if (tt > 1) {
      tt -= 1;
    }
    if (tt < 1 / 6) {
      return p + (q - p) * 6 * tt;
    }
    if (tt < 1 / 2) {
      return q;
    }
    if (tt < 2 / 3) {
      return p + (q - p) * (2 / 3 - tt) * 6;
    }
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hueToRGB(p, q, hueSegment + 1 / 3),
    g: hueToRGB(p, q, hueSegment),
    b: hueToRGB(p, q, hueSegment - 1 / 3),
  };
}

function initRainbowColors(): void {
  if (rainbowColors.length > 0) {
    return;
  }
  for (let i = 0; i < HUE_SEGMENTS; i++) {
    const hue = (i / HUE_SEGMENTS) * 360;
    const { r, g, b } = hslToRGB(hue, 1, 0.5);
    rainbowColors.push(KColor(r, g, b, 1));
  }
}

export function getRainbowColor(offset = 0): KColor {
  initRainbowColors();
  const frameCount = Game().GetFrameCount() + offset;
  const index = frameCount % HUE_SEGMENTS;
  return rainbowColors[index]!;
}

const spinColorCache: KColor[] = [];

function initSpinColors(): void {
  if (spinColorCache.length > 0) {
    return;
  }
  spinColorCache.push(KColor(0, 1, 0, 1));
  spinColorCache.push(KColor(128 / 255, 235 / 255, 0, 1));
  spinColorCache.push(KColor(182 / 255, 1, 0, 1));
  spinColorCache.push(KColor(1, 182 / 255, 0, 1));
  spinColorCache.push(KColor(1, 128 / 255, 0, 1));
}

export function getSpinColor(spins: number): KColor {
  initSpinColors();
  if (spins <= 5) {
    return spinColorCache[0]!;
  }
  if (spins <= 25) {
    return spinColorCache[1]!;
  }
  if (spins <= 50) {
    return spinColorCache[2]!;
  }
  if (spins <= 100) {
    return spinColorCache[3]!;
  }
  return spinColorCache[4]!;
}

export function getUnreachableColor(): KColor {
  return KColor(200 / 255, 0, 0, 1);
}
