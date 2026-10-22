import type { MetaId } from "./types";

export interface SaveStats {
  runs: number;
  wins: number;
  bestStage: number;
  kills: number;
  lifetimeGold: number;
}

export interface Keybinds {
  left: string;
  right: string;
  jump: string;
  light: string;
  heavy: string;
  dodge: string;
  special: string;
}

export type TouchPref = "auto" | "on" | "off";

export const DEFAULT_KEYS: Keybinds = {
  left: "A",
  right: "D",
  jump: "W",
  light: "J",
  heavy: "K",
  dodge: "L",
  special: "U",
};

export interface Save {
  gold: number;
  /** 旧档兼容：与音效档位一起写 */
  mute: boolean;
  /** 旧档兼容：与音效档位一起写。0 关, 1 低, 2 中, 3 高 */
  volume: number;
  music: number;
  sfx: number;
  shake: boolean;
  touch: TouchPref;
  tutorialDone: boolean;
  keys: Keybinds;
  levels: Record<MetaId, number>;
  stats: SaveStats;
}

const KEY = "jintu.save.v1";
const META_IDS: MetaId[] = ["hp", "atk", "agi", "special", "greed"];
const KEY_NAME = /^(?:[A-Z]|[0-9]|SPACE|SHIFT|UP|DOWN|LEFT|RIGHT)$/;

let shakeOn = true;
let touchForce: boolean | null = null;

function copyKeys(keys: Keybinds): Keybinds {
  return { ...keys };
}

function fresh(): Save {
  return {
    gold: 0,
    mute: false,
    volume: 2,
    music: 2,
    sfx: 2,
    shake: true,
    touch: "auto",
    tutorialDone: false,
    keys: copyKeys(DEFAULT_KEYS),
    levels: { hp: 0, atk: 0, agi: 0, special: 0, greed: 0 },
    stats: { runs: 0, wins: 0, bestStage: 0, kills: 0, lifetimeGold: 0 },
  };
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function step(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(3, Math.floor(value)));
}

function cleanKey(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const name = value.toUpperCase();
  if (name === "M" || !KEY_NAME.test(name)) return fallback;
  return name;
}

function applyRuntime(save: Save): void {
  shakeOn = save.shake;
  touchForce = save.touch === "on" ? true : save.touch === "off" ? false : null;
}

export function loadSave(): Save {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Save>;
    base.gold = Math.max(0, Math.floor(num(parsed.gold)));
    const storedVolume = (parsed as { volume?: unknown }).volume;
    const legacy = typeof storedVolume === "number" && Number.isFinite(storedVolume) ? step(storedVolume, 2) : parsed.mute ? 0 : 2;
    base.music = step((parsed as { music?: unknown }).music, legacy);
    base.sfx = step((parsed as { sfx?: unknown }).sfx, legacy);
    base.volume = base.sfx;
    base.mute = base.sfx === 0;
    base.shake = (parsed as { shake?: unknown }).shake !== false;
    const touch = (parsed as { touch?: unknown }).touch;
    base.touch = touch === "on" || touch === "off" ? touch : "auto";
    base.tutorialDone = (parsed as { tutorialDone?: unknown }).tutorialDone === true;
    const rawKeys = ((parsed as { keys?: Partial<Keybinds> }).keys ?? {}) as Partial<Keybinds>;
    base.keys = {
      left: cleanKey(rawKeys.left, DEFAULT_KEYS.left),
      right: cleanKey(rawKeys.right, DEFAULT_KEYS.right),
      jump: cleanKey(rawKeys.jump, DEFAULT_KEYS.jump),
      light: cleanKey(rawKeys.light, DEFAULT_KEYS.light),
      heavy: cleanKey(rawKeys.heavy, DEFAULT_KEYS.heavy),
      dodge: cleanKey(rawKeys.dodge, DEFAULT_KEYS.dodge),
      special: cleanKey(rawKeys.special, DEFAULT_KEYS.special),
    };
    const used = Object.values(base.keys);
    if (new Set(used).size !== used.length) base.keys = copyKeys(DEFAULT_KEYS);
    const levels = (parsed.levels ?? {}) as Partial<Record<MetaId, unknown>>;
    for (const id of META_IDS) {
      base.levels[id] = Math.max(0, Math.floor(num(levels[id])));
    }
    const stats = parsed.stats ?? ({} as SaveStats);
    base.stats.runs = Math.max(0, Math.floor(num(stats.runs)));
    base.stats.wins = Math.max(0, Math.floor(num(stats.wins)));
    base.stats.bestStage = Math.max(0, Math.min(3, Math.floor(num(stats.bestStage))));
    base.stats.kills = Math.max(0, Math.floor(num(stats.kills)));
    base.stats.lifetimeGold = Math.max(0, Math.floor(num(stats.lifetimeGold)));
    return base;
  } catch {
    return base;
  }
}

export function writeSave(save: Save): void {
  save.volume = save.sfx;
  save.mute = save.sfx === 0;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode or full storage: keep the in-memory save for this page */
  }
}

export function hydrateSettings(): void {
  applyRuntime(loadSave());
}

export function screenShakeEnabled(): boolean {
  return shakeOn;
}

export function setShakeEnabled(on: boolean): void {
  const save = loadSave();
  save.shake = on;
  writeSave(save);
  shakeOn = on;
}

export function touchForced(): boolean | null {
  return touchForce;
}

export function setTouchPref(pref: TouchPref): void {
  const save = loadSave();
  save.touch = pref;
  writeSave(save);
  applyRuntime(save);
}

export function markTutorialDone(): void {
  const save = loadSave();
  save.tutorialDone = true;
  writeSave(save);
}

export function resetProgress(): Save {
  const prev = loadSave();
  const next = fresh();
  next.music = prev.music;
  next.sfx = prev.sfx;
  next.volume = prev.sfx;
  next.mute = prev.sfx === 0;
  next.shake = prev.shake;
  next.touch = prev.touch;
  next.keys = copyKeys(prev.keys);
  writeSave(next);
  applyRuntime(next);
  return next;
}

hydrateSettings();
