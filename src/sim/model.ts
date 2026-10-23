import type { AttackDef } from '../data/enemies';
import type { MoveDef } from '../data/weapons';
import type {
  CharacterId,
  EdgeKey,
  Floor,
  FrameInput,
  Rect,
  RunMode,
  SimEvent,
  WeaponId,
} from '../core/types';

export interface Action {
  id: string;
  frame: number;
  serial: number;
  hit: number[];
  riposte: boolean;
  empowered: boolean;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  state: string;
  frame: number;
  grounded: boolean;
  coyote: number;
  jumpBuf: number;
  jumpCut: boolean;
  invuln: number;
  iFrame: boolean;
  armor: boolean;
  stun: number;
  action: Action | null;
  charge: number;
  charging: boolean;
  atkBuf: number;
  dashBuf: number;
  dashCharges: number;
  dashRegen: number;
  airOk: boolean;
  dropTimer: number;
  riposte: number;
  hitCancel: number;
  hazardCd: number;
  anim: string;
  animFrame: number;
  landTick: number;
  hitThisFrame: boolean;
  empowered: number;
}

export interface EnemyAttack {
  id: string;
  frame: number;
  def: AttackDef;
  hitPlayer: boolean;
  facing: 1 | -1;
  destX: number;
  destY: number;
  serial: number;
  parried: boolean;
  dodged: boolean;
}

export interface Enemy {
  eid: number;
  kind: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  poise: number;
  poiseMax: number;
  poiseRecover: number;
  grounded: boolean;
  alive: boolean;
  fly: boolean;
  elite: boolean;
  boss: boolean;
  flinch: 'always' | 'poise';
  stun: number;
  flash: number;
  invuln: number;
  juggle: number;
  cd: number;
  atkCd: Record<string, number>;
  attack: EnemyAttack | null;
  contact: number;
  contactCd: number;
  dmgScale: number;
  phase: number;
  didP2: boolean;
  didP3: boolean;
  summoned: boolean;
  frame: number;
  anim: string;
  animFrame: number;
  deadTimer: number;
  homeY: number;
  gold: number;
  behavior: string;
  speed: number;
  hitByPlayer: boolean;
}

export interface Proj {
  id: number;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  damage: number;
  team: 'player' | 'enemy';
  life: number;
  poise: number;
  kbX: number;
  kbY: number;
  hitstop: number;
  hit: number[];
  tick: number;
  tickCd: number;
  gravity: number;
  ground: boolean;
  owner: number;
}

export interface Tele {
  x: number;
  y: number;
  w: number;
  h: number;
  life: number;
  max: number;
  kind: 'rect' | 'circle';
}

export interface ShopItem {
  kind: 'relic' | 'heal' | 'flask';
  relicId?: string;
  price: number;
  name: string;
  desc: string;
}

export interface RewardChoice {
  id: string;
  name: string;
  desc: string;
  rarity: string;
}

export interface Dialogue {
  title: string;
  body: string;
}

export type EdgeBuf = Record<EdgeKey, boolean>;

export interface Run {
  seed: number;
  character: CharacterId;
  weapon: WeaponId;
  arsenal: WeaponId[];
  floors: Floor[];
  floorIndex: number;
  roomId: string;
  player: Player;
  enemies: Enemy[];
  projectiles: Proj[];
  telegraphs: Tele[];
  events: SimEvent[];
  mode: RunMode;
  relics: string[];
  gold: number;
  flasks: number;
  flaskMax: number;
  energy: number;
  energyMax: number;
  energyRegen: number;
  regenBonus: number;
  dashMax: number;
  baseDash: number;
  attackBonus: number;
  charDmg: number;
  charSpeed: number;
  charDr: number;
  baseMaxHp: number;
  lastStandUsed: boolean;
  curseNext: boolean;
  gate: number;
  hitstop: number;
  shake: number;
  combo: number;
  comboTimer: number;
  buf: EdgeBuf;
  rewardTaken: string[];
  opened: string[];
  shopSold: string[];
  reward: { title: string; choices: RewardChoice[] } | null;
  shop: ShopItem[] | null;
  dialogue: Dialogue | null;
  stats: { kills: number; rooms: number; maxCombo: number; bosses: number; frames: number };
  deathTimer: number;
  tutorial: boolean;
  tutStep: number;
  tutFlags: Record<string, boolean>;
  tutStartX: number;
  lastHit: string;
  serial: number;
  nextEid: number;
  nextPid: number;
  roomRevision: number;
  interactPrompt: string;
  time: number;
  introFloor: number;
  banked: boolean;
  coresGained: number;
  victory: boolean;
  followups: Array<{ delay: number; damage: number; x: number; y: number; facing: 1 | -1; w: number; h: number }>;
  menuIndex: number;
}

export interface PendingMove {
  move: MoveDef;
  box: Rect;
}

export function blankEdges(): EdgeBuf {
  return {
    jump: false,
    attack: false,
    heavy: false,
    dash: false,
    parry: false,
    skill: false,
    heal: false,
    interact: false,
    map: false,
    pause: false,
    up: false,
    down: false,
    confirm: false,
    cancel: false,
  };
}

export function mergeInput(input: FrameInput, buf: EdgeBuf): FrameInput {
  return {
    ...input,
    jump: input.jump || buf.jump,
    attack: input.attack || buf.attack,
    heavy: input.heavy || buf.heavy,
    dash: input.dash || buf.dash,
    parry: input.parry || buf.parry,
    skill: input.skill || buf.skill,
    heal: input.heal || buf.heal,
    interact: input.interact || buf.interact,
    map: input.map || buf.map,
    pause: input.pause || buf.pause,
    up: input.up || buf.up,
    down: input.down || buf.down,
    confirm: input.confirm || buf.confirm,
    cancel: input.cancel || buf.cancel,
  };
}

export function latchEdges(buf: EdgeBuf, input: FrameInput): void {
  buf.jump = buf.jump || input.jump;
  buf.attack = buf.attack || input.attack;
  buf.heavy = buf.heavy || input.heavy;
  buf.dash = buf.dash || input.dash;
  buf.parry = buf.parry || input.parry;
  buf.skill = buf.skill || input.skill;
  buf.heal = buf.heal || input.heal;
  buf.interact = buf.interact || input.interact;
  buf.map = buf.map || input.map;
  buf.pause = buf.pause || input.pause;
  buf.up = buf.up || input.up;
  buf.down = buf.down || input.down;
  buf.confirm = buf.confirm || input.confirm;
  buf.cancel = buf.cancel || input.cancel;
}
