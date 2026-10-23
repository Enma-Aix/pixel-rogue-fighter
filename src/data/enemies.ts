export type Behavior =
  | 'melee'
  | 'ranged'
  | 'leap'
  | 'fly'
  | 'brute'
  | 'mage'
  | 'phantom'
  | 'boss'
  | 'dummy';

export type Flinch = 'always' | 'poise';

export interface ProjSpec {
  kind: string;
  speed: number;
  count: number;
  spread: number;
  life: number;
  damage: number;
  pattern: 'aim' | 'fan' | 'ring' | 'ground' | 'both' | 'zone';
  w: number;
  h: number;
  gravity?: number;
  tick?: number;
}

export interface AttackDef {
  id: string;
  telegraph: number;
  active: number;
  recovery: number;
  damage: number;
  poise: number;
  hitstun: number;
  kbX: number;
  kbY: number;
  hitstop: number;
  reach: number;
  y: number;
  h: number;
  xOff?: number;
  cooldown: number;
  weight: number;
  interruptible: boolean;
  armor: boolean;
  rangeMin: number;
  rangeMax: number;
  minPhase?: number;
  leap?: { vx: number; vy: number };
  teleport?: boolean;
  projectile?: ProjSpec;
  shockwave?: boolean;
  selfMove?: number;
  summon?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  poise: number;
  speed: number;
  w: number;
  h: number;
  contact: number;
  gold: number;
  behavior: Behavior;
  flinch: Flinch;
  fly?: boolean;
  elite?: boolean;
  boss?: boolean;
  attacks: AttackDef[];
}

function atk(a: AttackDef): AttackDef {
  return a;
}

export const ENEMIES: Record<string, EnemyDef> = {
  guard: {
    id: 'guard', name: '灰卫', hp: 48, poise: 14, speed: 0.82, w: 16, h: 30,
    contact: 7, gold: 5, behavior: 'melee', flinch: 'always',
    attacks: [
      atk({ id: 'slash', telegraph: 30, active: 7, recovery: 28, damage: 11, poise: 10, hitstun: 14, kbX: 2.4, kbY: -1.2, hitstop: 4, reach: 36, y: -30, h: 22, cooldown: 46, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 54 }),
      atk({ id: 'step', telegraph: 16, active: 10, recovery: 18, damage: 8, poise: 8, hitstun: 12, kbX: 2, kbY: 0, hitstop: 3, reach: 30, y: -26, h: 18, cooldown: 36, weight: 1, interruptible: true, armor: true, rangeMin: 40, rangeMax: 120, selfMove: 1.7 }),
    ],
  },
  archer: {
    id: 'archer', name: '烬弓手', hp: 34, poise: 8, speed: 0.7, w: 14, h: 28,
    contact: 5, gold: 5, behavior: 'ranged', flinch: 'always',
    attacks: [
      atk({ id: 'shot', telegraph: 36, active: 6, recovery: 32, damage: 9, poise: 6, hitstun: 12, kbX: 1.6, kbY: -0.4, hitstop: 3, reach: 10, y: -24, h: 8, cooldown: 70, weight: 4, interruptible: true, armor: false, rangeMin: 70, rangeMax: 320, projectile: { kind: 'arrow', speed: 3.5, count: 1, spread: 0, life: 90, damage: 9, pattern: 'aim', w: 14, h: 6 } }),
      atk({ id: 'kick', telegraph: 16, active: 6, recovery: 18, damage: 7, poise: 6, hitstun: 12, kbX: 2.6, kbY: -0.6, hitstop: 3, reach: 26, y: -22, h: 16, cooldown: 40, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 42 }),
    ],
  },
  crawler: {
    id: 'crawler', name: '爬骸', hp: 30, poise: 6, speed: 1.2, w: 22, h: 14,
    contact: 6, gold: 4, behavior: 'leap', flinch: 'always',
    attacks: [
      atk({ id: 'pounce', telegraph: 20, active: 14, recovery: 24, damage: 9, poise: 8, hitstun: 12, kbX: 2.2, kbY: -1.4, hitstop: 4, reach: 22, y: -16, h: 14, cooldown: 52, weight: 3, interruptible: true, armor: true, rangeMin: 28, rangeMax: 170, leap: { vx: 3.5, vy: -3.8 } }),
      atk({ id: 'bite', telegraph: 12, active: 6, recovery: 16, damage: 7, poise: 6, hitstun: 10, kbX: 1.4, kbY: 0, hitstop: 3, reach: 20, y: -14, h: 12, cooldown: 28, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 28 }),
    ],
  },
  knight: {
    id: 'knight', name: '烬骑士', hp: 130, poise: 40, speed: 0.68, w: 20, h: 36,
    contact: 10, gold: 22, behavior: 'melee', flinch: 'poise', elite: true,
    attacks: [
      atk({ id: 'combo', telegraph: 28, active: 8, recovery: 22, damage: 13, poise: 12, hitstun: 14, kbX: 2.2, kbY: -0.8, hitstop: 5, reach: 42, y: -34, h: 24, cooldown: 40, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 60 }),
      atk({ id: 'bash', telegraph: 36, active: 8, recovery: 34, damage: 16, poise: 18, hitstun: 18, kbX: 3.6, kbY: -1.4, hitstop: 6, reach: 36, y: -32, h: 22, cooldown: 70, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 70, selfMove: 1.4 }),
      atk({ id: 'slam', telegraph: 44, active: 10, recovery: 42, damage: 18, poise: 20, hitstun: 20, kbX: 2.8, kbY: -2.2, hitstop: 8, reach: 50, y: -28, h: 24, cooldown: 90, weight: 1, interruptible: true, armor: true, rangeMin: 0, rangeMax: 90, shockwave: true }),
    ],
  },
  slag: {
    id: 'slag', name: '熔渣兽', hp: 72, poise: 24, speed: 0.55, w: 26, h: 32,
    contact: 9, gold: 7, behavior: 'brute', flinch: 'poise',
    attacks: [
      atk({ id: 'smash', telegraph: 40, active: 10, recovery: 36, damage: 16, poise: 16, hitstun: 18, kbX: 3, kbY: -1.8, hitstop: 7, reach: 42, y: -30, h: 24, cooldown: 64, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 70, shockwave: true }),
      atk({ id: 'sweep', telegraph: 26, active: 12, recovery: 26, damage: 12, poise: 12, hitstun: 14, kbX: 2.6, kbY: -0.4, hitstop: 5, reach: 48, y: -24, h: 18, cooldown: 48, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 80, selfMove: 0.7 }),
    ],
  },
  flea: {
    id: 'flea', name: '火跳蚤', hp: 18, poise: 4, speed: 1.35, w: 12, h: 12,
    contact: 5, gold: 3, behavior: 'leap', flinch: 'always',
    attacks: [
      atk({ id: 'hop', telegraph: 14, active: 16, recovery: 14, damage: 7, poise: 4, hitstun: 10, kbX: 1.6, kbY: -1, hitstop: 3, reach: 16, y: -14, h: 12, cooldown: 36, weight: 1, interruptible: true, armor: false, rangeMin: 0, rangeMax: 180, leap: { vx: 2.8, vy: -4.3 } }),
    ],
  },
  bat: {
    id: 'bat', name: '烬蝠', hp: 24, poise: 4, speed: 1.25, w: 18, h: 12,
    contact: 6, gold: 4, behavior: 'fly', flinch: 'always', fly: true,
    attacks: [
      atk({ id: 'dive', telegraph: 24, active: 16, recovery: 26, damage: 8, poise: 6, hitstun: 12, kbX: 1.8, kbY: 0.4, hitstop: 4, reach: 18, y: -14, h: 14, cooldown: 56, weight: 1, interruptible: true, armor: true, rangeMin: 0, rangeMax: 280, leap: { vx: 3.2, vy: 2.4 } }),
    ],
  },
  eliteBrute: {
    id: 'eliteBrute', name: '熔核卫士', hp: 160, poise: 52, speed: 0.5, w: 32, h: 38,
    contact: 12, gold: 24, behavior: 'brute', flinch: 'poise', elite: true,
    attacks: [
      atk({ id: 'quake', telegraph: 46, active: 12, recovery: 44, damage: 18, poise: 20, hitstun: 22, kbX: 3.4, kbY: -2, hitstop: 9, reach: 56, y: -32, h: 26, cooldown: 80, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 100, shockwave: true }),
      atk({ id: 'charge', telegraph: 30, active: 18, recovery: 30, damage: 15, poise: 14, hitstun: 16, kbX: 3.8, kbY: -0.6, hitstop: 6, reach: 32, y: -30, h: 22, cooldown: 70, weight: 2, interruptible: true, armor: true, rangeMin: 40, rangeMax: 240, selfMove: 2.5 }),
    ],
  },
  phantom: {
    id: 'phantom', name: '幻影剑士', hp: 42, poise: 10, speed: 1.15, w: 14, h: 30,
    contact: 7, gold: 6, behavior: 'phantom', flinch: 'always',
    attacks: [
      atk({ id: 'blink', telegraph: 26, active: 8, recovery: 22, damage: 11, poise: 8, hitstun: 14, kbX: 2, kbY: -0.8, hitstop: 5, reach: 32, y: -30, h: 22, cooldown: 62, weight: 3, interruptible: true, armor: true, rangeMin: 50, rangeMax: 280, teleport: true }),
      atk({ id: 'slash', telegraph: 16, active: 6, recovery: 16, damage: 9, poise: 7, hitstun: 12, kbX: 1.6, kbY: 0, hitstop: 3, reach: 32, y: -30, h: 20, cooldown: 32, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 48 }),
    ],
  },
  mage: {
    id: 'mage', name: '咒灰法师', hp: 38, poise: 8, speed: 0.58, w: 14, h: 30,
    contact: 5, gold: 6, behavior: 'mage', flinch: 'always',
    attacks: [
      atk({ id: 'fan', telegraph: 32, active: 8, recovery: 28, damage: 8, poise: 6, hitstun: 10, kbX: 1.2, kbY: -0.3, hitstop: 3, reach: 8, y: -28, h: 8, cooldown: 64, weight: 3, interruptible: true, armor: false, rangeMin: 40, rangeMax: 300, projectile: { kind: 'bolt', speed: 2.8, count: 3, spread: 0.7, life: 100, damage: 8, pattern: 'fan', w: 10, h: 10 } }),
      atk({ id: 'zone', telegraph: 38, active: 8, recovery: 30, damage: 8, poise: 6, hitstun: 8, kbX: 0.4, kbY: 0, hitstop: 3, reach: 8, y: -8, h: 8, cooldown: 90, weight: 2, interruptible: true, armor: false, rangeMin: 0, rangeMax: 260, projectile: { kind: 'zone', speed: 0, count: 1, spread: 0, life: 110, damage: 8, pattern: 'zone', w: 36, h: 16, tick: 18 } }),
    ],
  },
  sentinel: {
    id: 'sentinel', name: '圣殿守卫', hp: 64, poise: 26, speed: 0.62, w: 18, h: 34,
    contact: 8, gold: 7, behavior: 'melee', flinch: 'poise',
    attacks: [
      atk({ id: 'thrust', telegraph: 26, active: 8, recovery: 24, damage: 13, poise: 12, hitstun: 14, kbX: 2.4, kbY: -0.4, hitstop: 5, reach: 48, y: -30, h: 16, cooldown: 48, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 70 }),
      atk({ id: 'arc', telegraph: 34, active: 10, recovery: 30, damage: 12, poise: 12, hitstun: 14, kbX: 2, kbY: -1, hitstop: 5, reach: 40, y: -40, h: 34, cooldown: 60, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 60 }),
    ],
  },
  sentinelElite: {
    id: 'sentinelElite', name: '双生残影', hp: 150, poise: 46, speed: 0.95, w: 16, h: 32,
    contact: 10, gold: 24, behavior: 'phantom', flinch: 'poise', elite: true,
    attacks: [
      atk({ id: 'blink', telegraph: 22, active: 7, recovery: 20, damage: 13, poise: 10, hitstun: 14, kbX: 2.2, kbY: -1, hitstop: 5, reach: 34, y: -32, h: 22, cooldown: 50, weight: 3, interruptible: true, armor: true, rangeMin: 36, rangeMax: 260, teleport: true }),
      atk({ id: 'flurry', telegraph: 18, active: 12, recovery: 24, damage: 8, poise: 6, hitstun: 10, kbX: 1.2, kbY: -0.4, hitstop: 3, reach: 34, y: -32, h: 24, cooldown: 40, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 50, selfMove: 0.8 }),
      atk({ id: 'cross', telegraph: 36, active: 8, recovery: 34, damage: 16, poise: 16, hitstun: 18, kbX: 3, kbY: -2, hitstop: 7, reach: 46, y: -40, h: 36, cooldown: 80, weight: 1, interruptible: true, armor: true, rangeMin: 0, rangeMax: 80 }),
    ],
  },
  boss1: {
    id: 'boss1', name: '烬卫将军', hp: 300, poise: 64, speed: 0.72, w: 28, h: 48,
    contact: 12, gold: 48, behavior: 'boss', flinch: 'poise', boss: true,
    attacks: [
      atk({ id: 'slash', telegraph: 34, active: 8, recovery: 40, damage: 14, poise: 12, hitstun: 16, kbX: 2.8, kbY: -1.4, hitstop: 5, reach: 50, y: -44, h: 28, cooldown: 36, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 78, minPhase: 1 }),
      atk({ id: 'leap', telegraph: 44, active: 12, recovery: 46, damage: 16, poise: 14, hitstun: 18, kbX: 3, kbY: -2, hitstop: 8, reach: 44, y: -36, h: 28, cooldown: 80, weight: 2, interruptible: true, armor: true, rangeMin: 40, rangeMax: 320, leap: { vx: 2.4, vy: -4.6 }, minPhase: 1 }),
      atk({ id: 'summon', telegraph: 48, active: 8, recovery: 36, damage: 0, poise: 0, hitstun: 0, kbX: 0, kbY: 0, hitstop: 4, reach: 10, y: -20, h: 10, cooldown: 180, weight: 1, interruptible: true, armor: false, rangeMin: 0, rangeMax: 999, summon: 'guard', minPhase: 1 }),
      atk({ id: 'wave', telegraph: 36, active: 10, recovery: 40, damage: 12, poise: 10, hitstun: 14, kbX: 2.2, kbY: -0.6, hitstop: 5, reach: 20, y: -16, h: 16, cooldown: 70, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 999, projectile: { kind: 'wave', speed: 3.1, count: 2, spread: 0, life: 70, damage: 12, pattern: 'both', w: 22, h: 16 }, minPhase: 2 }),
      atk({ id: 'dashstrike', telegraph: 24, active: 14, recovery: 42, damage: 16, poise: 14, hitstun: 18, kbX: 3.6, kbY: -1.2, hitstop: 7, reach: 40, y: -40, h: 26, cooldown: 64, weight: 3, interruptible: false, armor: true, rangeMin: 30, rangeMax: 280, selfMove: 3.3, minPhase: 2 }),
    ],
  },
  boss2: {
    id: 'boss2', name: '熔核巨像', hp: 380, poise: 90, speed: 0.42, w: 52, h: 58,
    contact: 14, gold: 56, behavior: 'boss', flinch: 'poise', boss: true,
    attacks: [
      atk({ id: 'slam', telegraph: 50, active: 12, recovery: 48, damage: 18, poise: 18, hitstun: 20, kbX: 3.4, kbY: -2.2, hitstop: 10, reach: 64, y: -30, h: 28, cooldown: 70, weight: 3, interruptible: true, armor: true, rangeMin: 0, rangeMax: 120, shockwave: true, minPhase: 1 }),
      atk({ id: 'drip', telegraph: 42, active: 10, recovery: 36, damage: 11, poise: 8, hitstun: 12, kbX: 0.6, kbY: 0, hitstop: 4, reach: 10, y: -10, h: 10, cooldown: 80, weight: 2, interruptible: true, armor: false, rangeMin: 0, rangeMax: 999, projectile: { kind: 'zone', speed: 0, count: 3, spread: 0, life: 100, damage: 11, pattern: 'zone', w: 40, h: 18, tick: 16 }, minPhase: 1 }),
      atk({ id: 'sweep', telegraph: 32, active: 14, recovery: 40, damage: 15, poise: 14, hitstun: 16, kbX: 3.2, kbY: -0.8, hitstop: 6, reach: 74, y: -36, h: 28, cooldown: 60, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 110, selfMove: 0.55, minPhase: 1 }),
      atk({ id: 'ring', telegraph: 40, active: 12, recovery: 44, damage: 13, poise: 10, hitstun: 14, kbX: 2, kbY: -0.4, hitstop: 6, reach: 10, y: -20, h: 10, cooldown: 90, weight: 3, interruptible: false, armor: true, rangeMin: 0, rangeMax: 999, projectile: { kind: 'ring', speed: 2.4, count: 8, spread: 0, life: 80, damage: 13, pattern: 'ring', w: 12, h: 12 }, minPhase: 2 }),
    ],
  },
  boss3: {
    id: 'boss3', name: '终烬之主', hp: 340, poise: 58, speed: 0.98, w: 22, h: 52,
    contact: 12, gold: 70, behavior: 'boss', flinch: 'poise', boss: true,
    attacks: [
      atk({ id: 'tp', telegraph: 28, active: 8, recovery: 34, damage: 14, poise: 12, hitstun: 16, kbX: 2.4, kbY: -1.2, hitstop: 6, reach: 40, y: -46, h: 28, cooldown: 48, weight: 3, interruptible: true, armor: true, rangeMin: 20, rangeMax: 360, teleport: true, minPhase: 1 }),
      atk({ id: 'fan', telegraph: 32, active: 8, recovery: 32, damage: 10, poise: 8, hitstun: 12, kbX: 1.4, kbY: -0.4, hitstop: 4, reach: 8, y: -30, h: 8, cooldown: 56, weight: 2, interruptible: true, armor: false, rangeMin: 0, rangeMax: 999, projectile: { kind: 'bolt', speed: 3, count: 3, spread: 0.8, life: 90, damage: 10, pattern: 'fan', w: 10, h: 10 }, minPhase: 1 }),
      atk({ id: 'combo', telegraph: 20, active: 8, recovery: 26, damage: 12, poise: 10, hitstun: 12, kbX: 1.8, kbY: -0.6, hitstop: 4, reach: 42, y: -44, h: 30, cooldown: 30, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 60, minPhase: 1 }),
      atk({ id: 'ring', telegraph: 36, active: 10, recovery: 40, damage: 12, poise: 8, hitstun: 12, kbX: 1.6, kbY: 0, hitstop: 5, reach: 8, y: -20, h: 8, cooldown: 80, weight: 2, interruptible: true, armor: true, rangeMin: 0, rangeMax: 999, projectile: { kind: 'ring', speed: 2.2, count: 10, spread: 0, life: 90, damage: 12, pattern: 'ring', w: 10, h: 10 }, minPhase: 2 }),
      atk({ id: 'rush', telegraph: 18, active: 12, recovery: 36, damage: 15, poise: 12, hitstun: 16, kbX: 3.2, kbY: -1, hitstop: 6, reach: 36, y: -44, h: 26, cooldown: 50, weight: 2, interruptible: false, armor: true, rangeMin: 24, rangeMax: 260, selfMove: 3.6, minPhase: 2 }),
      atk({ id: 'nova', telegraph: 52, active: 16, recovery: 56, damage: 16, poise: 12, hitstun: 16, kbX: 2.4, kbY: -1.6, hitstop: 8, reach: 8, y: -20, h: 8, cooldown: 120, weight: 2, interruptible: false, armor: true, rangeMin: 0, rangeMax: 999, projectile: { kind: 'nova', speed: 2.6, count: 12, spread: 0, life: 80, damage: 16, pattern: 'ring', w: 12, h: 12 }, minPhase: 3 }),
    ],
  },
  dummy: {
    id: 'dummy', name: '木桩', hp: 9999, poise: 8, speed: 0, w: 16, h: 30,
    contact: 0, gold: 0, behavior: 'dummy', flinch: 'always',
    attacks: [
      atk({ id: 'swipe', telegraph: 40, active: 10, recovery: 36, damage: 8, poise: 6, hitstun: 12, kbX: 2, kbY: -0.8, hitstop: 4, reach: 36, y: -30, h: 20, cooldown: 70, weight: 1, interruptible: true, armor: false, rangeMin: 0, rangeMax: 80 }),
    ],
  },
};

export function enemyDef(id: string): EnemyDef {
  const d = ENEMIES[id];
  if (!d) throw new Error(`missing enemy ${id}`);
  return d;
}
