import {
  ButtonAction,
  InputHook,
  ModCallback,
} from "isaac-typescript-definitions";
import type { ModUpgraded } from "isaacscript-common";
import { Callback, fonts, ModFeature } from "isaacscript-common";

import {
  KEYBOARD_COOLDOWN_FRAMES,
  KEYBOARD_ROWS,
  KEYBOARD_SPECIALS,
} from "../constants";
import {
  isKeyboardOpen,
  overlayPinned,
  selectedItemName,
  selectedItemType,
} from "../state";
import type { RGBA } from "../utils/color";
import { makeColor, makeKColor } from "../utils/color";
import type { ItemEntry } from "../utils/items";
import { searchItems } from "../utils/items";
import { getCollectibleSprite, loadStaticSprite } from "../utils/sprite";

const WIN_W = 216;
const WIN_H = 112;
const WIN_X_FN = () => Math.floor((Isaac.GetScreenWidth() - WIN_W) / 2);
const WIN_Y_FN = () => Math.floor((Isaac.GetScreenHeight() - WIN_H) / 2);
const MAX_RESULTS = 5;

const INPUT_Y = 8;
const RESULTS_TOP_Y = 16;
const RESULTS_BOT_Y = 32;
const KEYBOARD_Y = 56;
const HELP_Y = 100;
const CONTENT_LEFT_PAD = 4;
const NAME_ROW_OFFSET = 6;
const KEY_ROW_H = 8;
const KEY_W = 8;
const SPECIAL_W = 48;
const SELECT_COOLDOWN_FRAMES = 15;

const SPRITE_SCALE = 0.4;
const SPRITE_PX = Math.floor(SPRITE_SCALE * 30);

const CH_W = 4;

const THEME = {
  inputPrompt: [0.75, 0.18, 0.14, 1],
  inputText: [0.88, 0.78, 0.63, 1],
  noMatch: [0.38, 0.26, 0.18, 0.7],
  resultNameSelected: [0.85, 0.22, 0.12, 1],
  resultNameNormal: [0.52, 0.34, 0.24, 0.8],
  resultSpriteSelected: [1, 1, 1, 1],
  resultSpriteNormal: [0.45, 0.35, 0.28, 0.65],
  keySelected: [0.8, 0.18, 0.14, 1],
  keyNormal: [0.22, 0.14, 0.07, 0.9],
  specialOverlayActive: [0.92, 0.76, 0.3, 1],
  helpText: [0.4, 0.28, 0.2, 0.55],
} as const satisfies Record<string, RGBA>;

function getKbFont(): Font {
  return fonts.terminus;
}

function rtext(s: string, x: number, y: number, rgba: RGBA): void {
  getKbFont().DrawStringScaled(s, x, y, 0.55, 0.55, makeKColor(rgba), 0, false);
}

function shortenName(name: string, maxChars: number): string {
  if (name.length <= maxChars) {
    return name;
  }
  return `${name.slice(0, maxChars - 1)}.`;
}

export class VirtualKeyboardFeature extends ModFeature {
  private searchText = "";
  private matchedItems: readonly ItemEntry[] = [];
  private selectedResultIndex = 0;
  private keyboardCursorRow = 0;
  private keyboardCursorCol = Math.floor((KEYBOARD_ROWS[0]?.length ?? 10) / 2);
  private cursorInResults = false;
  private moveCooldown = 0;
  private wasConfirmPressed = false;
  private wasBackPressed = false;
  private selectCooldown = 0;
  private closeCooldown = 0;
  private mapWasDown = false;
  private mapDoubleTapTimer = 0;

  constructor(mod: ModUpgraded) {
    super(mod, true);
  }

  private get shouldBlockInput(): boolean {
    return isKeyboardOpen.get() || this.closeCooldown > 0;
  }

  @Callback(ModCallback.INPUT_ACTION, InputHook.IS_ACTION_PRESSED)
  onActionPressed(): boolean | undefined {
    return this.shouldBlockInput ? false : undefined;
  }

  @Callback(ModCallback.INPUT_ACTION, InputHook.IS_ACTION_TRIGGERED)
  onActionTriggered(): boolean | undefined {
    return this.shouldBlockInput ? false : undefined;
  }

  @Callback(ModCallback.INPUT_ACTION, InputHook.GET_ACTION_VALUE)
  onGetActionValue(): number | undefined {
    return this.shouldBlockInput ? 0 : undefined;
  }

  @Callback(ModCallback.POST_RENDER)
  postRender(): void {
    this.handleToggleInput();

    if (!isKeyboardOpen.get()) {
      if (this.closeCooldown > 0) {
        this.closeCooldown--;
      }
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
    const justPressed = mapDown && !this.mapWasDown;
    this.mapWasDown = mapDown;

    if (justPressed) {
      if (this.mapDoubleTapTimer > 0) {
        this.toggleKeyboard();
        this.mapDoubleTapTimer = 0;
      } else {
        this.mapDoubleTapTimer = 20;
      }
    }
    if (this.mapDoubleTapTimer > 0) {
      this.mapDoubleTapTimer--;
    }
  }

  private toggleKeyboard(): void {
    if (isKeyboardOpen.get()) {
      this.closeKeyboard();
    } else {
      isKeyboardOpen.set(true);
      this.keyboardCursorRow = 0;
      this.keyboardCursorCol = Math.floor((KEYBOARD_ROWS[0]?.length ?? 10) / 2);
      this.cursorInResults = false;
      this.searchText = "";
      this.matchedItems = searchItems("");
      this.selectedResultIndex = 0;
      this.wasConfirmPressed = false;
      this.wasBackPressed = false;
      this.selectCooldown = 0;
    }
  }

  private handleCursorMovement(): void {
    if (this.moveCooldown > 0) {
      this.moveCooldown--;
      return;
    }
    const player = Isaac.GetPlayer(0);
    if (player === undefined) {
      return;
    }
    const ci = player.ControllerIndex;
    const up =
      Input.IsActionPressed(ButtonAction.UP, ci)
      || Input.IsActionPressed(ButtonAction.MENU_UP, ci);
    const down =
      Input.IsActionPressed(ButtonAction.DOWN, ci)
      || Input.IsActionPressed(ButtonAction.MENU_DOWN, ci);
    const left =
      Input.IsActionPressed(ButtonAction.LEFT, ci)
      || Input.IsActionPressed(ButtonAction.MENU_LEFT, ci);
    const right =
      Input.IsActionPressed(ButtonAction.RIGHT, ci)
      || Input.IsActionPressed(ButtonAction.MENU_RIGHT, ci);
    if (!up && !down && !left && !right) {
      return;
    }
    if (this.cursorInResults) {
      this.handleResultCursorMovement(up, down, left, right);
    } else {
      this.handleKeyboardCursorMovement(up, down, left, right);
    }
  }

  private handleKeyboardCursorMovement(
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
  ): void {
    if (up) {
      this.keyboardCursorRow--;
    } else if (down) {
      this.keyboardCursorRow++;
    } else if (left) {
      this.keyboardCursorCol--;
    } else if (right) {
      this.keyboardCursorCol++;
    } else {
      return;
    }
    const sr = KEYBOARD_ROWS.length;
    if (this.keyboardCursorRow < 0) {
      if (this.matchedItems.length > 0) {
        this.cursorInResults = true;
        this.selectedResultIndex = 0;
      } else {
        this.keyboardCursorRow = 0;
      }
    } else if (this.keyboardCursorRow > sr) {
      this.keyboardCursorRow = sr;
    } else {
      this.clampKeyboardCursor();
    }
    this.moveCooldown = KEYBOARD_COOLDOWN_FRAMES;
  }

  private handleResultCursorMovement(
    up: boolean,
    down: boolean,
    left: boolean,
    right: boolean,
  ): void {
    const n = Math.min(this.matchedItems.length, MAX_RESULTS);
    if (up) {
      // Only move to the top row if there is a result directly above; otherwise stay put.
      if (this.selectedResultIndex < 3 && this.selectedResultIndex + 3 < n) {
        this.selectedResultIndex += 3;
      }
    } else if (down) {
      if (this.selectedResultIndex >= 3) {
        this.selectedResultIndex -= 3;
      } else {
        this.cursorInResults = false;
        this.keyboardCursorRow = 0;
        this.keyboardCursorCol = Math.floor(
          (KEYBOARD_ROWS[0]?.length ?? 10) / 2,
        );
      }
    } else if (left) {
      this.selectedResultIndex--;
    } else if (right) {
      this.selectedResultIndex++;
    } else {
      return;
    }
    if (this.selectedResultIndex < 0) {
      this.selectedResultIndex = n - 1;
    } else if (this.selectedResultIndex >= n) {
      this.selectedResultIndex = 0;
    }
    this.moveCooldown = KEYBOARD_COOLDOWN_FRAMES;
  }

  private clampKeyboardCursor(): void {
    if (this.keyboardCursorRow < 0) {
      this.keyboardCursorRow = 0;
    }
    const sr = KEYBOARD_ROWS.length;
    if (this.keyboardCursorRow > sr) {
      this.keyboardCursorRow = sr;
    }

    if (this.keyboardCursorRow < sr) {
      const row = KEYBOARD_ROWS[this.keyboardCursorRow];
      if (row !== undefined) {
        const len = row.length;
        if (this.keyboardCursorCol < 0) {
          this.keyboardCursorCol = len - 1;
        } else if (this.keyboardCursorCol >= len) {
          this.keyboardCursorCol = 0;
        }
      }
    } else {
      const len = KEYBOARD_SPECIALS.length;
      if (this.keyboardCursorCol < 0) {
        this.keyboardCursorCol = len - 1;
      } else if (this.keyboardCursorCol >= len) {
        this.keyboardCursorCol = 0;
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
    const confirm =
      Input.IsActionPressed(ButtonAction.MENU_CONFIRM, ci)
      || Input.IsActionPressed(ButtonAction.ITEM, ci);
    const back =
      Input.IsActionPressed(ButtonAction.MENU_BACK, ci)
      || Input.IsActionPressed(ButtonAction.BOMB, ci);

    if (this.cursorInResults) {
      if (confirm && !this.wasConfirmPressed) {
        this.selectHighlightedResult();
        this.selectCooldown = SELECT_COOLDOWN_FRAMES;
      }
      if (back && !this.wasBackPressed) {
        this.closeKeyboard();
        this.selectCooldown = SELECT_COOLDOWN_FRAMES;
      }
    } else {
      if (confirm && !this.wasConfirmPressed) {
        this.typeKeyboardKey();
        this.selectCooldown = SELECT_COOLDOWN_FRAMES;
      }
      if (back && !this.wasBackPressed) {
        this.backspace();
        this.selectCooldown = SELECT_COOLDOWN_FRAMES;
      }
    }
    this.wasConfirmPressed = confirm;
    this.wasBackPressed = back;
  }

  private typeKeyboardKey(): void {
    if (this.keyboardCursorRow < KEYBOARD_ROWS.length) {
      const row = KEYBOARD_ROWS[this.keyboardCursorRow];
      if (row !== undefined && row[this.keyboardCursorCol] !== undefined) {
        this.searchText += String(row[this.keyboardCursorCol]);
        this.onSearchChanged();
      }
    } else {
      const s = KEYBOARD_SPECIALS[this.keyboardCursorCol];
      switch (s) {
        case "SPACE": {
          this.searchText += " ";
          this.onSearchChanged();

          break;
        }

        case "CLEAR": {
          selectedItemType.set(undefined);
          selectedItemName.set("");
          overlayPinned.set(false);
          this.closeKeyboard();

          break;
        }

        case "OVERLAY": {
          overlayPinned.set(!overlayPinned.get());
          this.closeKeyboard();

          break;
        }
        // No default
      }
    }
  }

  private backspace(): void {
    if (this.searchText.length > 0) {
      this.searchText = this.searchText.slice(0, -1);
      this.onSearchChanged();
    }
  }

  private onSearchChanged(): void {
    this.matchedItems = searchItems(this.searchText);
    this.selectedResultIndex = 0;
  }

  private selectHighlightedResult(): void {
    const item = this.matchedItems[this.selectedResultIndex];
    if (item !== undefined) {
      selectedItemType.set(item.type);
      selectedItemName.set(item.name);
      overlayPinned.set(true);
    }
    this.closeKeyboard();
  }

  private closeKeyboard(): void {
    isKeyboardOpen.set(false);
    this.cursorInResults = false;
    this.closeCooldown = 8;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - Window rendering
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  private renderWindow(): void {
    const wx = WIN_X_FN();
    const wy = WIN_Y_FN();

    const bg = loadStaticSprite("gfx/ui/window_bg.anm2", "bg");
    bg.Render(Vector(wx, wy), Vector(0, 0), Vector(0, 0));

    this.renderInput(wx, wy + INPUT_Y);
    const bottomN = Math.min(this.matchedItems.length, 3);
    const cellW = Math.floor((WIN_W - 16) / (bottomN === 0 ? 3 : bottomN));
    const cx = wx + CONTENT_LEFT_PAD;
    this.renderResultsRow(cx, wy + RESULTS_BOT_Y, 0, 3, cellW);
    this.renderResultsRow(cx, wy + RESULTS_TOP_Y, 3, 5, cellW);
    this.renderKeyboardGrid(cx, wy + KEYBOARD_Y);
    this.renderHelpBar(cx, wy + HELP_Y);
  }

  private renderInput(wx: number, y: number): void {
    const maxVisible = Math.floor((WIN_W - 40) / CH_W);
    const t = this.searchText;
    let display: string;
    if (t.length === 0) {
      display = "_";
    } else if (t.length > maxVisible) {
      display = `${t.slice(-(maxVisible - 1))}_`;
    } else {
      display = `${t}_`;
    }

    const inputBlockW = (display.length + 2) * CH_W;
    const inputX = wx + Math.floor((WIN_W - inputBlockW) / 2);

    rtext(">", inputX, y, THEME.inputPrompt);
    rtext(display, inputX + CH_W * 2, y, THEME.inputText);
  }

  private renderResultsRow(
    wx: number,
    y: number,
    start: number,
    end: number,
    cellW?: number,
  ): void {
    const items = this.matchedItems;
    const max = Math.min(items.length, end);
    if (start >= max) {
      if (start === 0 && this.searchText.length > 0) {
        const msg = "no match";
        rtext(
          msg,
          wx + WIN_W / 2 - msg.length * (CH_W / 2),
          y + 3,
          THEME.noMatch,
        );
      }
      return;
    }

    const n = max - start;
    const SIDE_PAD = 8;
    const useCW = cellW ?? Math.floor((WIN_W - 2 * SIDE_PAD) / n);
    const blockW = n * useCW;
    const ox = SIDE_PAD + Math.floor((WIN_W - 2 * SIDE_PAD - blockW) / 2);
    const nameY = y + 2 + NAME_ROW_OFFSET;
    const FONT_SCALE = 0.48;

    for (let i = 0; i < n; i++) {
      const item = items[start + i]!;
      const cellX = wx + ox + i * useCW;
      const sel =
        this.cursorInResults && start + i === this.selectedResultIndex;

      const gfx = item.gfxFileName;
      if (gfx.length > 0) {
        const sprite = getCollectibleSprite(gfx);
        if (sprite !== undefined) {
          sprite.Color = sel
            ? makeColor(THEME.resultSpriteSelected)
            : makeColor(THEME.resultSpriteNormal);
          sprite.SetFrame("Idle", 8);
          sprite.Scale = Vector(SPRITE_SCALE, SPRITE_SCALE);
          sprite.Render(
            Vector(cellX + SPRITE_PX / 2, nameY + SPRITE_PX + 2),
            Vector(0, 0),
            Vector(0, 0),
          );
        }
      }

      const name = shortenName(item.name, 17);
      fonts.droid.DrawStringScaled(
        name,
        cellX + SPRITE_PX + 1,
        nameY,
        FONT_SCALE,
        FONT_SCALE,
        makeKColor(sel ? THEME.resultNameSelected : THEME.resultNameNormal),
        0,
        false,
      );
    }
  }

  private renderKeyboardGrid(wx: number, y: number): void {
    for (const [row, KEYBOARD_ROW] of KEYBOARD_ROWS.entries()) {
      const keys = KEYBOARD_ROW;
      const rw = keys.length * KEY_W;
      const ox = Math.floor((WIN_W - rw) / 2);
      const ry = y + row * KEY_ROW_H;
      for (const [col, key] of keys.entries()) {
        const x = wx + ox + col * KEY_W;
        const sel =
          !this.cursorInResults
          && this.keyboardCursorRow === row
          && this.keyboardCursorCol === col;
        if (sel) {
          rtext(key, x, ry, THEME.keySelected);
        } else {
          rtext(key, x, ry, THEME.keyNormal);
        }
      }
    }

    const sr = KEYBOARD_ROWS.length;
    const sw = KEYBOARD_SPECIALS.length * SPECIAL_W;
    const sox = Math.floor((WIN_W - sw) / 2);
    const sy = y + sr * KEY_ROW_H + 2;
    for (const [col, label] of KEYBOARD_SPECIALS.entries()) {
      const x = wx + sox + col * SPECIAL_W;
      const sel =
        !this.cursorInResults
        && this.keyboardCursorRow === sr
        && this.keyboardCursorCol === col;
      const overlayActive = label === "OVERLAY" && overlayPinned.get();
      if (sel) {
        rtext(`[${label}]`, x, sy, THEME.keySelected);
      } else if (overlayActive) {
        rtext(`[${label}]`, x, sy, THEME.specialOverlayActive);
      } else {
        rtext(`[${label}]`, x, sy, THEME.keyNormal);
      }
    }
  }

  private renderHelpBar(wx: number, y: number): void {
    const msg = this.cursorInResults
      ? "^ v rows  < > nav  A:pick  B:close"
      : "^:results  A:type  B:del";
    const msgW = msg.length * 4;
    const x = wx + Math.floor((WIN_W - msgW) / 2) + 12;
    fonts.terminus.DrawStringScaled(
      msg,
      x,
      y,
      0.5,
      0.5,
      makeKColor(THEME.helpText),
      0,
      false,
    );
  }
}
