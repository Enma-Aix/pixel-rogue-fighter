import Phaser from "phaser";
import { TUNING } from "./constants";
import { DEFAULT_KEYS, loadSave, type Keybinds } from "./storage";
import type { BufferName, InputState } from "./types";
import { justDown } from "./ui";

const ALIAS: Record<string, string> = {
  "0": "ZERO",
  "1": "ONE",
  "2": "TWO",
  "3": "THREE",
  "4": "FOUR",
  "5": "FIVE",
  "6": "SIX",
  "7": "SEVEN",
  "8": "EIGHT",
  "9": "NINE",
};

const LABELS: Record<string, string> = {
  SPACE: "空格",
  SHIFT: "Shift",
  UP: "↑",
  DOWN: "↓",
  LEFT: "←",
  RIGHT: "→",
};

export interface CombatKeys {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  light: Phaser.Input.Keyboard.Key;
  heavy: Phaser.Input.Keyboard.Key;
  dodge: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
  esc: Phaser.Input.Keyboard.Key;
  enter: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  mute: Phaser.Input.Keyboard.Key;
}

export function keyCode(name: string): number {
  const table = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
  const code = table[ALIAS[name] ?? name];
  return typeof code === "number" ? code : table.J;
}

export function keyLabel(name: string): string {
  return LABELS[name] ?? name;
}

export function bindFromEvent(event: KeyboardEvent): string | null {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return null;
  const code = event.code;
  if (code === "Escape" || code === "Enter" || code === "NumpadEnter" || code === "KeyM") return null;
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const named: Record<string, string> = {
    Space: "SPACE",
    ShiftLeft: "SHIFT",
    ShiftRight: "SHIFT",
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
  };
  return named[code] ?? null;
}

export function controlsText(keys: Keybinds = loadSave().keys): string {
  const k = keys;
  return [
    `移动  ${keyLabel(k.left)} / ${keyLabel(k.right)}    方向键也能走`,
    `跳跃  ${keyLabel(k.jump)}、空格或 ↑    点按矮，按住高`,
    `轻击  ${keyLabel(k.light)}    重击  ${keyLabel(k.heavy)}    连招  ${keyLabel(k.light)} → ${keyLabel(k.light)} → ${keyLabel(k.heavy)}`,
    `闪避  ${keyLabel(k.dodge)} 或 Shift    奥义  ${keyLabel(k.special)}`,
    "暂停  Esc    音效  M（关 / 低 / 中 / 高）",
    "方向键、空格和 Shift 始终能用。字母键可在设置里改。",
  ].join("\n");
}

export function bindCombatKeys(scene: Phaser.Scene, keys: Keybinds = loadSave().keys): CombatKeys {
  const bound = scene.input.keyboard!.addKeys({
    left: keyCode(keys.left),
    right: keyCode(keys.right),
    jump: keyCode(keys.jump),
    space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    light: keyCode(keys.light),
    heavy: keyCode(keys.heavy),
    dodge: keyCode(keys.dodge),
    shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    special: keyCode(keys.special),
    esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    mute: Phaser.Input.Keyboard.KeyCodes.M,
  }) as CombatKeys;
  scene.input.keyboard?.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT"]);
  return bound;
}

export function gatherCombat(
  keys: CombatKeys,
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  touch: { left: boolean; right: boolean; jump: boolean },
  state: InputState,
  dt: number,
): void {
  state.left = keys.left.isDown || cursors.left.isDown || touch.left;
  state.right = keys.right.isDown || cursors.right.isDown || touch.right;
  state.jumpHeld = keys.jump.isDown || keys.space.isDown || cursors.up.isDown || touch.jump;
  const tap = (name: BufferName) => {
    state.buffer = name;
    state.bufferT = TUNING.buffer;
  };
  if (justDown(keys.jump) || justDown(keys.space) || justDown(cursors.up)) tap("jump");
  if (justDown(keys.light)) tap("light");
  if (justDown(keys.heavy)) tap("heavy");
  if (justDown(keys.dodge) || justDown(keys.shift)) tap("dodge");
  if (justDown(keys.special)) tap("special");
  if (state.buffer) {
    state.bufferT -= dt;
    if (state.bufferT <= 0) state.buffer = null;
  }
}

export function defaultKeybinds(): Keybinds {
  return { ...DEFAULT_KEYS };
}
