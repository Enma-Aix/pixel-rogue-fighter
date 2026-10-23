import type { WeaponId } from '../core/types';

export interface Hitbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveDef {
  id: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  poise: number;
  hitstun: number;
  kbX: number;
  kbY: number;
  hitstop: number;
  energy: number;
  hitbox: Hitbox;
  lunge: number;
  launch?: boolean;
  plunge?: boolean;
  armor?: boolean;
  cancelAt: number;
  cancelEnd: number;
  cancelTo: string[];
  gravity?: number;
  air?: boolean;
  shockwave?: 'small' | 'big';
  multiEvery?: number;
  iStart?: number;
  iEnd?: number;
  vx?: number;
  endOnLand?: boolean;
  bounce?: number;
  special?: 'dash' | 'parry' | 'blink' | 'quake' | 'dashStrike';
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  desc: string;
  skillCost: number;
  speed: number;
  combo: string[];
  moves: Record<string, MoveDef>;
}

function mv(partial: MoveDef): MoveDef {
  return partial;
}

const sword: WeaponDef = {
  id: 'sword',
  name: '烬刃',
  desc: '均衡的三连斩，终结技把敌人送上天。',
  skillCost: 40,
  speed: 1,
  combo: ['l1', 'l2', 'l3'],
  moves: {
    l1: mv({
      id: 'l1', startup: 4, active: 3, recovery: 12,
      damage: 8, poise: 8, hitstun: 16, kbX: 2.3, kbY: 0, hitstop: 7, energy: 6,
      hitbox: { x: 6, y: -32, w: 32, h: 24 }, lunge: 1.7,
      cancelAt: 6, cancelEnd: 14, cancelTo: ['l2', 'dash', 'parry', 'skill'],
    }),
    l2: mv({
      id: 'l2', startup: 4, active: 3, recovery: 13,
      damage: 10, poise: 10, hitstun: 18, kbX: 2.6, kbY: -0.6, hitstop: 8, energy: 7,
      hitbox: { x: 4, y: -36, w: 36, h: 26 }, lunge: 1.5,
      cancelAt: 6, cancelEnd: 15, cancelTo: ['l3', 'dash', 'parry', 'skill'],
    }),
    l3: mv({
      id: 'l3', startup: 6, active: 4, recovery: 18,
      damage: 16, poise: 18, hitstun: 20, kbX: 1.6, kbY: -5.1, hitstop: 11, energy: 10,
      hitbox: { x: 2, y: -46, w: 34, h: 36 }, lunge: 1.1, launch: true,
      cancelAt: 10, cancelEnd: 20, cancelTo: ['dash', 'skill'],
    }),
    heavy: mv({
      id: 'heavy', startup: 10, active: 4, recovery: 20,
      damage: 20, poise: 24, hitstun: 20, kbX: 4.1, kbY: -1.8, hitstop: 11, energy: 8,
      hitbox: { x: 2, y: -38, w: 42, h: 28 }, lunge: 0.6,
      cancelAt: 16, cancelEnd: 24, cancelTo: ['dash'],
    }),
    heavyFull: mv({
      id: 'heavyFull', startup: 6, active: 5, recovery: 22,
      damage: 34, poise: 40, hitstun: 26, kbX: 5.2, kbY: -2.6, hitstop: 14, energy: 12,
      hitbox: { x: 0, y: -42, w: 50, h: 34 }, lunge: 0.4, armor: true, shockwave: 'small',
      cancelAt: 20, cancelEnd: 28, cancelTo: ['dash'],
    }),
    air: mv({
      id: 'air', startup: 4, active: 6, recovery: 10,
      damage: 11, poise: 8, hitstun: 12, kbX: 1.4, kbY: -0.6, hitstop: 5, energy: 6,
      hitbox: { x: 4, y: -34, w: 32, h: 26 }, lunge: 0.4, air: true, gravity: 0.85,
      cancelAt: 8, cancelEnd: 16, cancelTo: ['plunge', 'dash'],
    }),
    airHeavy: mv({
      id: 'airHeavy', startup: 7, active: 5, recovery: 12,
      damage: 18, poise: 16, hitstun: 16, kbX: 2.2, kbY: -2.2, hitstop: 7, energy: 8,
      hitbox: { x: 2, y: -40, w: 36, h: 30 }, lunge: 0.2, air: true, launch: true,
      cancelAt: 12, cancelEnd: 18, cancelTo: ['dash'],
    }),
    plunge: mv({
      id: 'plunge', startup: 4, active: 28, recovery: 6,
      damage: 18, poise: 18, hitstun: 16, kbX: 0.6, kbY: -2.4, hitstop: 8, energy: 8,
      hitbox: { x: -12, y: -8, w: 24, h: 20 }, lunge: 0, plunge: true, air: true,
      endOnLand: true, bounce: -4.3, gravity: 0,
      cancelAt: 99, cancelEnd: 99, cancelTo: [],
    }),
    skill: mv({
      id: 'skill', startup: 3, active: 8, recovery: 12,
      damage: 14, poise: 12, hitstun: 14, kbX: 2.4, kbY: -0.8, hitstop: 6, energy: 0,
      hitbox: { x: 0, y: -32, w: 40, h: 24 }, lunge: 0, vx: 5.7,
      iStart: 2, iEnd: 11, special: 'dashStrike', multiEvery: 4,
      cancelAt: 14, cancelEnd: 20, cancelTo: ['dash'],
    }),
  },
};

const hammer: WeaponDef = {
  id: 'hammer',
  name: '灰锤',
  desc: '慢，很重。蓄力重击能震开一条路。',
  skillCost: 46,
  speed: 0.9,
  combo: ['l1', 'l2', 'l3'],
  moves: {
    l1: mv({
      id: 'l1', startup: 7, active: 4, recovery: 16,
      damage: 14, poise: 18, hitstun: 18, kbX: 3.1, kbY: -0.8, hitstop: 8, energy: 7,
      hitbox: { x: 4, y: -34, w: 36, h: 28 }, lunge: 1.1,
      cancelAt: 10, cancelEnd: 20, cancelTo: ['l2', 'dash', 'parry', 'skill'],
    }),
    l2: mv({
      id: 'l2', startup: 8, active: 4, recovery: 17,
      damage: 16, poise: 18, hitstun: 17, kbX: 2.8, kbY: -0.8, hitstop: 7, energy: 8,
      hitbox: { x: 2, y: -38, w: 40, h: 30 }, lunge: 0.8,
      cancelAt: 11, cancelEnd: 22, cancelTo: ['l3', 'dash', 'parry', 'skill'],
    }),
    l3: mv({
      id: 'l3', startup: 10, active: 5, recovery: 22,
      damage: 24, poise: 28, hitstun: 20, kbX: 2.2, kbY: -4.2, hitstop: 10, energy: 12,
      hitbox: { x: 0, y: -44, w: 46, h: 36 }, lunge: 0.5, launch: true, shockwave: 'small',
      cancelAt: 16, cancelEnd: 28, cancelTo: ['dash'],
    }),
    heavy: mv({
      id: 'heavy', startup: 12, active: 5, recovery: 22,
      damage: 26, poise: 30, hitstun: 20, kbX: 3.8, kbY: -2, hitstop: 9, energy: 10,
      hitbox: { x: -2, y: -40, w: 50, h: 32 }, lunge: 0.3,
      cancelAt: 20, cancelEnd: 30, cancelTo: ['dash'],
    }),
    heavyFull: mv({
      id: 'heavyFull', startup: 8, active: 6, recovery: 24,
      damage: 42, poise: 48, hitstun: 28, kbX: 5, kbY: -2.8, hitstop: 12, energy: 14,
      hitbox: { x: -6, y: -46, w: 58, h: 40 }, lunge: 0.2, armor: true, shockwave: 'big',
      cancelAt: 22, cancelEnd: 32, cancelTo: ['dash'],
    }),
    air: mv({
      id: 'air', startup: 8, active: 5, recovery: 14,
      damage: 16, poise: 16, hitstun: 14, kbX: 2, kbY: -1.2, hitstop: 6, energy: 7,
      hitbox: { x: 2, y: -36, w: 38, h: 30 }, lunge: 0.2, air: true, gravity: 1.05,
      cancelAt: 12, cancelEnd: 20, cancelTo: ['plunge', 'dash'],
    }),
    airHeavy: mv({
      id: 'airHeavy', startup: 11, active: 6, recovery: 16,
      damage: 26, poise: 26, hitstun: 18, kbX: 2.4, kbY: -2.6, hitstop: 9, energy: 9,
      hitbox: { x: -4, y: -42, w: 44, h: 36 }, lunge: 0, air: true, launch: true, shockwave: 'small',
      cancelAt: 16, cancelEnd: 24, cancelTo: ['dash'],
    }),
    plunge: mv({
      id: 'plunge', startup: 6, active: 30, recovery: 10,
      damage: 30, poise: 30, hitstun: 22, kbX: 1, kbY: -2.2, hitstop: 11, energy: 10,
      hitbox: { x: -16, y: -10, w: 32, h: 22 }, lunge: 0, plunge: true, air: true,
      endOnLand: true, bounce: -3.6, shockwave: 'big', gravity: 0,
      cancelAt: 99, cancelEnd: 99, cancelTo: [],
    }),
    skill: mv({
      id: 'skill', startup: 10, active: 6, recovery: 20,
      damage: 22, poise: 26, hitstun: 20, kbX: 3.4, kbY: -1.5, hitstop: 10, energy: 0,
      hitbox: { x: -20, y: -28, w: 40, h: 24 }, lunge: 0, armor: true, shockwave: 'big',
      special: 'quake',
      cancelAt: 20, cancelEnd: 30, cancelTo: ['dash'],
    }),
  },
};

const dagger: WeaponDef = {
  id: 'dagger',
  name: '双匕',
  desc: '四段快斩，擅长把人留在空中。',
  skillCost: 34,
  speed: 1.08,
  combo: ['l1', 'l2', 'l3', 'l4'],
  moves: {
    l1: mv({
      id: 'l1', startup: 3, active: 2, recovery: 8,
      damage: 5, poise: 4, hitstun: 11, kbX: 1.3, kbY: 0, hitstop: 5, energy: 4,
      hitbox: { x: 8, y: -30, w: 26, h: 18 }, lunge: 2.1,
      cancelAt: 4, cancelEnd: 10, cancelTo: ['l2', 'dash', 'parry', 'skill'],
    }),
    l2: mv({
      id: 'l2', startup: 3, active: 2, recovery: 8,
      damage: 6, poise: 5, hitstun: 10, kbX: 1.2, kbY: -0.2, hitstop: 3, energy: 4,
      hitbox: { x: 6, y: -32, w: 28, h: 20 }, lunge: 2,
      cancelAt: 4, cancelEnd: 10, cancelTo: ['l3', 'dash', 'parry', 'skill'],
    }),
    l3: mv({
      id: 'l3', startup: 3, active: 2, recovery: 9,
      damage: 6, poise: 5, hitstun: 11, kbX: 1.2, kbY: -0.8, hitstop: 3, energy: 5,
      hitbox: { x: 6, y: -36, w: 28, h: 24 }, lunge: 1.8,
      cancelAt: 4, cancelEnd: 11, cancelTo: ['l4', 'dash', 'parry', 'skill'],
    }),
    l4: mv({
      id: 'l4', startup: 4, active: 8, recovery: 14,
      damage: 5, poise: 4, hitstun: 14, kbX: 1.1, kbY: -4.2, hitstop: 8, energy: 8,
      hitbox: { x: 4, y: -40, w: 30, h: 32 }, lunge: 1.2, launch: true, multiEvery: 3,
      cancelAt: 12, cancelEnd: 20, cancelTo: ['dash', 'skill'],
    }),
    heavy: mv({
      id: 'heavy', startup: 6, active: 3, recovery: 14,
      damage: 12, poise: 10, hitstun: 14, kbX: 2.4, kbY: -1, hitstop: 5, energy: 6,
      hitbox: { x: 4, y: -34, w: 34, h: 22 }, lunge: 2.4,
      cancelAt: 10, cancelEnd: 18, cancelTo: ['dash'],
    }),
    heavyFull: mv({
      id: 'heavyFull', startup: 4, active: 6, recovery: 16,
      damage: 18, poise: 16, hitstun: 16, kbX: 3, kbY: -2.4, hitstop: 7, energy: 8,
      hitbox: { x: 2, y: -38, w: 40, h: 30 }, lunge: 2.8, launch: true,
      cancelAt: 12, cancelEnd: 20, cancelTo: ['dash'],
    }),
    air: mv({
      id: 'air', startup: 2, active: 8, recovery: 8,
      damage: 5, poise: 4, hitstun: 10, kbX: 0.6, kbY: -3.4, hitstop: 3, energy: 5,
      hitbox: { x: 2, y: -42, w: 24, h: 28 }, lunge: 0.3, air: true, launch: true, multiEvery: 3, gravity: 0.55,
      cancelAt: 8, cancelEnd: 14, cancelTo: ['plunge', 'dash'],
    }),
    airHeavy: mv({
      id: 'airHeavy', startup: 4, active: 6, recovery: 10,
      damage: 9, poise: 8, hitstun: 12, kbX: 1.6, kbY: -2.8, hitstop: 5, energy: 6,
      hitbox: { x: 0, y: -36, w: 32, h: 28 }, lunge: 0.4, air: true, launch: true,
      cancelAt: 10, cancelEnd: 16, cancelTo: ['dash'],
    }),
    plunge: mv({
      id: 'plunge', startup: 3, active: 26, recovery: 6,
      damage: 12, poise: 10, hitstun: 12, kbX: 0.4, kbY: -3.2, hitstop: 5, energy: 6,
      hitbox: { x: -10, y: -8, w: 20, h: 16 }, lunge: 0, plunge: true, air: true,
      endOnLand: true, bounce: -4.8, gravity: 0,
      cancelAt: 99, cancelEnd: 99, cancelTo: [],
    }),
    skill: mv({
      id: 'skill', startup: 2, active: 6, recovery: 12,
      damage: 16, poise: 12, hitstun: 16, kbX: 1.5, kbY: -1.2, hitstop: 6, energy: 0,
      hitbox: { x: -8, y: -34, w: 36, h: 28 }, lunge: 0, special: 'blink', iStart: 1, iEnd: 8,
      cancelAt: 10, cancelEnd: 16, cancelTo: ['dash', 'l1'],
    }),
  },
};

export const WEAPONS: Record<WeaponId, WeaponDef> = { sword, hammer, dagger };

export const COMMON_MOVES: Record<string, MoveDef> = {
  dash: mv({
    id: 'dash', startup: 1, active: 10, recovery: 3,
    damage: 0, poise: 0, hitstun: 10, kbX: 1.4, kbY: 0, hitstop: 3, energy: 0,
    hitbox: { x: 0, y: -28, w: 28, h: 24 }, lunge: 0, vx: 5.6,
    iStart: 2, iEnd: 10, special: 'dash',
    cancelAt: 11, cancelEnd: 13, cancelTo: ['l1', 'air', 'skill'],
  }),
  parry: mv({
    id: 'parry', startup: 2, active: 6, recovery: 16,
    damage: 0, poise: 0, hitstun: 0, kbX: 0, kbY: 0, hitstop: 8, energy: 0,
    hitbox: { x: -10, y: -36, w: 28, h: 36 }, lunge: 0, special: 'parry',
    cancelAt: 8, cancelEnd: 16, cancelTo: ['l1', 'heavy', 'skill', 'dash'],
  }),
};

export function moveLength(m: MoveDef): number {
  return m.startup + m.active + m.recovery;
}

export function isActiveFrame(m: MoveDef, frame: number): boolean {
  return frame >= m.startup && frame < m.startup + m.active;
}

export function getMove(weapon: WeaponId, id: string): MoveDef {
  if (id === 'dash' || id === 'parry') return COMMON_MOVES[id]!;
  const found = WEAPONS[weapon].moves[id];
  if (!found) throw new Error(`missing move ${weapon}:${id}`);
  return found;
}

export function nextCombo(weapon: WeaponId, id: string): string | null {
  const combo = WEAPONS[weapon].combo;
  const i = combo.indexOf(id);
  if (i < 0 || i >= combo.length - 1) return null;
  return combo[i + 1] ?? null;
}
