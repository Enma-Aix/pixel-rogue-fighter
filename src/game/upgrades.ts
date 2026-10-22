import type { EnemyKind, MetaId, Mods, UpgradeId } from "./types";
import { Rng } from "./rng";
import type { RunState } from "./run";
import { loadSave, writeSave } from "./storage";

export interface MetaDef {
  id: MetaId;
  name: string;
  desc: string;
  max: number;
  base: number;
  growth: number;
  detail: (level: number) => string;
}

export const META: Record<MetaId, MetaDef> = {
  hp: {
    id: "hp",
    name: "体质",
    desc: "最大生命 +14",
    max: 8,
    base: 24,
    growth: 1.55,
    detail: (level) => `当前最大生命 ${100 + level * 14}`,
  },
  atk: {
    id: "atk",
    name: "力量",
    desc: "攻击 +8%",
    max: 8,
    base: 28,
    growth: 1.55,
    detail: (level) => `当前攻击 ${Math.round((1 + level * 0.08) * 100)}%`,
  },
  agi: {
    id: "agi",
    name: "身法",
    desc: "移速 +4%，闪避冷却 -5%",
    max: 6,
    base: 26,
    growth: 1.5,
    detail: (level) => `移速 ${Math.round((1 + level * 0.04) * 100)}%`,
  },
  special: {
    id: "special",
    name: "奥义",
    desc: "奥义伤害 +12%，冷却 -4%",
    max: 6,
    base: 32,
    growth: 1.52,
    detail: (level) => `奥义伤害 ${Math.round((1 + level * 0.12) * 100)}%`,
  },
  greed: {
    id: "greed",
    name: "财运",
    desc: "获得金币 +12%",
    max: 5,
    base: 36,
    growth: 1.6,
    detail: (level) => `金币获取 ${Math.round((1 + level * 0.12) * 100)}%`,
  },
};

export const META_ORDER: MetaId[] = ["hp", "atk", "agi", "special", "greed"];

export function metaCost(id: MetaId, level: number): number {
  const def = META[id];
  return Math.round(def.base * Math.pow(def.growth, level));
}

export function tryBuy(id: MetaId): boolean {
  const save = loadSave();
  const level = save.levels[id];
  const def = META[id];
  if (level >= def.max) return false;
  const cost = metaCost(id, level);
  if (save.gold < cost) return false;
  save.gold -= cost;
  save.levels[id] = level + 1;
  writeSave(save);
  return true;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  unique: boolean;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  dmg: { id: "dmg", name: "锋芒", desc: "造成的所有伤害 +18%。", unique: false },
  vamp: { id: "vamp", name: "饮血", desc: "造成伤害的 8% 转化为生命。", unique: false },
  vital: { id: "vital", name: "固本", desc: "最大生命 +25，并立即回复 25 点。", unique: false },
  dash: { id: "dash", name: "残影", desc: "闪避冷却缩短 20%。", unique: false },
  haste: { id: "haste", name: "疾风", desc: "移动速度 +10%。", unique: false },
  art: { id: "art", name: "凝神", desc: "奥义伤害 +10%，冷却缩短 18%。", unique: false },
  heavy: { id: "heavy", name: "崩山", desc: "重击伤害 +30%，击退更远。", unique: false },
  combo: { id: "combo", name: "连斩", desc: "第二段轻击与重击收招伤害 +12%，轻击收招更快。", unique: false },
  crit: { id: "crit", name: "破绽", desc: "暴击率 +12%。暴击造成 1.75 倍伤害。", unique: false },
  guard: { id: "guard", name: "铁意", desc: "受到的伤害减少 12%。", unique: false },
  twin: { id: "twin", name: "二段闪", desc: "闪避多出一层充能，可连续闪避。", unique: true },
  shock: { id: "shock", name: "裂地斩", desc: "奥义额外向两侧放出贴地冲击波。", unique: true },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export function defaultMods(): Mods {
  return {
    atk: 1,
    move: 1,
    dodgeCd: 1,
    specialCd: 1,
    specialDmg: 1,
    heavyMul: 1,
    heavyKb: 1,
    lifesteal: 0,
    taken: 1,
    crit: 0.02,
    gold: 1,
    lightRecovery: 1,
    comboMul: 1,
    dashCharges: 1,
    shockwave: false,
  };
}

export function modsFrom(run: RunState): Mods {
  const save = loadSave();
  const mods = defaultMods();
  const lv = save.levels;
  mods.atk += 0.08 * lv.atk;
  mods.move += 0.04 * lv.agi;
  mods.dodgeCd *= Math.max(0.55, 1 - 0.05 * lv.agi);
  mods.specialDmg += 0.12 * lv.special;
  mods.specialCd *= Math.max(0.55, 1 - 0.04 * lv.special);
  mods.gold += 0.12 * lv.greed;
  for (const id of run.upgrades) applyStack(mods, id);
  return mods;
}

function applyStack(mods: Mods, id: UpgradeId): void {
  switch (id) {
    case "dmg":
      mods.atk += 0.18;
      break;
    case "vamp":
      mods.lifesteal += 0.08;
      break;
    case "vital":
      break;
    case "dash":
      mods.dodgeCd *= 0.8;
      break;
    case "haste":
      mods.move += 0.1;
      break;
    case "art":
      mods.specialCd *= 0.82;
      mods.specialDmg += 0.1;
      break;
    case "heavy":
      mods.heavyMul += 0.3;
      mods.heavyKb += 0.25;
      break;
    case "combo":
      mods.comboMul += 0.12;
      mods.lightRecovery *= 0.85;
      break;
    case "crit":
      mods.crit += 0.12;
      break;
    case "guard":
      mods.taken *= 0.88;
      break;
    case "twin":
      mods.dashCharges = Math.min(2, mods.dashCharges + 1);
      break;
    case "shock":
      mods.shockwave = true;
      break;
    default:
      break;
  }
}

export function rollChoices(run: RunState): UpgradeId[] {
  const rng = new Rng((run.seed + run.stage * 97) >>> 0);
  const ownedUnique = new Set(run.upgrades.filter((id) => UPGRADES[id].unique));
  const pool = UPGRADE_IDS.filter((id) => !ownedUnique.has(id));
  const bag = [...pool];
  const picks: UpgradeId[] = [];
  while (picks.length < 3 && bag.length > 0) {
    const index = rng.int(bag.length);
    picks.push(bag.splice(index, 1)[0]);
  }
  const stackables = pool.filter((id) => !UPGRADES[id].unique);
  while (picks.length < 3 && stackables.length > 0) {
    picks.push(rng.pick(stackables));
  }
  return picks;
}

export function grantGold(base: number, goldMul: number): number {
  const save = loadSave();
  const gained = Math.max(1, Math.round(base * goldMul));
  save.gold += gained;
  save.stats.lifetimeGold += gained;
  writeSave(save);
  return gained;
}

export interface EnemyStats {
  hp: number;
  dmg: number;
  speed: number;
  gold: number;
  name: string;
}

export function enemyStats(kind: EnemyKind, stage: number): EnemyStats {
  const t = 1 + (stage - 1) * 0.12;
  switch (kind) {
    case "grunt":
      return { hp: Math.round(38 * t), dmg: Math.round(8 * (1 + (stage - 1) * 0.08)), speed: 88 + stage * 6, gold: 6, name: "步卒" };
    case "archer":
      return { hp: Math.round(30 * t), dmg: Math.round(8 * (1 + (stage - 1) * 0.08)), speed: 72, gold: 8, name: "弓手" };
    case "brute":
      return { hp: Math.round(92 * t), dmg: Math.round(15 * (1 + (stage - 1) * 0.08)), speed: 62, gold: 14, name: "重甲" };
    case "boss":
      return { hp: 390, dmg: 14, speed: 78, gold: 80, name: "残将" };
  }
}
