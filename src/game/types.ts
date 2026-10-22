export type EnemyKind = "grunt" | "archer" | "brute" | "boss";
export type MetaId = "hp" | "atk" | "agi" | "special" | "greed";
export type UpgradeId =
  | "dmg"
  | "vamp"
  | "vital"
  | "dash"
  | "haste"
  | "art"
  | "heavy"
  | "combo"
  | "crit"
  | "guard"
  | "twin"
  | "shock";

export type Sfx =
  | "swing"
  | "hit"
  | "hurt"
  | "jump"
  | "dash"
  | "special"
  | "coin"
  | "ui"
  | "death"
  | "win"
  | "slam"
  | "arrow"
  | "boss";

export type EndMode = "win" | "dead" | "quit";

export type DecorKind = "grass" | "rock" | "lantern" | "banner" | "grave";

export interface Solid {
  x: number;
  w: number;
  top: number;
  trench?: boolean;
}

export interface SpawnDef {
  kind: EnemyKind;
  x: number;
  y: number;
  delay: number;
}

export interface TriggerDef {
  x: number;
  spawns: SpawnDef[];
}

export interface DecorDef {
  kind: DecorKind;
  x: number;
  y: number;
}

export interface LevelData {
  stage: 1 | 2 | 3;
  width: number;
  solids: Solid[];
  triggers: TriggerDef[];
  decors: DecorDef[];
  portalX: number;
  boss: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Swing {
  rect: Rect;
  damage: number;
  kb: number;
  stun: number;
  dir: number;
  crit: number;
  lifesteal: number;
  kind: "light" | "heavy" | "special" | "enemy";
  seen: Set<string>;
}

export interface ShotSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  life: number;
  damage: number;
  kb: number;
  stun: number;
  dir: number;
  fromPlayer: boolean;
  tex: string;
  crit: number;
  lifesteal: number;
  ignoreSolid?: boolean;
}

export interface Mods {
  atk: number;
  move: number;
  dodgeCd: number;
  specialCd: number;
  specialDmg: number;
  heavyMul: number;
  heavyKb: number;
  lifesteal: number;
  taken: number;
  crit: number;
  gold: number;
  lightRecovery: number;
  comboMul: number;
  dashCharges: number;
  shockwave: boolean;
}

export interface WorldApi {
  solids: Solid[];
  footing(x: number): boolean;
  focus: { x: number; y: number };
  fire(shot: ShotSpec): void;
  slash(x: number, y: number, dir: number, heavy: boolean): void;
  dust(x: number, y: number): void;
  spark(x: number, y: number, color: number): void;
  float(x: number, y: number, text: string, color: string): void;
  shake(ms: number, intensity: number): void;
  hitStop(ms: number): void;
  sfx(name: Sfx): void;
  onKill(kind: EnemyKind, x: number, y: number): void;
  afterimage(x: number, y: number, frame: string | number, flip: boolean): void;
  groundY: number;
}

export type BufferName = "jump" | "light" | "heavy" | "dodge" | "special";

export interface InputState {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  buffer: BufferName | null;
  bufferT: number;
}
