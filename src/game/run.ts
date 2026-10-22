import type { EndMode, UpgradeId } from "./types";
import { loadSave, writeSave } from "./storage";
import { grantGold } from "./upgrades";

export interface Offer {
  stage: number;
  choices: UpgradeId[];
}

export interface RunState {
  stage: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  goldEarned: number;
  kills: number;
  upgrades: UpgradeId[];
  seed: number;
  settled: boolean;
  offer: Offer | null;
  clearedMark: number;
  lastBonus: number;
  lastHeal: number;
  downHits: number;
  cause: string;
}

let current: RunState | null = null;

export function getRun(): RunState | null {
  return current;
}

export function beginRun(): RunState {
  const save = loadSave();
  const maxHp = 100 + save.levels.hp * 14;
  current = {
    stage: 1,
    hp: maxHp,
    maxHp,
    goldEarned: 0,
    kills: 0,
    upgrades: [],
    seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
    settled: false,
    offer: null,
    clearedMark: 0,
    lastBonus: 0,
    lastHeal: 0,
    downHits: 0,
    cause: "",
  };
  return current;
}

export function grantStageClear(goldMul: number): void {
  const run = current;
  if (!run || run.clearedMark === run.stage) return;
  const bonusBase = 12 + run.stage * 10;
  const gained = grantGold(bonusBase, goldMul);
  run.goldEarned += gained;
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + 10);
  run.lastHeal = run.hp - before;
  run.lastBonus = gained;
  run.clearedMark = run.stage;
}

export function applyUpgrade(id: UpgradeId): void {
  const run = current;
  if (!run) return;
  run.upgrades.push(id);
  if (id === "vital") {
    run.maxHp += 25;
    run.hp = Math.min(run.maxHp, run.hp + 25);
  }
  run.offer = null;
}

export function settleRun(mode: EndMode): void {
  const run = current;
  if (!run || run.settled) return;
  run.settled = true;
  const save = loadSave();
  save.stats.runs += 1;
  save.stats.kills += run.kills;
  if (mode === "win") save.stats.wins += 1;
  save.stats.bestStage = Math.max(save.stats.bestStage, mode === "win" ? 3 : run.stage);
  writeSave(save);
}
