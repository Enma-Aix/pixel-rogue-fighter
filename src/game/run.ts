import type { EndMode, RoomKind, UpgradeId } from "./types";
import { Rng } from "./rng";
import { loadSave, writeSave } from "./storage";

export interface Offer {
  nodeId: string;
  choices: UpgradeId[];
}

export interface MapNode {
  id: string;
  act: 1 | 2 | 3;
  row: number;
  slot: number;
  kind: RoomKind;
  next: string[];
  done: boolean;
  skip: boolean;
}

export interface RunState {
  stage: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  gold: number;
  goldEarned: number;
  kills: number;
  upgrades: UpgradeId[];
  seed: number;
  settled: boolean;
  offer: Offer | null;
  clearedNode: string;
  lastBonus: number;
  lastHeal: number;
  downHits: number;
  cause: string;
  map: MapNode[];
  nodeId: string | null;
  available: string[];
}

let current: RunState | null = null;

export function getRun(): RunState | null {
  return current;
}

function link(nodes: MapNode[], from: string, to: string[]): void {
  const node = nodes.find((item) => item.id === from);
  if (node) node.next = to;
}

function pickTwo(rng: Rng, act: 1 | 2 | 3): [RoomKind, RoomKind] {
  const bag: RoomKind[] =
    act === 1 ? ["combat", "event", "shop", "rest"] : act === 2 ? ["combat", "elite", "shop", "event"] : ["combat", "rest", "shop", "elite"];
  const first = rng.pick(bag);
  let second = rng.pick(bag);
  if (second === first) second = first === "combat" ? "shop" : "combat";
  return [first, second];
}

export function buildMap(seed: number): MapNode[] {
  const rng = new Rng(seed);
  const nodes: MapNode[] = [];
  const id = (act: number, row: number, slot: number) => `a${act}r${row}s${slot}`;
  for (const act of [1, 2, 3] as const) {
    const base = (act - 1) * 3;
    const pair = pickTwo(rng, act);
    const finale: RoomKind = act === 3 ? "boss" : "elite";
    nodes.push({ id: id(act, 0, 0), act, row: base, slot: 0, kind: "combat", next: [], done: false, skip: false });
    nodes.push({ id: id(act, 1, 0), act, row: base + 1, slot: 0, kind: pair[0], next: [], done: false, skip: false });
    nodes.push({ id: id(act, 1, 1), act, row: base + 1, slot: 1, kind: pair[1], next: [], done: false, skip: false });
    nodes.push({ id: id(act, 2, 0), act, row: base + 2, slot: 0, kind: finale, next: [], done: false, skip: false });
    const entry = id(act, 0, 0);
    const left = id(act, 1, 0);
    const right = id(act, 1, 1);
    const end = id(act, 2, 0);
    link(nodes, entry, [left, right]);
    link(nodes, left, [end]);
    link(nodes, right, [end]);
    if (act < 3) link(nodes, end, [id(act + 1, 0, 0)]);
  }
  return nodes;
}

export function beginRun(): RunState {
  const save = loadSave();
  const maxHp = 100 + save.levels.hp * 14;
  const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const map = buildMap(seed);
  current = {
    stage: 1,
    hp: maxHp,
    maxHp,
    gold: 0,
    goldEarned: 0,
    kills: 0,
    upgrades: [],
    seed,
    settled: false,
    offer: null,
    clearedNode: "",
    lastBonus: 0,
    lastHeal: 0,
    downHits: 0,
    cause: "",
    map,
    nodeId: null,
    available: [map[0].id],
  };
  return current;
}

export function findNode(id: string): MapNode | undefined {
  return current?.map.find((node) => node.id === id);
}

export function currentNode(): MapNode | null {
  if (!current?.nodeId) return null;
  return findNode(current.nodeId) ?? null;
}

export function enterNode(id: string): MapNode {
  const run = current;
  if (!run) throw new Error("没有进行中的征途");
  const node = findNode(id);
  if (!node) throw new Error("房间不存在");
  run.nodeId = id;
  run.stage = node.act;
  return node;
}

export function noteClear(): void {
  const run = current;
  const node = currentNode();
  if (!run || !node || run.clearedNode === node.id) return;
  const bonus = node.kind === "elite" ? 18 : node.kind === "boss" ? 36 : node.kind === "combat" ? 8 : 0;
  run.gold += bonus;
  run.goldEarned += bonus;
  run.lastBonus = bonus;
  run.lastHeal = 0;
  if (node.kind === "elite") {
    const heal = Math.round(run.maxHp * 0.12);
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + heal);
    run.lastHeal = run.hp - before;
  }
  run.clearedNode = node.id;
}

export function completeNode(): void {
  const run = current;
  const node = currentNode();
  if (!run || !node) return;
  node.done = true;
  for (const other of run.map) {
    if (other.row === node.row && other.id !== node.id && !other.done) {
      other.done = true;
      other.skip = true;
    }
  }
  run.available = node.next.filter((id) => !findNode(id)?.done);
}

export function reachableAhead(): Set<string> {
  const run = current;
  const seen = new Set<string>();
  if (!run) return seen;
  const queue = [...run.available];
  while (queue.length > 0) {
    const id = queue.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const node = findNode(id);
    if (!node) continue;
    for (const next of node.next) queue.push(next);
  }
  return seen;
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
  save.gold += run.gold;
  save.stats.lifetimeGold += run.gold;
  save.stats.runs += 1;
  save.stats.kills += run.kills;
  if (mode === "win") save.stats.wins += 1;
  save.stats.bestStage = Math.max(save.stats.bestStage, mode === "win" ? 3 : run.stage);
  writeSave(save);
}
