import { GROUND_Y } from "./constants";
import { Rng } from "./rng";
import type { DecorDef, DecorKind, EnemyKind, LevelData, Solid, SpawnDef, TriggerDef } from "./types";

const POOLS: Record<number, EnemyKind[][]> = {
  1: [
    ["grunt", "grunt"],
    ["grunt", "archer"],
    ["archer", "grunt"],
    ["grunt", "grunt", "archer"],
  ],
  2: [
    ["grunt", "archer", "grunt"],
    ["brute", "grunt"],
    ["archer", "brute"],
    ["grunt", "archer", "archer"],
    ["brute", "archer", "grunt"],
  ],
  3: [
    ["brute", "archer"],
    ["grunt", "brute", "grunt"],
    ["archer", "brute", "archer"],
    ["brute", "grunt", "archer"],
  ],
};

const DECOR: Record<number, DecorKind[]> = {
  1: ["grass", "grass", "rock", "lantern"],
  2: ["grass", "banner", "rock", "lantern"],
  3: ["grave", "banner", "lantern", "rock"],
};

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
  for (let dx = 48; dx < w - 40; dx += 78) {
    if (!rng.chance(density)) continue;
    const sx = x + dx;
    list.push({ kind: rng.pick(DECOR[stage]), x: sx, y: surfaceAt(solids, sx) });
  }
  return list;
}

function placePack(solids: Solid[], x: number, w: number, stage: number, rng: Rng, extra = false, meleeOnly = false): SpawnDef[] {
  const pack: EnemyKind[] = meleeOnly ? ["grunt", "grunt"] : [...rng.pick(POOLS[stage])];
  if (extra && rng.chance(0.55)) pack.push(stage === 1 ? "grunt" : rng.pick(["grunt", "archer"] as const));
  return pack.map((kind, index) => {
    const px = pack.length === 1 ? x + w * 0.62 : x + w * (0.48 + (0.38 * index) / (pack.length - 1));
    return { kind, x: px, y: surfaceAt(solids, px), delay: index * 0.16 };
  });
}

interface Built {
  w: number;
  solids: Solid[];
  spawns: SpawnDef[];
  decors: DecorDef[];
}

function segment(kind: string, origin: number, stage: number, rng: Rng, meleeOnly = false): Built {
  if (kind === "mounds") {
    const w = 860;
    const solids: Solid[] = [
      { x: origin, w: 210, top: GROUND_Y },
      { x: origin + 210, w: 140, top: GROUND_Y - 42 },
      { x: origin + 350, w: 170, top: GROUND_Y },
      { x: origin + 520, w: 160, top: GROUND_Y - 64 },
      { x: origin + 680, w: 180, top: GROUND_Y },
    ];
    return { w, solids, spawns: placePack(solids, origin, w, stage, rng, false, meleeOnly), decors: decorate(solids, origin, w, stage, rng, 0.55) };
  }
  if (kind === "trench") {
    const w = 920;
    const lip = 250;
    const trenchW = 300;
    const solids: Solid[] = [
      { x: origin, w: lip, top: GROUND_Y },
      { x: origin + lip, w: trenchW, top: GROUND_Y + 58, trench: true },
      { x: origin + lip + trenchW, w: w - lip - trenchW, top: GROUND_Y },
    ];
    return { w, solids, spawns: placePack(solids, origin, w, stage, rng, false, meleeOnly), decors: decorate(solids, origin, w, stage, rng, 0.4) };
  }
  if (kind === "stairs") {
    const w = 900;
    const steps = [
      { x: 170, w: 130, h: 36 },
      { x: 360, w: 130, h: 64 },
      { x: 550, w: 130, h: 42 },
    ];
    const solids: Solid[] = [];
    let cursor = 0;
    for (const step of steps) {
      if (step.x > cursor) solids.push({ x: origin + cursor, w: step.x - cursor, top: GROUND_Y });
      solids.push({ x: origin + step.x, w: step.w, top: GROUND_Y - step.h });
      cursor = step.x + step.w;
    }
    if (cursor < w) solids.push({ x: origin + cursor, w: w - cursor, top: GROUND_Y });
    return { w, solids, spawns: placePack(solids, origin, w, stage, rng, false, meleeOnly), decors: decorate(solids, origin, w, stage, rng, 0.45) };
  }
  if (kind === "arena" || kind === "boss") {
    const w = kind === "boss" ? 1120 : 980;
    const solids: Solid[] = [{ x: origin, w, top: GROUND_Y }];
    const spawns: SpawnDef[] =
      kind === "boss"
        ? [{ kind: "boss", x: origin + w * 0.68, y: GROUND_Y, delay: 0.35 }]
        : placePack(solids, origin, w, stage, rng, true, meleeOnly);
    return { w, solids, spawns, decors: decorate(solids, origin, w, stage, rng, kind === "boss" ? 0.28 : 0.35) };
  }
  const w = 780;
  const solids: Solid[] = [{ x: origin, w, top: GROUND_Y }];
  return { w, solids, spawns: placePack(solids, origin, w, stage, rng, false, meleeOnly), decors: decorate(solids, origin, w, stage, rng, 0.6) };
}

export function buildLevel(stage: 1 | 2 | 3, seed: number): LevelData {
  const rng = new Rng((seed + stage * 997) >>> 0);
  const kinds =
    stage === 3
      ? [rng.pick(["field", "mounds"]), rng.pick(["trench", "stairs", "mounds"]), "boss"]
      : [rng.pick(["field", "mounds"]), rng.pick(["trench", "stairs", "mounds"]), "arena"];

  const solids: Solid[] = [{ x: 0, w: 300, top: GROUND_Y }];
  const triggers: TriggerDef[] = [];
  const decors: DecorDef[] = decorate(solids, 0, 300, stage, rng, 0.4);
  let cursor = 300;
  let index = 0;
  for (const kind of kinds) {
    const built = segment(kind, cursor, stage, rng, stage === 1 && index === 0);
    index += 1;
    solids.push(...built.solids);
    decors.push(...built.decors);
    if (built.spawns.length > 0) triggers.push({ x: cursor + 80, spawns: built.spawns });
    cursor += built.w;
  }
  solids.push({ x: cursor, w: 220, top: GROUND_Y });
  const portalX = cursor + 110;
  cursor += 220;
  solids.push({ x: -48, w: 48, top: 90 });
  solids.push({ x: cursor, w: 48, top: 90 });
  return {
    stage,
    width: cursor + 48,
    solids,
    triggers,
    decors,
    portalX,
    boss: stage === 3,
  };
}
