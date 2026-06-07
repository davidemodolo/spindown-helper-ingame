import {
  ButtonAction,
  InputHook,
  ModCallback,
} from "isaac-typescript-definitions";
import { ModFeature, Callback } from "isaacscript-common";
import type { ModUpgraded } from "isaacscript-common";
import state from "../state";
import {
  KEYBOARD_COOLDOWN_FRAMES,
  KEYBOARD_ROWS,
  KEYBOARD_SPECIALS,
} from "../constants";
import { searchItems } from "../utils/items";

const v = {
  run: {},
};

const WIN_W = 180;
const WIN_H = 92;
const WIN_X_FN = () => Math.floor((Isaac.GetScreenWidth() - WIN_W) / 2);
const WIN_Y_FN = () => Math.floor((Isaac.GetScreenHeight() - WIN_H) / 2);
const MAX_RESULTS = 3;

// Layout Y-offsets (screen coords relative to wy)
const INPUT_Y = 6;
const RESULTS_Y = 18;
const KEYBOARD_Y = 32;
const KEY_ROW_H = 9;
const KEY_W = 11;
const SPECIAL_W = 50;
const HELP_Y = 76;

const SPRITE_SCALE = 0.4;
const SPRITE_PX = Math.floor(SPRITE_SCALE * 30);

const CH_W = 3;

const spriteCache = new Map<string, Sprite>();
let windowBg: Sprite | undefined;
let kbFont: Font | undefined;

function getItemSprite(gfxFileName: string): Sprite | undefined {
  if (gfxFileName.length === 0) {
    return undefined;
  }
  let sprite = spriteCache.get(gfxFileName);
  if (sprite !== undefined) {
    return sprite;
  }
  sprite = Sprite();
  sprite.Load("gfx/005.100_collectible.anm2", true);
  sprite.ReplaceSpritesheet(1, gfxFileName);
  sprite.LoadGraphics();
  spriteCache.set(gfxFileName, sprite);
  return sprite;
}

function getWindowBg(): Sprite | undefined {
  if (windowBg !== undefined) {
    return windowBg;
  }
  windowBg = Sprite();
  windowBg.Load("gfx/ui/window_bg.anm2", true);
  windowBg.SetFrame("bg", 0);
  windowBg.LoadGraphics();
  return windowBg;
}


function getKbFont(): Font {
  if (kbFont === undefined) {
    kbFont = Font();
    kbFont.Load("font/pftempestasevencondensed.fnt");
  }
  return kbFont;
}

function rtext(s: string, x: number, y: number, r: number, g: number, b: number, a: number): void {
  getKbFont().DrawStringScaled(s, x, y, 0.55, 0.55, KColor(r, g, b, a), 0, false);
}

function shortenName(name: string, maxChars: number): string {
  if (name.length <= maxChars) {
    return name;
  }
  return `${name.slice(0, maxChars - 1)}.`;
}

export class VirtualKeyboardFeature extends ModFeature {
  v = v;

  private wasConfirmPressed = false;
  private wasBackPressed = false;
  private selectCooldown = 0;
  private closeCooldown = 0;
  private selectWasDown = false;
  private selectPressTimer = 0;

  constructor(mod: ModUpgraded) {
    super(mod, true);
  }

  @Callback(ModCallback.INPUT_ACTION, InputHook.IS_ACTION_PRESSED)
  onActionPressed(): boolean | undefined {
    if (state.isKeyboardOpen || this.closeCooldown > 0) {
      return false;
    }
    return undefined;
  }

  @Callback(ModCallback.INPUT_ACTION, InputHook.IS_ACTION_TRIGGERED)
  onActionTriggered(): boolean | undefined {
    if (state.isKeyboardOpen || this.closeCooldown > 0) {
      return false;
    }
    return undefined;
  }

  @Callback(ModCallback.INPUT_ACTION, InputHook.GET_ACTION_VALUE)
  onGetActionValue(): number | undefined {
    if (state.isKeyboardOpen || this.closeCooldown > 0) {
      return 0;
    }
    return undefined;
  }

  @Callback(ModCallback.POST_RENDER)
  postRender(): void {
    this.handleToggleInput();

    if (!state.isKeyboardOpen) {
      if (this.closeCooldown > 0) {
        this.closeCooldown--;
        const player = Isaac.GetPlayer(0);
        if (player !== undefined) {
          player.ControlsEnabled = this.closeCooldown > 0 ? false : true;
        }
      }
      return;
    }

    const player = Isaac.GetPlayer(0);
    if (player !== undefined) {
      player.ControlsEnabled = false;
    } else {
      return;
    }

    this.handleCursorMovement();
    this.handleSelectionInput();
    this.renderWindow();
  }

  private handleToggleInput(): void {
    const player = Isaac.GetPlayer(0);
    const ci = player?.ControllerIndex ?? 0;
    const mapDown = Input.IsActionPressed(ButtonAction.MAP, ci);
    const justPressed = mapDown && !this.selectWasDown;
    this.selectWasDown = mapDown;

    if (justPressed) {
      if (this.selectPressTimer > 0) {
        this.toggleKeyboard();
        this.selectPressTimer = 0;
      } else {
        this.selectPressTimer = 20;
      }
    }
    if (this.selectPressTimer > 0) {
      this.selectPressTimer--;
    }
  }

  private toggleKeyboard(): void {
    if (state.isKeyboardOpen) {
      this.closeKeyboard();
    } else {
      state.isKeyboardOpen = true;
      state.keyboardCursorRow = 0;
      state.keyboardCursorCol = Math.floor(
        (KEYBOARD_ROWS[0]?.length ?? 10) / 2,
      );
      state.cursorInResults = false;
      state.searchText = "";
      state.matchedItems = searchItems("");
      state.selectedResultIndex = 0;
      this.wasConfirmPressed = false;
      this.wasBackPressed = false;
      this.selectCooldown = 0;
    }
  }

  private handleCursorMovement(): void {
    if (state.moveCooldown > 0) {
      state.moveCooldown--;
      return;
    }
    const player = Isaac.GetPlayer(0);
    if (player === undefined) {
      return;
    }
    const ci = player.ControllerIndex;
    const up = Input.IsActionPressed(ButtonAction.UP, ci) || Input.IsActionPressed(ButtonAction.MENU_UP, ci);
    const down = Input.IsActionPressed(ButtonAction.DOWN, ci) || Input.IsActionPressed(ButtonAction.MENU_DOWN, ci);
    const left = Input.IsActionPressed(ButtonAction.LEFT, ci) || Input.IsActionPressed(ButtonAction.MENU_LEFT, ci);
    const right = Input.IsActionPressed(ButtonAction.RIGHT, ci) || Input.IsActionPressed(ButtonAction.MENU_RIGHT, ci);
    if (!up && !down && !left && !right) {
      return;
    }
    if (state.cursorInResults) {
      this.handleResultCursorMovement(down, left, right);
    } else {
      this.handleKeyboardCursorMovement(up, down, left, right);
    }
  }

  private handleKeyboardCursorMovement(
    up: boolean, down: boolean, left: boolean, right: boolean,
  ): void {
    if (up) {
      state.keyboardCursorRow--;
    } else if (down) {
      state.keyboardCursorRow++;
    } else if (left) {
      state.keyboardCursorCol--;
    } else if (right) {
      state.keyboardCursorCol++;
    } else {
      return;
    }
    const sr = KEYBOARD_ROWS.length;
    if (state.keyboardCursorRow < 0) {
      if (state.matchedItems.length > 0) {
        state.cursorInResults = true;
        state.selectedResultIndex = 0;
      } else {
        state.keyboardCursorRow = 0;
      }
    } else if (state.keyboardCursorRow > sr) {
      state.keyboardCursorRow = sr;
    } else {
      this.clampKeyboardCursor();
    }
    state.moveCooldown = KEYBOARD_COOLDOWN_FRAMES;
  }

  private handleResultCursorMovement(
    down: boolean, left: boolean, right: boolean,
  ): void {
    if (down) {
      state.cursorInResults = false;
      state.keyboardCursorRow = 0;
      state.keyboardCursorCol = Math.floor((KEYBOARD_ROWS[0]?.length ?? 10) / 2);
    } else if (left) {
      state.selectedResultIndex--;
    } else if (right) {
      state.selectedResultIndex++;
    } else {
      return;
    }
    const n = Math.min(state.matchedItems.length, MAX_RESULTS);
    if (state.selectedResultIndex < 0) {
      state.selectedResultIndex = n - 1;
    } else if (state.selectedResultIndex >= n) {
      state.selectedResultIndex = 0;
    }
    state.moveCooldown = KEYBOARD_COOLDOWN_FRAMES;
  }

  private clampKeyboardCursor(): void {
    if (state.keyboardCursorRow < 0) {
      state.keyboardCursorRow = 0;
    }
    const sr = KEYBOARD_ROWS.length;
    if (state.keyboardCursorRow >= sr) {
      state.keyboardCursorRow = sr;
    }
    if (state.keyboardCursorRow < sr) {
      const row = KEYBOARD_ROWS[state.keyboardCursorRow];
      if (row !== undefined) {
        const len = row.length;
        if (state.keyboardCursorCol < 0) {
          state.keyboardCursorCol = len - 1;
        } else if (state.keyboardCursorCol >= len) {
          state.keyboardCursorCol = 0;
        }
      }
    } else {
      const len = KEYBOARD_SPECIALS.length;
      if (state.keyboardCursorCol < 0) {
        state.keyboardCursorCol = len - 1;
      } else if (state.keyboardCursorCol >= len) {
        state.keyboardCursorCol = 0;
      }
    }
  }

  private handleSelectionInput(): void {
    if (this.selectCooldown > 0) {
      this.selectCooldown--;
      return;
    }
    const player = Isaac.GetPlayer(0);
    if (player === undefined) {
      return;
    }
    const ci = player.ControllerIndex;
    const confirm = Input.IsActionPressed(ButtonAction.MENU_CONFIRM, ci) || Input.IsActionPressed(ButtonAction.ITEM, ci);
    const back = Input.IsActionPressed(ButtonAction.MENU_BACK, ci) || Input.IsActionPressed(ButtonAction.BOMB, ci);

    if (state.cursorInResults) {
      if (confirm && !this.wasConfirmPressed) {
        this.selectHighlightedResult();
        this.selectCooldown = 15;
      }
      if (back && !this.wasBackPressed) {
        this.closeKeyboard();
        this.selectCooldown = 15;
      }
    } else {
      if (confirm && !this.wasConfirmPressed) {
        this.typeKeyboardKey();
        this.selectCooldown = 15;
      }
      if (back && !this.wasBackPressed) {
        this.backspace();
        this.selectCooldown = 15;
      }
    }
    this.wasConfirmPressed = confirm;
    this.wasBackPressed = back;
  }

  private typeKeyboardKey(): void {
    if (state.keyboardCursorRow < KEYBOARD_ROWS.length) {
      const row = KEYBOARD_ROWS[state.keyboardCursorRow];
      if (row !== undefined && row[state.keyboardCursorCol] !== undefined) {
        state.searchText += row[state.keyboardCursorCol];
        this.onSearchChanged();
      }
    } else {
      const s = KEYBOARD_SPECIALS[state.keyboardCursorCol];
      if (s === "SPACE") {
        state.searchText += " ";
        this.onSearchChanged();
      } else if (s === "CLEAR") {
        state.selectedItemType = undefined;
        state.selectedItemName = "";
        state.overlayPinned = false;
        this.closeKeyboard();
      } else if (s === "OVERLAY") {
        state.overlayPinned = !state.overlayPinned;
        this.closeKeyboard();
      }
    }
  }

  private backspace(): void {
    if (state.searchText.length > 0) {
      state.searchText = state.searchText.slice(0, -1);
      this.onSearchChanged();
    }
  }

  private onSearchChanged(): void {
    state.matchedItems = searchItems(state.searchText);
    state.selectedResultIndex = 0;
  }

  private selectHighlightedResult(): void {
    const item = state.matchedItems[state.selectedResultIndex];
    if (item !== undefined) {
      state.selectedItemType = item.type;
      state.selectedItemName = item.name;
      state.overlayPinned = true;
    }
    this.closeKeyboard();
  }

  private closeKeyboard(): void {
    state.isKeyboardOpen = false;
    state.cursorInResults = false;
    this.closeCooldown = 8;
    const player = Isaac.GetPlayer(0);
    if (player !== undefined) {
      player.ControlsEnabled = false;
    }
  }

  // ==================================================================
  // Window rendering
  // ==================================================================

  private renderWindow(): void {
    const wx = WIN_X_FN();
    const wy = WIN_Y_FN();

    const bg = getWindowBg();
    if (bg !== undefined) {
      bg.SetFrame("bg", 0);
      bg.Render(Vector(wx, wy), Vector(0, 0), Vector(0, 0));
    }

    this.renderInput(wx, wy + INPUT_Y);
    this.renderResultsRow(wx, wy + RESULTS_Y);
    this.renderKeyboardGrid(wx, wy + KEYBOARD_Y);
    this.renderHelpBar(wx, wy + HELP_Y);
  }

  private renderInput(wx: number, y: number): void {
    const maxVisible = Math.floor((WIN_W - 40) / CH_W);
    const t = state.searchText;
    const display = t.length === 0
      ? "_"
      : t.length > maxVisible
        ? `${t.slice(-(maxVisible - 1))}_`
        : `${t}_`;

    const inputBlockW = (display.length + 2) * CH_W;
    const inputX = wx + Math.floor((WIN_W - inputBlockW) / 2);

    rtext(">", inputX, y, 0.75, 0.18, 0.14, 1);
    rtext(display, inputX + CH_W * 2, y, 0.88, 0.78, 0.63, 1);

    if (state.selectedItemName.length > 0 && state.searchText.length === 0) {
      const label = shortenName(state.selectedItemName, 15);
      rtext(label, wx + WIN_W - label.length * CH_W - 22, y, 0.78, 0.55, 0.30, 0.8);
    }
  }

  private renderResultsRow(wx: number, y: number): void {
    const items = state.matchedItems;
    const n = Math.min(items.length, MAX_RESULTS);
    if (n === 0) {
      if (state.searchText.length > 0) {
        const msg = "no match";
        rtext(msg, wx + WIN_W / 2 - msg.length * (CH_W / 2), y + 3, 0.38, 0.26, 0.18, 0.7);
      }
      return;
    }

    const SIDE_PAD = 8;
    const cellW = Math.floor((WIN_W - 2 * SIDE_PAD) / MAX_RESULTS); // 54px, gives 8px breathing room each side
    const blockW = n * cellW;
    const ox = SIDE_PAD + Math.floor((WIN_W - 2 * SIDE_PAD - blockW) / 2);
    const nameY = y + 3;
    const prefixW = SPRITE_PX;

    for (let i = 0; i < n; i++) {
      const item = items[i]!;
      const cellX = wx + ox + i * cellW;
      const sel = state.cursorInResults && i === state.selectedResultIndex;

      const gfx = item.gfxFileName;
      if (gfx.length > 0) {
        const sprite = getItemSprite(gfx);
        if (sprite !== undefined) {
          sprite.Color = sel ? Color(1, 1, 1, 1) : Color(0.5, 0.4, 0.3, 0.7);
          sprite.SetFrame("Idle", 8);
          sprite.Scale = Vector(SPRITE_SCALE, SPRITE_SCALE);
          sprite.Render(Vector(cellX + SPRITE_PX / 2, nameY + SPRITE_PX), Vector(0, 0), Vector(0, 0));
        }
      }

      const name = shortenName(item.name, 15);
      rtext(name, cellX + prefixW, nameY, sel ? 0.92 : 0.60, sel ? 0.76 : 0.46, sel ? 0.55 : 0.33, sel ? 1 : 0.85);

      if (sel) {
        rtext("v", cellX + Math.floor(cellW / 2) - 1, y - 1, 0.75, 0.18, 0.14, 1);
      }
    }
  }

  private renderKeyboardGrid(wx: number, y: number): void {
    for (let row = 0; row < KEYBOARD_ROWS.length; row++) {
      const keys = KEYBOARD_ROWS[row]!;
      const rw = keys.length * KEY_W;
      const ox = Math.floor((WIN_W - rw) / 2);
      const ry = y + row * KEY_ROW_H;
      for (let col = 0; col < keys.length; col++) {
        const x = wx + ox + col * KEY_W;
        const sel = !state.cursorInResults
          && state.keyboardCursorRow === row
          && state.keyboardCursorCol === col;
        if (sel) {
          rtext(keys[col]!, x, ry, 0.80, 0.18, 0.14, 1);
        } else {
          rtext(keys[col]!, x, ry, 0.22, 0.14, 0.07, 0.9);
        }
      }
    }

    const sr = KEYBOARD_ROWS.length;
    const sw = KEYBOARD_SPECIALS.length * SPECIAL_W;
    const sox = Math.floor((WIN_W - sw) / 2);
    const sy = y + sr * KEY_ROW_H + 2;
    for (let col = 0; col < KEYBOARD_SPECIALS.length; col++) {
      const x = wx + sox + col * SPECIAL_W;
      const sel = !state.cursorInResults
        && state.keyboardCursorRow === sr
        && state.keyboardCursorCol === col;
      const label = KEYBOARD_SPECIALS[col];
      const overlayActive = label === "OVERLAY" && state.overlayPinned;
      if (sel) {
        rtext(`[${label}]`, x, sy, 0.80, 0.18, 0.14, 1);
      } else if (overlayActive) {
        rtext(`[${label}]`, x, sy, 0.92, 0.76, 0.30, 1);
      } else {
        rtext(`[${label}]`, x, sy, 0.22, 0.14, 0.07, 0.9);
      }
    }
  }

  private renderHelpBar(wx: number, y: number): void {
    const msg = state.cursorInResults
      ? "< > nav  A:pick  B:close  v:keys"
      : "^:results  A:type  B:del";
    const msgW = msg.length * CH_W;
    const x = wx + Math.floor((WIN_W - msgW) / 2) + 12;
    rtext(msg, x, y, 0.40, 0.28, 0.20, 0.55);
  }
}
