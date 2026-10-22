import { bossForAct } from "./bosses";
import { GROUND_Y } from "./constants";
import { Rng } from "./rng";
import type { DecorDef, DecorKind, EliteMod, EnemyKind, HazardDef, LevelData, RoomKind, Solid, SpawnDef } from "./types";

const MIX: Record<number, EnemyKind[]> = {
  1: ["grunt", "grunt", "shield", "archer"],
  2: ["archer", "leaper", "bomber", "brute", "grunt"],
  3: ["brute", "bomber", "leaper", "shield", "archer"],
};

const DECOR: Record<number, DecorKind[]> = {
  1: ["grass", "grass", "rock", "lantern"],
  2: ["grass", "banner", "rock", "lantern"],
  3: ["grave", "banner", "lantern", "rock"],
};

const ELITES: EliteMod[] = ["armored", "enraged", "split"];

function surfaceAt(solids: Solid[], x: number): number {
  let best = GROUND_Y;
  let found = false;
  for (const solid of solids) {
    if (x < solid.x || x > solid.x + solid.w) continue;
    if (!found || solid.top < best) {
      best = solid.top;
      found = true;
    }
  }
  return best;
}

function decorate(solids: Solid[], x: number, w: number, stage: number, rng: Rng, density: number): DecorDef[] {
  const list: DecorDef[] = [];
  for (let dx = 48; dx < w - 40; dx += 86) {
    if (!rng.chance(density)) continue;
    const sx = x + dx;
    list.push({ kind: rng.pick(DECOR[stage]), x: sx, y: surfaceAt(solids, sx) });
  }
  return list;
}

function hash(seed: number, salt: string): number {
  let h = seed >>> 0;
  for (const ch of salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0 || 1;
}

interface Built {
  w: number;
  solids: Solid[];
  hazards: HazardDef[];
}

function field(stage: number): Built {
  const w = 860;
  const solids: Solid[] = [{ x: 0, w, top: GROUND_Y }];
  const hazards: HazardDef[] = stage === 3 ? [{ x: 380, w: 90, y: GROUND_Y, kind: "flame" }] : [];
  return { w, solids, hazards };
}

function mounds(stage: number): Built {
  const w = 920;
  const solids: Solid[] = [
    { x: 0, w: 220, top: GROUND_Y },
    { x: 220, w: 150, top: GROUND_Y - 46 },
    { x: 370, w: 180, top: GROUND_Y },
    { x: 550, w: 150, top: GROUND_Y - 62 },
    { x: 700, w: 220, top: GROUND_Y },
  ];
  const hazards: HazardDef[] = stage === 2 ? [{ x: 400, w: 70, y: GROUND_Y, kind: "flame" }] : [];
  return { w, solids, hazards };
}

function stairs(stage: number): Built {
  const w = 900;
  const steps = [
    { x: 180, w: 140, h: 36 },
    { x: 390, w: 140, h: 68 },
    { x: 600, w: 130, h: 40 },
  ];
  const solids: Solid[] = [];
  let cursor = 0;
  for (const step of steps) {
    if (step.x > cursor) solids.push({ x: cursor, w: step.x - cursor, top: GROUND_Y });
    solids.push({ x: step.x, w: step.w, top: GROUND_Y - step.h });
    cursor = step.x + step.w;
  }
  if (cursor < w) solids.push({ x: cursor, w: w - cursor, top: GROUND_Y });
  const hazards: HazardDef[] = stage === 3 ? [{ x: 410, w: 80, y: GROUND_Y - 68, kind: "flame" }] : [];
  return { w, solids, hazards };
}

function trench(stage: number): Built {
  const w = 940;
  const lip = 250;
  const trenchW = 280;
  const solids: Solid[] = [
    { x: 0, w: lip, top: GROUND_Y },
    { x: lip, w: trenchW, top: GROUND_Y + 58, trench: true },
    { x: lip + trenchW, w: w - lip - trenchW, top: GROUND_Y },
  ];
  const kind = stage === 1 ? "spike" : "flame";
  const hazards: HazardDef[] = [{ x: lip + 36, w: trenchW - 72, y: GROUND_Y + 58, kind }];
  if (stage === 3) hazards.push({ x: lip + 70, w: 80, y: GROUND_Y + 58, kind: "spike" });
  return { w, solids, hazards };
}

function arena(): Built {
  const w = 1080;
  const solids: Solid[] = [{ x: 0, w, top: GROUND_Y }];
  return {
    w,
    solids,
    hazards: [
      { x: 280, w: 70, y: GROUND_Y, kind: "flame" },
      { x: 720, w: 70, y: GROUND_Y, kind: "spike" },
    ],
  };
}

function lanternYard(): Built {
  const w = 980;
  return { w, solids: [{ x: 0, w, top: GROUND_Y }], hazards: [] };
}

function bambooCourt(): Built {
  const w = 1020;
  const solids: Solid[] = [
    { x: 0, w: 280, top: GROUND_Y },
    { x: 320, w: 120, top: GROUND_Y - 36 },
    { x: 480, w: 220, top: GROUND_Y },
    { x: 740, w: 110, top: GROUND_Y - 32 },
    { x: 880, w: 140, top: GROUND_Y },
  ];
  return { w, solids, hazards: [] };
}

function ruinArena(): Built {
  const w = 1120;
  const solids: Solid[] = [
    { x: 0, w, top: GROUND_Y },
    { x: 180, w: 70, top: GROUND_Y - 48 },
    { x: 860, w: 70, top: GROUND_Y - 48 },
  ];
  return { w, solids, hazards: [] };
}

function bossArena(stage: 1 | 2 | 3): Built {
  if (stage === 1) return lanternYard();
  if (stage === 2) return bambooCourt();
  return ruinArena();
}

function layout(name: string, stage: number): Built {
  if (name === "mounds") return mounds(stage);
  if (name === "stairs") return stairs(stage);
  if (name === "trench") return trench(stage);
  if (name === "arena") return arena();
  return field(stage);
}

function spawnsFor(solids: Solid[], w: number, stage: 1 | 2 | 3, room: "combat" | "elite" | "boss", rng: Rng): SpawnDef[] {
  if (room === "boss") {
    const kind = bossForAct(stage);
    const x = w * 0.55;
    return [{ kind, x, y: surfaceAt(solids, x), delay: 0.4 }];
  }
  const count = room === "elite" ? 3 : 2;
  const list: SpawnDef[] = [];
  for (let index = 0; index < count; index += 1) {
    const kind = stage === 1 && room === "combat" && index === 1 ? rng.pick(["shield", "archer"] as const) : rng.pick(MIX[stage]);
    const px = w * (0.56 + (0.22 * index) / Math.max(1, count - 1));
    const elite = room === "elite" && index === 0 ? rng.pick(ELITES) : undefined;
    list.push({ kind, x: px, y: surfaceAt(solids, px), delay: index * 0.18, elite });
  }
  return list;
}

export function buildRoom(stage: 1 | 2 | 3, seed: number, nodeId: string, room: RoomKind): LevelData {
  const fight = room === "boss" || room === "elite" || room === "combat";
  const rng = new Rng(hash(seed, nodeId));
  const names = stage === 1 ? ["field", "mounds", "trench"] : stage === 2 ? ["trench", "mounds", "stairs"] : ["trench", "stairs", "arena"];
  const built = room === "boss" ? bossArena(stage) : layout(rng.pick(names), stage);
  const hazards = room === "combat" ? built.hazards.slice(0, 1) : built.hazards;
  const spawns = fight ? spawnsFor(built.solids, built.w, stage, room === "boss" ? "boss" : room === "elite" ? "elite" : "combat", rng) : [];
  const decors = decorate(built.solids, 0, built.w, stage, rng, room === "boss" ? 0.72 : 0.45);
  const width = built.w + 48;
  built.solids.push({ x: -40, w: 40, top: 80 });
  built.solids.push({ x: built.w, w: 48, top: 80 });
  return {
    stage,
    width,
    solids: built.solids,
    triggers: spawns.length ? [{ x: 180, spawns }] : [],
    decors,
    hazards,
    portalX: built.w - 90,
    boss: room === "boss",
    finale: room === "boss" && stage === 3,
  };
}
