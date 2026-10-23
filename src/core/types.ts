import type { Rect } from './math';

export type { Rect };

export type Dir = 'l' | 'r' | 'u' | 'd';
export type RoomType =
  | 'start'
  | 'combat'
  | 'elite'
  | 'treasure'
  | 'shop'
  | 'event'
  | 'rest'
  | 'secret'
  | 'boss';
export type BiomeId = 'ash' | 'molten' | 'sanctum';
export type WeaponId = 'sword' | 'hammer' | 'dagger';
export type CharacterId = 'wanderer' | 'dancer' | 'bulwark';
export type Rarity = 'common' | 'rare' | 'epic';

export type ActionName =
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

export interface FrameInput {
  x: number;
  y: number;
  jump: boolean;
  jumpHeld: boolean;
  attack: boolean;
  attackHeld: boolean;
  heavy: boolean;
  heavyHeld: boolean;
  dash: boolean;
  parry: boolean;
  skill: boolean;
  heal: boolean;
  interact: boolean;
  map: boolean;
  pause: boolean;
  up: boolean;
  down: boolean;
  confirm: boolean;
  cancel: boolean;
}

export const EDGE_KEYS = [
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
  'up',
  'down',
  'confirm',
  'cancel',
] as const;

export type EdgeKey = (typeof EDGE_KEYS)[number];

export function blankInput(): FrameInput {
  return {
    x: 0,
    y: 0,
    jump: false,
    jumpHeld: false,
    attack: false,
    attackHeld: false,
    heavy: false,
    heavyHeld: false,
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

export interface Prop {
  kind: 'chest' | 'shrine' | 'npc' | 'lore' | 'event' | 'portal';
  x: number;
  y: number;
}

export interface Spawn {
  kind: string;
  x: number;
  y: number;
}

export interface Room {
  id: string;
  gx: number;
  gy: number;
  type: RoomType;
  templateId: string;
  grid: string[][];
  w: number;
  h: number;
  doors: Partial<Record<Dir, string>>;
  secret: Partial<Record<Dir, boolean>>;
  secretOpen: boolean;
  explored: boolean;
  seen: boolean;
  cleared: boolean;
  locked: boolean;
  spawns: Spawn[];
  props: Prop[];
  upTile: number;
  downTile: number;
  eventId?: string;
}

export interface Floor {
  index: number;
  biome: BiomeId;
  rooms: Room[];
  startId: string;
  bossId: string;
}

export interface SimEvent {
  t: 'sfx' | 'float' | 'fx' | 'slash' | 'shake' | 'save' | 'phase';
  id?: string;
  x?: number;
  y?: number;
  text?: string;
  color?: string;
  kind?: string;
  facing?: 1 | -1;
  n?: number;
}

export type RunMode =
  | 'play'
  | 'reward'
  | 'shop'
  | 'event'
  | 'rest'
  | 'dialogue'
  | 'map'
  | 'pause'
  | 'settings'
  | 'dying'
  | 'dead'
  | 'victory';

export interface RectHit extends Rect {
  active?: boolean;
}
