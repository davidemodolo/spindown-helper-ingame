import type { CollectibleType } from "isaac-typescript-definitions";
import { HIDDEN_SPINDOWN_IDS } from "../constants";

export interface ItemEntry {
  name: string;
  type: CollectibleType;
  gfxFileName: string;
  searchKey: string;
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

export function getItemRegistry(): readonly ItemEntry[] {
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
    });
  }

  cachedRegistry = entries;
  return cachedRegistry;
}

export function searchItems(
  query: string,
  maxResults = 20,
): ItemEntry[] {
  const registry = getItemRegistry();
  if (query.length === 0) {
    return registry.slice(0, maxResults);
  }

  const cleanedQuery = makeSearchKey(query);
  const results: ItemEntry[] = [];

  for (const entry of registry) {
    if (entry.searchKey.includes(cleanedQuery)) {
      results.push(entry);
      if (results.length >= maxResults) {
        break;
      }
    }
  }

  return results;
}
