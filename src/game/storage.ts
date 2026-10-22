import type { MetaId } from "./types";

export interface SaveStats {
  runs: number;
  wins: number;
  bestStage: number;
  kills: number;
  lifetimeGold: number;
}

export interface Save {
  gold: number;
  mute: boolean;
  levels: Record<MetaId, number>;
  stats: SaveStats;
}

const KEY = "jintu.save.v1";

const META_IDS: MetaId[] = ["hp", "atk", "agi", "special", "greed"];

function fresh(): Save {
  return {
    gold: 0,
    mute: false,
    levels: { hp: 0, atk: 0, agi: 0, special: 0, greed: 0 },
    stats: { runs: 0, wins: 0, bestStage: 0, kills: 0, lifetimeGold: 0 },
  };
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function loadSave(): Save {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Save>;
    base.gold = Math.max(0, Math.floor(num(parsed.gold)));
    base.mute = Boolean(parsed.mute);
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
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode or full storage: keep the in-memory save for this page */
  }
}
