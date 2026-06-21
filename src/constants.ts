import { CollectibleType } from "isaac-typescript-definitions";

export const MOD_NAME = "spindown-helper-ingame";

export const FAVORITE_ITEM_TYPES: readonly CollectibleType[] = [
  CollectibleType.DEATH_CERTIFICATE,
  CollectibleType.DIPLOPIA,
  CollectibleType.GLITCHED_CROWN,
  CollectibleType.SHARP_PLUG,
  CollectibleType.D_INFINITY,
];

export const HIDDEN_SPINDOWN_IDS: ReadonlySet<CollectibleType> = new Set([
  59 as CollectibleType, // Passive Book of Belial (Birthright Judas)
  656 as CollectibleType, // Passive Damocles
  714 as CollectibleType, // Recall (Tainted Forgotten Birthright, hidden)
  715 as CollectibleType, // Hold (Tainted ??? starting item, hidden)
]);

export const KEYBOARD_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
] as const;

export const KEYBOARD_SPECIALS = ["SPACE", "CLEAR", "OVERLAY"] as const;

export const KEYBOARD_COOLDOWN_FRAMES = 6;
