# Spindown Helper In-Game

An in-game mod for [_The Binding of Isaac: Repentance_](https://store.steampowered.com/app/1426300/The_Binding_of_Isaac_Repentance/) that shows how many Spindown Dice spins are needed to reach a desired item — no external companion app required.

Written in [TypeScript](https://www.typescriptlang.org/) using [IsaacScript](https://isaacscript.github.io/). This is a full rewrite of the [original Lua mod](old_version/).

## How to Use

### Select a target item

Press **F2** (or double-tap Select/Map on controller) to open the in-game virtual keyboard:

- **Arrow keys / D-pad** — move the cursor across the letter grid
- **Confirm / Item button** — type the highlighted letter
- **Back / Bomb button** — delete the last character
- **`[OK]`** — pick the first search result

As you type, up to 3 matching items appear above the keyboard. Push **Up** to enter the results row, then **Left/Right** to navigate between matches. Press **Confirm** to select one.

Press **F2** again (or double-tap Select) to close the keyboard.

### View spin counts

Hold **F1** to overlay the number of spins needed on every collectible pedestal in the room. The label appears above each item:

| Label | Meaning |
|-------|---------|
| `X` | Number of Spindown Dice spins to reach the target |
| `NO` | Unreachable — target ID is equal or higher, or blocked by a hidden item |
| `CB` | Skipped due to Car Battery (odd step count) |

Spin counts are color-coded by distance: green → yellow-green → yellow → orange → red-orange. Unreachable items are shown in dark red.

If no target is selected, a hint is shown in the top-left corner.

## How to Compile

- Install [Node.js](https://nodejs.org/en/download/)
- Clone this repository
- Run `npm ci` to install dependencies
- Run `npm start` to launch the IsaacScript monitor (auto-recompiles on changes)
- Copy or symlink the `mod/` folder into your Isaac mods directory

## Related

- [Steam Workshop](https://steamcommunity.com/app/250900/workshop/)
- [Original Lua version](old_version/)
