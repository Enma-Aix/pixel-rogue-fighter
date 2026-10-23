import { blankInput, type FrameInput } from '../core/types';

export type BindAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'attack'
  | 'heavy'
  | 'dash'
  | 'parry'
  | 'skill'
  | 'heal'
  | 'interact'
  | 'map'
  | 'pause';

export type Bindings = Record<BindAction, string[]>;

export const BIND_ORDER: BindAction[] = [
  'left',
  'right',
  'up',
  'down',
  'jump',
  'attack',
  'heavy',
  'dash',
  'parry',
  'skill',
  'heal',
  'interact',
  'map',
  'pause',
];

export const DEFAULT_BINDINGS: Bindings = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  jump: ['Space'],
  attack: ['KeyJ'],
  heavy: ['KeyK'],
  dash: ['KeyL', 'ShiftLeft', 'ShiftRight'],
  parry: ['KeyI'],
  skill: ['KeyU'],
  heal: ['KeyQ'],
  interact: ['KeyF', 'KeyE'],
  map: ['KeyM', 'Tab'],
  pause: ['Escape'],
};

const held = new Set<string>();
const edges = new Set<string>();
const touchHeld = new Set<BindAction>();
const touchEdges = new Set<BindAction>();

let listening: ((code: string) => void) | null = null;
let hooked = false;

export function keyLabel(code: string): string {
  if (code === 'Space') return '空格';
  if (code === 'Escape') return 'Esc';
  if (code === 'Tab') return 'Tab';
  if (code === 'ArrowLeft') return '←';
  if (code === 'ArrowRight') return '→';
  if (code === 'ArrowUp') return '↑';
  if (code === 'ArrowDown') return '↓';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export function hookInput(): void {
  if (hooked || typeof window === 'undefined') return;
  hooked = true;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (listening) {
      if (e.code === 'Escape') {
        const cb = listening;
        listening = null;
        cb('');
      } else if (!e.repeat) {
        const cb = listening;
        listening = null;
        cb(e.code);
      }
      return;
    }
    if (e.repeat) return;
    if (!held.has(e.code)) edges.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    touchHeld.clear();
  });
}

export function captureKey(cb: (code: string) => void): void {
  listening = cb;
}

export function isCapturing(): boolean {
  return listening !== null;
}

export function touchSet(action: BindAction, down: boolean): void {
  if (down) {
    if (!touchHeld.has(action)) touchEdges.add(action);
    touchHeld.add(action);
  } else touchHeld.delete(action);
}

function pad() {
  const list = navigator.getGamepads?.() ?? [];
  return list[0] && list[0].connected ? list[0] : null;
}

const prevPad = new Set<number>();

function padEdges(gamepad: Gamepad | null): Set<number> {
  const now = new Set<number>();
  const fresh = new Set<number>();
  if (!gamepad) {
    prevPad.clear();
    return fresh;
  }
  gamepad.buttons.forEach((b, i) => {
    if (!b.pressed) return;
    now.add(i);
    if (!prevPad.has(i)) fresh.add(i);
  });
  prevPad.clear();
  for (const i of now) prevPad.add(i);
  return fresh;
}

function bound(bindings: Bindings, action: BindAction, edge: boolean): boolean {
  if (touchEdges.has(action) && edge) return true;
  if (touchHeld.has(action) && !edge) return true;
  const codes = bindings[action];
  for (const code of codes) {
    if (edge ? edges.has(code) : held.has(code)) return true;
  }
  return false;
}

export interface Gathered {
  frame: FrameInput;
  confirm: boolean;
  cancel: boolean;
  pad: boolean;
}

export function gather(bindings: Bindings, consume = true): Gathered {
  const gamepad = pad();
  const fresh = padEdges(gamepad);
  const axisX = gamepad ? gamepad.axes[0] ?? 0 : 0;
  const axisY = gamepad ? gamepad.axes[1] ?? 0 : 0;
  const left = bound(bindings, 'left', false) || axisX < -0.4 || !!gamepad?.buttons[14]?.pressed;
  const right = bound(bindings, 'right', false) || axisX > 0.4 || !!gamepad?.buttons[15]?.pressed;
  const up = bound(bindings, 'up', false) || axisY < -0.5 || !!gamepad?.buttons[12]?.pressed;
  const down = bound(bindings, 'down', false) || axisY > 0.5 || !!gamepad?.buttons[13]?.pressed;
  const frame = blankInput();
  frame.x = (right ? 1 : 0) - (left ? 1 : 0);
  frame.y = (down ? 1 : 0) - (up ? 1 : 0);
  const edge = (action: BindAction, button: number) => bound(bindings, action, true) || fresh.has(button);
  const hold = (action: BindAction, button: number) => bound(bindings, action, false) || !!gamepad?.buttons[button]?.pressed;
  frame.jump = edge('jump', 0);
  frame.jumpHeld = hold('jump', 0);
  frame.attack = edge('attack', 2);
  frame.attackHeld = hold('attack', 2);
  frame.heavy = edge('heavy', 3);
  frame.heavyHeld = hold('heavy', 3);
  frame.dash = edge('dash', 1);
  frame.parry = edge('parry', 4);
  frame.skill = edge('skill', 5);
  frame.heal = edge('heal', 6);
  frame.interact = edge('interact', 7);
  frame.map = edge('map', 8);
  frame.pause = edge('pause', 9);
  frame.up = edge('up', 12);
  frame.down = edge('down', 13);
  frame.confirm = frame.jump || frame.attack || frame.interact || fresh.has(0);
  frame.cancel = frame.pause || fresh.has(1);
  const out: Gathered = {
    frame,
    confirm: frame.confirm,
    cancel: frame.cancel || fresh.has(1),
    pad: !!gamepad,
  };
  if (consume) {
    edges.clear();
    touchEdges.clear();
  }
  return out;
}

export function gatherHeld(bindings: Bindings): FrameInput {
  const got = gather(bindings, false);
  const frame = got.frame;
  frame.jump = false;
  frame.attack = false;
  frame.heavy = false;
  frame.dash = false;
  frame.parry = false;
  frame.skill = false;
  frame.heal = false;
  frame.interact = false;
  frame.map = false;
  frame.pause = false;
  frame.up = false;
  frame.down = false;
  frame.confirm = false;
  frame.cancel = false;
  return frame;
}
