import type { CharacterId, WeaponId } from '../core/types';
import { defaultMeta, type MetaRanks, type MetaState } from '../data/meta';
import type { Run } from '../sim/model';
import { snapshotOf } from '../sim/run';
import type { RunSnapshot } from '../sim/snapshot';
import { DEFAULT_BINDINGS, type Bindings } from '../input/controls';

const KEY = 'jintu.save.v1';

export interface Settings {
  music: number;
  sfx: number;
  shake: boolean;
  touch: 'auto' | 'on' | 'off';
  bindings: Bindings;
}

export interface Checkpoint {
  snap: RunSnapshot;
  ranks: MetaRanks;
}

export interface SaveFile {
  meta: MetaState;
  settings: Settings;
  checkpoint: Checkpoint | null;
  character: CharacterId;
  weapon: WeaponId;
  seed: number;
}

export function defaultSettings(): Settings {
  return {
    music: 0.7,
    sfx: 0.85,
    shake: true,
    touch: 'auto',
    bindings: structuredClone(DEFAULT_BINDINGS),
  };
}

export function freshSave(): SaveFile {
  return {
    meta: defaultMeta(),
    settings: defaultSettings(),
    checkpoint: null,
    character: 'wanderer',
    weapon: 'sword',
    seed: 1 + Math.floor(Math.random() * 999983),
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveFile {
  const base = freshSave();
  const raw = storage()?.getItem(KEY);
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    const settings = { ...base.settings, ...parsed.settings };
    settings.bindings = { ...DEFAULT_BINDINGS, ...(parsed.settings?.bindings ?? {}) };
    const meta = parsed.meta ?? base.meta;
    meta.ranks = { ...base.meta.ranks, ...meta.ranks };
    meta.unlocks = { ...base.meta.unlocks, ...meta.unlocks };
    meta.stats = { ...base.meta.stats, ...meta.stats };
    return {
      meta,
      settings,
      checkpoint: parsed.checkpoint ?? null,
      character: parsed.character ?? 'wanderer',
      weapon: parsed.weapon ?? 'sword',
      seed: parsed.seed || base.seed,
    };
  } catch {
    return base;
  }
}

export function writeSave(save: SaveFile): void {
  storage()?.setItem(KEY, JSON.stringify(save));
}

export function wipeSave(save: SaveFile): void {
  const seed = save.seed;
  const next = freshSave();
  next.seed = seed;
  Object.assign(save, next);
  writeSave(save);
}

export function coreReward(run: Run): number {
  return Math.max(
    0,
    Math.round(run.gold * 0.22 + run.stats.kills + run.stats.bosses * 10 + run.floorIndex * 6 + (run.victory ? 48 : 0)),
  );
}

export function bankRun(save: SaveFile, run: Run): number {
  if (run.banked) return run.coresGained;
  const cores = coreReward(run);
  run.coresGained = cores;
  run.banked = true;
  save.meta.cores += cores;
  save.meta.stats.runs += 1;
  save.meta.stats.kills += run.stats.kills;
  const reached = run.floorIndex + (run.victory ? 1 : 0);
  save.meta.stats.bestFloor = Math.max(save.meta.stats.bestFloor, reached);
  if (run.victory) save.meta.stats.wins += 1;
  save.checkpoint = null;
  writeSave(save);
  return cores;
}

export function storeCheckpoint(save: SaveFile, run: Run, ranks: MetaRanks): void {
  if (run.tutorial || run.banked || run.mode === 'dead' || run.mode === 'victory' || run.mode === 'dying') return;
  save.checkpoint = { snap: snapshotOf(run), ranks: { ...ranks } };
  writeSave(save);
}
