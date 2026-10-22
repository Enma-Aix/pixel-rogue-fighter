import type { Archetype, EnemyKind, MetaId, Mods, Rarity, UpgradeId } from "./types";
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
  rarity: Rarity;
  arch: Archetype;
}

export const ARCH_NAME: Record<Archetype, string> = {
  scorch: "灼血",
  swift: "迅刃",
  riposte: "反手",
  flow: "奥流",
  neutral: "通式",
};

export const RARITY_NAME: Record<Rarity, string> = {
  common: "普通",
  uncommon: "稀有",
  rare: "珍品",
};

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  dmg: { id: "dmg", name: "锋芒", desc: "造成的所有伤害 +18%。", unique: false, rarity: "common", arch: "neutral" },
  vamp: { id: "vamp", name: "饮血", desc: "造成伤害的 8% 转化为生命。", unique: false, rarity: "uncommon", arch: "neutral" },
  vital: { id: "vital", name: "固本", desc: "最大生命 +25，并立即回复 25 点。", unique: false, rarity: "common", arch: "neutral" },
  dash: { id: "dash", name: "残影", desc: "闪避冷却缩短 20%。", unique: false, rarity: "common", arch: "neutral" },
  heavy: { id: "heavy", name: "崩山", desc: "重击伤害 +30%，击退更远。", unique: false, rarity: "uncommon", arch: "neutral" },
  combo: { id: "combo", name: "连斩", desc: "第二段轻击与收招伤害 +12%，轻击收招更快。", unique: false, rarity: "uncommon", arch: "neutral" },
  twin: { id: "twin", name: "二段闪", desc: "闪避多出一层充能，可连续闪避。", unique: true, rarity: "rare", arch: "neutral" },
  ember: { id: "ember", name: "余烬", desc: "攻击附加 1 层流血。流血会持续掉血。", unique: false, rarity: "common", arch: "scorch" },
  bleed: { id: "bleed", name: "裂血", desc: "流血层数 +1，每层伤害提高。", unique: false, rarity: "uncommon", arch: "scorch" },
  cinder: { id: "cinder", name: "星火", desc: "攻击有 28% 几率点燃敌人。", unique: false, rarity: "uncommon", arch: "scorch" },
  pyre: { id: "pyre", name: "焚身", desc: "流血伤害提高，点燃更痛。", unique: false, rarity: "rare", arch: "scorch" },
  haste: { id: "haste", name: "疾风", desc: "移动速度 +10%。", unique: false, rarity: "common", arch: "swift" },
  crit: { id: "crit", name: "破绽", desc: "暴击率 +12%。", unique: false, rarity: "uncommon", arch: "swift" },
  tempo: { id: "tempo", name: "紧手", desc: "轻击收招更快，暴击率 +4%。", unique: false, rarity: "uncommon", arch: "swift" },
  edge: { id: "edge", name: "刀锋", desc: "暴击伤害提高。", unique: false, rarity: "rare", arch: "swift" },
  gale: { id: "gale", name: "掠风", desc: "移速 +8%，闪避冷却再缩短 15%。", unique: false, rarity: "rare", arch: "swift" },
  guard: { id: "guard", name: "铁意", desc: "受到的伤害减少 12%。", unique: false, rarity: "common", arch: "riposte" },
  parry: { id: "parry", name: "拆招", desc: "闪避后短时间内，下一击伤害 +45%。", unique: false, rarity: "uncommon", arch: "riposte" },
  thorn: { id: "thorn", name: "反刺", desc: "受击时反弹 5 点伤害。", unique: false, rarity: "uncommon", arch: "riposte" },
  brace: { id: "brace", name: "稳架", desc: "受伤再减 10%，重击伤害 +15%。", unique: false, rarity: "rare", arch: "riposte" },
  mirror: { id: "mirror", name: "镜反", desc: "闪避时向两侧放出冲击波。", unique: true, rarity: "rare", arch: "riposte" },
  focus: { id: "focus", name: "聚气", desc: "奥义冷却缩短 12%。", unique: false, rarity: "common", arch: "flow" },
  art: { id: "art", name: "凝神", desc: "奥义伤害 +12%，冷却缩短 16%。", unique: false, rarity: "uncommon", arch: "flow" },
  flow: { id: "flow", name: "回流", desc: "奥义命中后，冷却返还 0.7 秒。", unique: false, rarity: "uncommon", arch: "flow" },
  shock: { id: "shock", name: "裂地斩", desc: "奥义额外向两侧放出贴地冲击波。", unique: true, rarity: "rare", arch: "flow" },
  echo: { id: "echo", name: "余响", desc: "奥义会再追出一道较弱的气刃。", unique: true, rarity: "rare", arch: "flow" },
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
    bleed: 0,
    bleedDmg: 0,
    burn: 0,
    kindle: false,
    critMul: 1.75,
    counter: 0,
    thorns: 0,
    specialRefund: 0,
    echo: false,
    mirror: false,
  };
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
      mods.specialCd *= 0.84;
      mods.specialDmg += 0.12;
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
    case "ember":
      mods.bleed += 1;
      break;
    case "bleed":
      mods.bleed += 1;
      mods.bleedDmg += 1;
      break;
    case "cinder":
      mods.burn += 0.28;
      break;
    case "pyre":
      mods.bleedDmg += 2;
      mods.burn += 0.12;
      break;
    case "tempo":
      mods.lightRecovery *= 0.82;
      mods.crit += 0.04;
      break;
    case "edge":
      mods.critMul += 0.4;
      break;
    case "gale":
      mods.move += 0.08;
      mods.dodgeCd *= 0.85;
      break;
    case "parry":
      mods.counter += 0.45;
      break;
    case "thorn":
      mods.thorns += 5;
      break;
    case "brace":
      mods.taken *= 0.9;
      mods.heavyMul += 0.15;
      break;
    case "mirror":
      mods.mirror = true;
      break;
    case "focus":
      mods.specialCd *= 0.88;
      break;
    case "flow":
      mods.specialRefund += 0.7;
      break;
    case "echo":
      mods.echo = true;
      break;
    default: {
      const never: never = id;
      return never;
    }
  }
}

function archCounts(ids: UpgradeId[]): Record<Archetype, number> {
  const counts: Record<Archetype, number> = { scorch: 0, swift: 0, riposte: 0, flow: 0, neutral: 0 };
  for (const id of ids) counts[UPGRADES[id].arch] += 1;
  return counts;
}

export function synergyLine(ids: UpgradeId[]): string {
  const counts = archCounts(ids);
  const parts: string[] = [];
  (["scorch", "swift", "riposte", "flow"] as const).forEach((arch) => {
    if (counts[arch] >= 2) parts.push(`${ARCH_NAME[arch]} ${counts[arch]}`);
  });
  return parts.join("  ");
}

function applySynergy(mods: Mods, ids: UpgradeId[]): void {
  const counts = archCounts(ids);
  if (counts.scorch >= 2) {
    mods.bleed += 1;
    mods.bleedDmg += 1;
  }
  if (counts.scorch >= 4) {
    mods.burn = Math.max(mods.burn, 0.35);
    mods.kindle = true;
  }
  if (counts.swift >= 2) {
    mods.crit += 0.08;
    mods.move += 0.06;
  }
  if (counts.swift >= 4) mods.critMul += 0.25;
  if (counts.riposte >= 2) mods.counter += 0.2;
  if (counts.riposte >= 4) {
    mods.thorns += 4;
    mods.taken *= 0.92;
  }
  if (counts.flow >= 2) {
    mods.specialCd *= 0.85;
    mods.specialDmg += 0.15;
  }
  if (counts.flow >= 4) mods.specialRefund += 0.4;
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
  applySynergy(mods, run.upgrades);
  return mods;
}

const RARITY_WEIGHT: Record<Rarity, number> = { common: 58, uncommon: 30, rare: 12 };

export function rollChoices(run: RunState, salt: number, elite = false): UpgradeId[] {
  const rng = new Rng((run.seed + salt * 97) >>> 0);
  const ownedUnique = new Set(run.upgrades.filter((id) => UPGRADES[id].unique));
  const pool = UPGRADE_IDS.filter((id) => !ownedUnique.has(id));
  const counts = archCounts(run.upgrades);
  const weight = (id: UpgradeId) => {
    const def = UPGRADES[id];
    let w = RARITY_WEIGHT[def.rarity];
    if (elite && def.rarity === "common") w *= 0.45;
    if (elite && def.rarity !== "common") w *= 1.7;
    if (def.arch !== "neutral" && counts[def.arch] > 0) w *= 1.85;
    return w;
  };
  const picks: UpgradeId[] = [];
  const bag = [...pool];
  while (picks.length < 3 && bag.length > 0) {
    const total = bag.reduce((sum, id) => sum + weight(id), 0);
    let roll = rng.next() * total;
    let index = 0;
    for (let i = 0; i < bag.length; i += 1) {
      roll -= weight(bag[i]);
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picks.push(bag.splice(index, 1)[0]);
  }
  return picks;
}

export interface ShopOffer {
  id: UpgradeId;
  price: number;
  sold: boolean;
}

export function priceOf(id: UpgradeId, act: number): number {
  const rarity = UPGRADES[id].rarity;
  const base = rarity === "rare" ? 52 : rarity === "uncommon" ? 34 : 22;
  return base + act * (rarity === "rare" ? 8 : 5);
}

export function healPrice(act: number): number {
  return 18 + act * 4;
}

export function shopOffers(run: RunState, salt: number): ShopOffer[] {
  return rollChoices(run, salt, false).map((id) => ({ id, price: priceOf(id, run.stage), sold: false }));
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
    case "shield":
      return { hp: Math.round(52 * t), dmg: Math.round(9 * (1 + (stage - 1) * 0.08)), speed: 64, gold: 10, name: "盾卫" };
    case "bomber":
      return { hp: Math.round(28 * t), dmg: Math.round(10 * (1 + (stage - 1) * 0.08)), speed: 68, gold: 10, name: "火师" };
    case "leaper":
      return { hp: Math.round(26 * t), dmg: Math.round(11 * (1 + (stage - 1) * 0.08)), speed: 150, gold: 11, name: "影刺" };
    case "boss":
      return { hp: 390, dmg: 14, speed: 78, gold: 80, name: "残将" };
    default: {
      const never: never = kind;
      return never;
    }
  }
}
