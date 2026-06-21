export type RGBA = readonly [number, number, number, number];

export function makeColor([r, g, b, a]: RGBA): Color {
  return Color(r, g, b, a);
}

export function makeKColor([r, g, b, a]: RGBA): KColor {
  return KColor(r, g, b, a);
}

const spinColorCache: KColor[] = [];

function initSpinColors(): void {
  if (spinColorCache.length > 0) {
    return;
  }
  spinColorCache.push(
    KColor(0, 1, 0, 1),
    KColor(128 / 255, 235 / 255, 0, 1),
    KColor(182 / 255, 1, 0, 1),
    KColor(1, 182 / 255, 0, 1),
    KColor(1, 128 / 255, 0, 1),
  );
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
