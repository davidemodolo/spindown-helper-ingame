import type { CollectibleType } from "isaac-typescript-definitions";
import { HIDDEN_SPINDOWN_IDS, FAVORITE_ITEM_TYPES } from "../constants";

export interface ItemEntry {
  name: string;
  type: CollectibleType;
  gfxFileName: string;
  searchKey: string;
  wordKeys: readonly string[];
}

let cachedRegistry: ItemEntry[] | undefined;

function resolveItemName(raw: string): string {
  if (!raw.startsWith("$") && !raw.startsWith("#")) return raw;
  let key = raw.slice(1);
  if (key.endsWith("_NAME")) key = key.slice(0, -5);
  if (key.endsWith("_")) key = key.slice(0, -1);
  return key
    .split("_")
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function makeSearchKey(name: string): string {
  let result = "";
  for (let i = 0; i < name.length; i++) {
    const char = name.charAt(i);
    const lower = char.toLowerCase();
    if (
      (lower >= "a" && lower <= "z") ||
      (lower >= "0" && lower <= "9")
    ) {
      result += lower;
    }
  }
  return result;
}

function getItemRegistry(): readonly ItemEntry[] {
  if (cachedRegistry !== undefined) {
    return cachedRegistry;
  }

  const itemConfig = Isaac.GetItemConfig();
  const entries: ItemEntry[] = [];

  const numCollectibles = itemConfig.GetCollectibles().Size;
  for (let id = 1; id <= numCollectibles; id++) {
    const type = id as CollectibleType;

    if (HIDDEN_SPINDOWN_IDS.has(type)) {
      continue;
    }

    const collectible = itemConfig.GetCollectible(type);
    if (collectible === undefined) {
      continue;
    }

    const name = resolveItemName(collectible.Name);
    if (name === "Unknown" || name.length === 0) {
      continue;
    }

    entries.push({
      name,
      type,
      gfxFileName: collectible.GfxFileName,
      searchKey: makeSearchKey(name),
      wordKeys: name.split(" ").map(w => makeSearchKey(w)).filter(w => w.length > 0),
    });
  }

  cachedRegistry = entries;
  return cachedRegistry;
}

function getFavoriteItems(): ItemEntry[] {
  const registry = getItemRegistry();
  const favorites: ItemEntry[] = [];
  for (const type of FAVORITE_ITEM_TYPES) {
    const entry = registry.find(e => e.type === type);
    if (entry !== undefined) {
      favorites.push(entry);
    }
  }
  return favorites;
}

export function searchItems(
  query: string,
  maxResults = 20,
): ItemEntry[] {
  if (query.length === 0) {
    return getFavoriteItems();
  }

  const cleanedQuery = makeSearchKey(query);
  const registry = getItemRegistry();

  const buckets: [ItemEntry[], ItemEntry[], ItemEntry[]] = [[], [], []];
  for (const entry of registry) {
    if (!entry.searchKey.includes(cleanedQuery)) continue;
    if (entry.searchKey.startsWith(cleanedQuery)) {
      buckets[0].push(entry);
    } else if (entry.wordKeys.some(w => w.startsWith(cleanedQuery))) {
      buckets[1].push(entry);
    } else {
      buckets[2].push(entry);
    }
  }

  const results: ItemEntry[] = [];
  for (const bucket of buckets) {
    for (const entry of bucket) {
      results.push(entry);
      if (results.length >= maxResults) return results;
    }
  }
  return results;
}
