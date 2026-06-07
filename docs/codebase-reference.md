# Codebase Reference — Spindown Helper In-Game (IsaacScript Pivot)

> Last updated: 2026-06-07

This document is a comprehensive reference for the current TypeScript/IsaacScript implementation. Use it to find where to make changes without needing to re-read every file.

---

## Architecture Overview

| Layer | Files | Role |
|-------|-------|------|
| Entry | `src/bundleEntry.ts` → `src/main.ts` | Mod bootstrap |
| State | `src/state.ts` | Shared mutable state (singleton) |
| Constants | `src/constants.ts` | Static configuration |
| Features | `src/features/virtualKeyboard.ts`, `src/features/pedestalOverlay.ts` | Game loop callbacks + rendering |
| Utils | `src/utils/calculator.ts`, `src/utils/color.ts`, `src/utils/items.ts`, `src/utils/render.ts` | Pure logic |

### File dependency graph

```
bundleEntry.ts
  └── main.ts
        ├── constants.ts
        ├── features/virtualKeyboard.ts
        │     ├── state.ts
        │     ├── constants.ts
        │     └── utils/items.ts
        └── features/pedestalOverlay.ts
              ├── state.ts
              ├── utils/calculator.ts  ─── constants.ts
              ├── utils/color.ts
              └── utils/render.ts
```

---

## Per-File Reference

### `src/bundleEntry.ts`

Entry point for the TSTL bundler. Calls `main()` immediately.

**Do not add code here** — it exists solely to avoid Temporal Dead Zone issues.

---

### `src/main.ts`

Mod bootstrap. Registers the mod with Isaac, upgrades it with `ISCFeature.SAVE_DATA_MANAGER`, initializes both feature classes.

| Export | Purpose |
|--------|---------|
| `main()` | Called by `bundleEntry.ts` |

The `FEATURES` array controls feature order (`VirtualKeyboardFeature` first, then `PedestalOverlayFeature`).

---

### `src/state.ts`

Singleton mutable state object. Every module reads/writes these fields directly (no events).

| Field | Type | Default | Set by | Read by |
|-------|------|---------|--------|---------|
| `selectedItemType` | `CollectibleType \| undefined` | `undefined` | virtualKeyboard | pedestalOverlay |
| `selectedItemName` | `string` | `""` | virtualKeyboard | pedestalOverlay |
| `searchText` | `string` | `""` | virtualKeyboard | virtualKeyboard |
| `isKeyboardOpen` | `boolean` | `false` | virtualKeyboard | virtualKeyboard, pedestalOverlay |
| `isOverlayActive` | `boolean` | `false` | virtualKeyboard (every frame, F1) | pedestalOverlay |
| `keyboardCursorRow` | `number` | `0` | virtualKeyboard | virtualKeyboard |
| `keyboardCursorCol` | `number` | `0` | virtualKeyboard | virtualKeyboard |
| `cursorInResults` | `boolean` | `false` | virtualKeyboard | virtualKeyboard |
| `matchedItems` | `ItemEntry[]` | `[]` | virtualKeyboard | virtualKeyboard |
| `selectedResultIndex` | `number` | `0` | virtualKeyboard | virtualKeyboard |
| `moveCooldown` | `number` | `0` | virtualKeyboard | virtualKeyboard |

---

### `src/constants.ts`

Static configuration. All exports are `as const`.

| Export | Value | Used in |
|--------|-------|---------|
| `MOD_NAME` | `"spindown-helper-ingame"` | `main.ts` |
| `HIDDEN_SPINDOWN_IDS` | Set: `{59, 656, 714, 715}` | `calculator.ts`, `items.ts` |
| `KEYBOARD_ROWS` | `[["Q".."P"], ["A".."L"], ["Z".."M"]]` | `virtualKeyboard.ts` |
| `KEYBOARD_SPECIALS` | `["SPACE", "DEL", "OK"]` | `virtualKeyboard.ts` |
| `KEYBOARD_COOLDOWN_FRAMES` | `6` | `virtualKeyboard.ts` |

Hidden items: 59 = Passive Book of Belial (Birthright Judas), 656 = Passive Damocles, 714 = Recall (T.Forgotten Birthright), 715 = Hold (T.??? starting item).

---

### `src/utils/calculator.ts`

The Spindown Dice math engine. Exports `computeSpins(fromType, toType, carBattery): SpinResult`.

**Algorithm**:
1. `fromID ≤ toID` → unreachable (Spindown only decrements)
2. Target is a hidden item → unreachable
3. From-item is Dad's Note (668) → unreachable
4. `steps = fromID - toID`
5. Subtract 1 for each hidden item whose ID falls between `fromID` and `toID`
6. `steps ≤ 0` → unreachable
7. If Car Battery: odd steps → unreachable (`"CB"`), even → `steps / 2`
8. Return `{ label: "X", spins: X, reachable: true }`

**Return type** (`SpinResult`):
```ts
{ label: string;  // "5", "NO", "CB"
  spins: number;  // -1 when unreachable
  reachable: boolean; }
```

---

### `src/utils/color.ts`

Color utilities.

| Export | Returns | Logic |
|--------|---------|-------|
| `getSpinColor(spins)` | `KColor` | ≤5=green, ≤25=yellow-green, ≤50=yellow, ≤100=orange, >100=red-orange |
| `getUnreachableColor()` | `KColor` | Dark red `(200/255, 0, 0, 1)` |
| `getRainbowColor(offset?)` | `KColor` | Time-based rainbow (currently unused — dead code) |

---

### `src/utils/items.ts`

Item registry and search.

| Export | Purpose |
|--------|---------|
| `ItemEntry` interface | `{ name, type, gfxFileName, searchKey }` |
| `getItemRegistry()` | Builds/caches list of all collectibles (skips hidden, unknown, unnamed) |
| `searchItems(query, maxResults?)` | Fuzzy search on `searchKey` (lowercase, no punctuation). Empty query returns first N items. |

`searchItems` is called by `VirtualKeyboardFeature.onSearchChanged()` on every keystroke.

---

### `src/utils/render.ts`

Single export: `screenToRenderPos(sx, sy): Vector` — converts screen-space coords to world render-space. Used by `pedestalOverlay.ts` for the target item sprite so it follows the camera.

---

### `src/features/virtualKeyboard.ts` (561 lines)

The largest file. In-game search UI to select a target item.

#### Controls

| Input | Action |
|-------|--------|
| **F2** | Toggle keyboard open/close |
| **Double-tap Select/Map** | Toggle keyboard (controller) |
| **Arrow keys / D-pad** | Navigate cursor |
| **Confirm / Item button** | Type letter (keyboard mode) / select result (results mode) |
| **Back / Bomb button** | Backspace (keyboard mode) / close (results mode) |
| **Up** from top row | Enter results |
| **Down** from results | Return to keyboard |
| Left/Right in results | Cycle through matches |
| `[OK]` special key | Select first result |
| `[SPACE]` | Type space |
| `[DEL]` | Backspace |

When keyboard is open, player controls are disabled.

#### UI Layout Constants (screen pixels, relative to window)

| Constant | Value | What it controls |
|----------|-------|-----------------|
| `WIN_W` | 200 | Window width |
| `WIN_H` | 70 | Window height |
| `WIN_X_FN` | `(screenW - WIN_W) / 2` | Window X (centered) |
| `WIN_Y_FN` | `(screenH - WIN_H) / 2` | Window Y (centered) |
| `MAX_RESULTS` | 3 | Max visible search results |
| `CH_W` | 3 | Character pixel width |
| `INPUT_Y` | 4 | Search input row Y offset |
| `RESULTS_Y` | 10 | Results row Y offset |
| `KEYBOARD_Y` | 26 | Keyboard grid Y offset |
| `KEY_ROW_H` | 5 | Spacing between key rows |
| `KEY_W` | 5 | Width per letter key |
| `SPECIAL_W` | 22 | Width per special key |
| `HELP_Y` | 54 | Help bar Y offset |
| `SPRITE_SCALE` | 0.4 | Result item sprite scale |
| `TEXT_SCALE` | 0.5 | All text scale |

#### Text Color Palette (RGB values in `rtext` calls)

| Element | R | G | B | Alpha | Notes |
|---------|---|---|---|-------|-------|
| Prompt `>` | 0.75 | 0.18 | 0.14 | 1.0 | Blood red |
| Search text | 0.88 | 0.78 | 0.63 | 1.0 | Parchment |
| Match count | 0.42 | 0.31 | 0.22 | 1.0 | Dim brown |
| Selected item name (right) | 0.78 | 0.55 | 0.30 | 0.8 | Golden |
| "no match" | 0.38 | 0.26 | 0.18 | 0.7 | Muted dark |
| Selected result text | 0.92 | 0.76 | 0.55 | 1.0 | Bright gold |
| Unselected result text | 0.60 | 0.46 | 0.33 | 0.85 | Muted gold |
| Selected key | 0.80 | 0.18 | 0.14 | 1.0 | Blood red |
| Unselected key | 0.63 | 0.49 | 0.36 | 0.9 | Warm tan |
| Selected special `[ ]` | 0.80 | 0.18 | 0.14 | 1.0 | Blood red |
| Unselected special `[ ]` | 0.55 | 0.42 | 0.30 | 0.85 | Muted brown |
| Help bar text | 0.40 | 0.28 | 0.20 | 0.55 | Faint dark |
| Result arrow `v` | 0.75 | 0.18 | 0.14 | 1.0 | Blood red |
| Unselected result sprite tint | 0.5 | 0.4 | 0.3 | 0.7 | Dark/muted |

---

### `src/features/pedestalOverlay.ts` (149 lines)

Renders spin counts above collectible pedestals when F1 is held.

#### Rendering

- **Target item info** (top-left): Item sprite (via `screenToRenderPos` so it follows camera) + item name in white at 0.8 alpha, position `(20, 28)` / `(48, 28)`.
- **Spin labels**: For each `EntityType.PICKUP` + `PickupVariant.COLLECTIBLE` in the room, renders the label centered above the entity at `WorldToScreen(pos) + offset(0, -20)`. Font: `pftempestasevencondensed.fnt`.
- **No target message**: `"No target item selected (press F2)"` at `(10, 10)` in white.

#### Font

Loaded from `font/pftempestasevencondensed.fnt`. Text width estimated as `text.length * 4` for centering.

---

## Data Flow (runtime)

```
Every frame (POST_RENDER):

  VirtualKeyboardFeature.postRender()
    │
    ├── state.isOverlayActive = F1 held?
    │
    ├── F2 pressed? → toggleKeyboard()
    ├── Select double-tap? → toggleKeyboard()
    │
    ├── [if keyboard open]
    │   ├── player.ControlsEnabled = false
    │   ├── handleCursorMovement()  → updates state.keyboardCursorRow/Col, cursorInResults
    │   ├── handleSelectionInput()  → types chars, calls searchItems(), selects items
    │   └── renderWindow()          → draws keyboard UI
    │
    └── [selection made]
        └── state.selectedItemType = item.type
            state.selectedItemName = item.name
            closeKeyboard()

  PedestalOverlayFeature.postRender()
    │
    ├── [if !state.isOverlayActive] → return
    ├── [if no target selected]    → renderNoTargetMessage()
    │
    └── renderTargetInfo()  → draws target sprite + name
        renderPedestalSpins() → for each pedestal:
            computeSpins(pedestal.SubType, state.selectedItemType, carBattery)
            → getSpinColor() / getUnreachableColor()
            → draw label above pedestal
```

---

## Config Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TSTL compiler config: Lua 5.3 target, single-file bundle via `src/bundleEntry.ts` |
| `isaacscript.json` | IsaacScript CLI config: mods directory, save slot (gitignored, per-user) |
| `package.json` | Dependencies + scripts (`npm start` = monitor, `npm run build` = tstl, `npm run lint` = all checks) |
| `eslint.config.mjs` | ESLint flat config (IsaacScript preset) |
| `prettier.config.mjs` | Prettier with organize-imports, XML, package.json plugins |
| `cspell.config.jsonc` | Spell check (IsaacScript dictionary) |
| `.luarc.json` | Lua LSP globals for compiled output |
| `.github/workflows/ci.yml` | CI: build + lint on push/PR |

### Key npm scripts

| Script | Command | What it does |
|--------|---------|-------------|
| `start` | `isaacscript monitor` | Watch + auto-recompile to Lua |
| `build` | `tstl` | One-shot TypeScript→Lua compile |
| `lint` | `tsx ./scripts/lint.ts` | Type-check + eslint + prettier + cspell + ts-prune |
| `nuke` | `isaacscript nuke` | Clean build artifacts |
| `publish` | `isaacscript publish` | Publish to Steam Workshop |

---

## Assets

| File | Purpose |
|------|---------|
| `mod/metadata.xml` | Isaac mod metadata (name, version, description) |
| `mod/resources/gfx/ui/window_bg.anm2` + `.png` | Virtual keyboard window background (frame `"bg"`) |
| `font/pftempestasevencondensed.fnt` | Spin count font (loaded at runtime from game resources) |

---

## Where to Edit (Quick Reference)

### UI Changes

| Change | File | What to edit |
|--------|------|-------------|
| Window size | `src/features/virtualKeyboard.ts` | `WIN_W`, `WIN_H` |
| Window position | `src/features/virtualKeyboard.ts` | `WIN_X_FN`, `WIN_Y_FN` |
| Layout offsets (input, results, keyboard Y) | `src/features/virtualKeyboard.ts` | `INPUT_Y`, `RESULTS_Y`, `KEYBOARD_Y`, `HELP_Y` |
| Key/row sizes | `src/features/virtualKeyboard.ts` | `KEY_W`, `KEY_ROW_H`, `SPECIAL_W` |
| Keyboard layout | `src/constants.ts` | `KEYBOARD_ROWS`, `KEYBOARD_SPECIALS` |
| Text scale | `src/features/virtualKeyboard.ts` | `TEXT_SCALE` |
| Sprite scale (results) | `src/features/virtualKeyboard.ts` | `SPRITE_SCALE` |
| Result sprite scale (target info) | `src/features/pedestalOverlay.ts` | `sprite.Scale = Vector(0.5, 0.5)` (hardcoded) |
| Max results shown | `src/features/virtualKeyboard.ts` | `MAX_RESULTS` |
| Any text color | `src/features/virtualKeyboard.ts` | `rtext()` call RGB values — see color table above |
| Background sprite | `mod/resources/gfx/ui/` | Replace `window_bg.anm2` + `.png` |
| Spin count font | `src/features/pedestalOverlay.ts` | `spinFont.Load("font/...")` line |
| Target info position | `src/features/pedestalOverlay.ts` | Hardcoded `(20, 28)` / `(48, 28)` in `renderTargetInfo()` |
| Spin label offset above pedestal | `src/features/pedestalOverlay.ts` | `screenPos.Y - 20` in `renderPedestalSpins()` |
| "No target" message | `src/features/pedestalOverlay.ts` | `renderNoTargetMessage()` |
| Debug text position/color | `src/features/virtualKeyboard.ts` | `handleDebugText()` — hardcoded `(10, 100)` yellow |

### Logic Changes

| Change | File | What to edit |
|--------|------|-------------|
| Spin calculation | `src/utils/calculator.ts` | `computeSpins()` |
| Add/remove hidden items | `src/constants.ts` | `HIDDEN_SPINDOWN_IDS` |
| Spin color thresholds | `src/utils/color.ts` | `getSpinColor()` if/else chain |
| Unreachable color | `src/utils/color.ts` | `getUnreachableColor()` |
| Item search (filtering, scoring) | `src/utils/items.ts` | `searchItems()`, `getItemRegistry()` |
| Key repeat speed | `src/constants.ts` | `KEYBOARD_COOLDOWN_FRAMES` |
| Selection cooldown | `src/features/virtualKeyboard.ts` | Hardcoded `15` in `handleSelectionInput()` |
| Double-tap window | `src/features/virtualKeyboard.ts` | Hardcoded `20` in `handleToggleInput()` |
| Car Battery check | `src/features/pedestalOverlay.ts` | `CAR_BATTERY_ID` constant |
| Add new feature class | `src/main.ts` | Add to `FEATURES` array |

### Metadata / Config

| Change | File |
|--------|------|
| Mod name, version, description | `mod/metadata.xml` + `package.json` |
| TypeScript compiler options | `tsconfig.json` |
| Lint rules | `eslint.config.mjs` |
| Spell check words | `cspell.config.jsonc` |
| Formatting | `prettier.config.mjs` |

---

## Known Issues / Future Work

See also `docs/spindown-mechanics.md` for a detailed Spindown Dice mechanics analysis and documented bugs.

1. **Dad's Note between source and target**: The current calculator only checks if the pedestal item IS Dad's Note (668), not if Dad's Note falls between source and target IDs. The old Lua version had a `"DN"` label for this case — not yet reimplemented.
2. **Unlock checking**: Items not yet unlocked by the player still appear in search results and spin calculations.
3. **Challenge/daily run filtering**: No tag-based item filtering.
4. **Rainbow color**: `getRainbowColor()` in `color.ts` is dead code (not called anywhere).
5. **Hardcoded positions**: Overlay element positions are magic numbers rather than named constants.
