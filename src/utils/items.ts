import type { CollectibleType } from "isaac-typescript-definitions";
import { FAVORITE_ITEM_TYPES, HIDDEN_SPINDOWN_IDS } from "../constants";

export interface ItemEntry {
  name: string;
  type: CollectibleType;
  gfxFileName: string;
  searchKey: string;
  wordKeys: readonly string[];
}

let cachedRegistry: ItemEntry[] | undefined;

interface TrieNode {
  items: Map<ItemEntry, number>;
  children: Map<string, TrieNode>;
}

let cachedTrie: TrieNode | undefined;
let cachedFavorites: ItemEntry[] | undefined;

const MIN_SUFFIX_LEN = 2;

function resolveItemName(raw: string): string {
  if (!raw.startsWith("$") && !raw.startsWith("#")) return raw;
  let key = raw.slice(1);
  if (key.endsWith("_NAME")) key = key.slice(0, -5);
  if (key.endsWith("_")) key = key.slice(0, -1);
  return key
    .split("_")
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function makeSearchKey(name: string): string {
  let result = "";
  for (let i = 0; i < name.length; i++) {
    const char = name.charAt(i);
    const lower = char.toLowerCase();
    if ((lower >= "a" && lower <= "z") || (lower >= "0" && lower <= "9")) {
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
      wordKeys: name
        .split(" ")
        .map((w) => makeSearchKey(w))
        .filter((w) => w.length > 0),
    });
  }

  cachedRegistry = entries;
  return cachedRegistry;
}

function insertIntoTrie(
  root: TrieNode,
  key: string,
  item: ItemEntry,
  priority: number,
): void {
  let node = root;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charAt(i);
    let child = node.children.get(ch);
    if (child === undefined) {
      child = { items: new Map(), children: new Map() };
      node.children.set(ch, child);
    }
    node = child;
    const existing = node.items.get(item);
    if (existing === undefined || priority < existing) {
      node.items.set(item, priority);
    }
  }
}

function buildTrie(registry: readonly ItemEntry[]): TrieNode {
  const root: TrieNode = { items: new Map(), children: new Map() };

  for (const entry of registry) {
    insertIntoTrie(root, entry.searchKey, entry, 0);

    for (const wk of entry.wordKeys) {
      insertIntoTrie(root, wk, entry, 1);
    }

    const key = entry.searchKey;
    for (let start = 1; start <= key.length - MIN_SUFFIX_LEN; start++) {
      insertIntoTrie(root, key.slice(start), entry, 2);
    }
  }

  cachedTrie = root;
  return root;
}

function getTrie(): TrieNode {
  if (cachedTrie !== undefined) {
    return cachedTrie;
  }
  const registry = getItemRegistry();
  return buildTrie(registry);
}

function getFavoriteItems(): ItemEntry[] {
  if (cachedFavorites !== undefined) {
    return cachedFavorites;
  }
  const registry = getItemRegistry();
  const byType = new Map<CollectibleType, ItemEntry>();
  for (const entry of registry) {
    byType.set(entry.type, entry);
  }
  const favorites: ItemEntry[] = [];
  for (const type of FAVORITE_ITEM_TYPES) {
    const entry = byType.get(type);
    if (entry !== undefined) {
      favorites.push(entry);
    }
  }
  cachedFavorites = favorites;
  return favorites;
}

export function searchItems(query: string, maxResults = 20): ItemEntry[] {
  if (query.length === 0) {
    return getFavoriteItems();
  }

  const cleanedQuery = makeSearchKey(query);
  const trie = getTrie();

  let node: TrieNode | undefined = trie;
  for (let i = 0; i < cleanedQuery.length; i++) {
    const ch = cleanedQuery.charAt(i);
    node = node.children.get(ch);
    if (node === undefined) {
      return [];
    }
  }

  const results: ItemEntry[] = [];
  const seen = new Set<ItemEntry>();
  const sorted = [...node.items.entries()].sort((a, b) => a[1] - b[1]);

  for (const [item] of sorted) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    results.push(item);
    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}
