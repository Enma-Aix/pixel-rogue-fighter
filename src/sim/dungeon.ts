import { TILE } from '../core/constants';
import { hashStr, shuffle } from '../core/math';
import { mulberry32, pick } from '../core/rng';
import type { BiomeId, Dir, Floor, Prop, Room, RoomType, Spawn } from '../core/types';
import { biomeAt } from '../data/biomes';
import { enemyDef } from '../data/enemies';
import { EVENTS } from '../data/events';
import {
  ELITE_TEMPLATES,
  FLAT_TEMPLATES,
  SHAFT_TEMPLATES,
  cloneGrid,
  templateBossArena,
  templateEvent,
  templateRest,
  templateSecret,
  templateShop,
  templateStart,
  templateTreasure,
} from '../data/rooms';

const DIRS: Array<[number, number, Dir]> = [
  [1, 0, 'r'],
  [-1, 0, 'l'],
  [0, 1, 'd'],
  [0, -1, 'u'],
];

interface Link {
  a: string;
  b: string;
  secret: boolean;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function parse(k: string): { x: number; y: number } {
  const [xs, ys] = k.split(',');
  return { x: Number(xs), y: Number(ys) };
}

function opposite(d: Dir): Dir {
  if (d === 'l') return 'r';
  if (d === 'r') return 'l';
  if (d === 'u') return 'd';
  return 'u';
}

function dirOf(from: string, to: string): Dir {
  const a = parse(from);
  const b = parse(to);
  if (b.x > a.x) return 'r';
  if (b.x < a.x) return 'l';
  if (b.y > a.y) return 'd';
  return 'u';
}

function linked(links: Link[], a: string, b: string): boolean {
  return links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
}

function adjOf(links: Link[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const list = m.get(a) ?? [];
    list.push(b);
    m.set(a, list);
  };
  for (const l of links) {
    add(l.a, l.b);
    add(l.b, l.a);
  }
  return m;
}

function bfs(start: string, adj: Map<string, string[]>): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift()!;
    const d = dist.get(cur)!;
    for (const n of adj.get(cur) ?? []) {
      if (dist.has(n)) continue;
      dist.set(n, d + 1);
      q.push(n);
    }
  }
  return dist;
}

function shortest(start: string, goal: string, adj: Map<string, string[]>): string[] {
  const prev = new Map<string, string | null>([[start, null]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    for (const n of adj.get(cur) ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      q.push(n);
    }
  }
  const path: string[] = [];
  let c: string | null | undefined = goal;
  if (!prev.has(goal) && goal !== start) return [start];
  while (c) {
    path.push(c);
    c = prev.get(c) ?? null;
  }
  path.reverse();
  return path;
}

function carve(room: Room): void {
  const g = room.grid;
  const h = g.length;
  const w = g[0]!.length;
  const openRows = [h - 4, h - 3, h - 2];
  const punchSide = (x: number, secret: boolean) => {
    for (const y of openRows) {
      if (y <= 0 || y >= h - 1) continue;
      g[y]![x] = secret ? 'x' : '.';
      const inner = x === 0 ? 1 : w - 2;
      if (g[y]![inner] === '#' || g[y]![inner] === 'x') g[y]![inner] = secret ? 'x' : '.';
    }
  };
  if (room.doors.l) punchSide(0, !!room.secret.l);
  if (room.doors.r) punchSide(w - 1, !!room.secret.r);

  // Keep the up-ladder off the down-hole so a climb has solid ground under it.
  const mid = Math.floor(w / 2);
  const upX = room.type === 'boss' ? 8 : Math.max(4, mid - 4);
  const downX = room.type === 'boss' ? mid : Math.min(w - 5, mid + 3);
  room.upTile = upX;
  room.downTile = downX;

  if (room.doors.u) {
    const secret = !!room.secret.u;
    for (const dx of [-1, 0, 1]) {
      for (const y of [0, 1]) {
        const x = upX + dx;
        if (x <= 0 || x >= w - 1) continue;
        if (y === 0) g[0]![x] = secret ? 'x' : '.';
        else if (g[y]![x] === '#' || g[y]![x] === 'x') g[y]![x] = secret ? 'x' : '.';
      }
    }
    if (!secret) {
      for (let y = 2; y <= 6; y++) {
        for (const dx of [-1, 0, 1]) {
          const x = upX + dx;
          if (x <= 0 || x >= w - 1 || y >= h - 1) continue;
          if (g[y]![x] === '#' || g[y]![x] === '+') g[y]![x] = '.';
        }
      }
      // Step up from the floor. Fixed rows left short rooms with no jumpable step.
      const ladder: number[] = [];
      for (let y = h - 5; y > 2; y -= 4) ladder.push(y);
      for (const y of ladder) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = upX + dx;
          if (x <= 1 || x >= w - 2) continue;
          if (g[y]![x] === '.') g[y]![x] = '=';
        }
      }
    }
  }

  if (room.doors.d) {
    const secret = !!room.secret.d;
    for (const dx of [-1, 0, 1]) {
      const x = downX + dx;
      if (x <= 0 || x >= w - 1) continue;
      g[h - 1]![x] = secret ? 'x' : 'o';
    }
  }
}

function extractProps(room: Room): void {
  const props: Prop[] = [];
  const h = room.grid.length;
  const floorY = (h - 1) * TILE;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < room.grid[0]!.length; x++) {
      const ch = room.grid[y]![x]!;
      let kind: Prop['kind'] | null = null;
      if (ch === 'T') kind = 'chest';
      else if (ch === 'R') kind = 'shrine';
      else if (ch === 'N') kind = 'npc';
      else if (ch === 'L') kind = 'lore';
      else if (ch === 'E') kind = 'event';
      if (!kind) continue;
      room.grid[y]![x] = '.';
      props.push({ kind, x: x * TILE + TILE / 2, y: floorY });
    }
  }
  room.props = props;
}

function standSpots(room: Room): number[] {
  const h = room.h;
  const y = h - 1;
  const xs: number[] = [];
  const cx = Math.floor(room.w / 2);
  for (let x = 3; x < room.w - 3; x++) {
    const floor = room.grid[y]![x];
    if (floor !== '#') continue;
    if (Math.abs(x - cx) <= 2) continue;
    // The player arrives on the left. Keep the first steps clear.
    if (x < 9) continue;
    let open = true;
    for (let k = 1; k <= 3; k++) {
      const ch = room.grid[y - k]?.[x];
      if (ch === '#' || ch === '+' || ch === 'x') open = false;
    }
    if (open) xs.push(x * TILE + TILE / 2);
  }
  return xs;
}

function planSpawns(room: Room, floorIndex: number, rng: () => number): Spawn[] {
  if (room.type !== 'combat' && room.type !== 'elite' && room.type !== 'boss') return [];
  const biome = biomeAt(floorIndex);
  const spots = standSpots(room);
  if (!spots.length) return [];
  const shuffled = shuffle(spots, rng);
  const take = (n: number) => shuffled.slice(0, Math.min(n, shuffled.length));
  const y = (room.h - 1) * TILE - 0.01;
  const flyY = 6 * TILE;
  if (room.type === 'boss') {
    return [{ kind: biome.boss, x: room.w * TILE * 0.62, y }];
  }
  if (room.type === 'elite') {
    const pts = take(2);
    const out: Spawn[] = [{ kind: biome.elite, x: pts[0] ?? room.w * TILE * 0.5, y }];
    if (pts[1]) out.push({ kind: biome.enemies[0]!, x: pts[1], y });
    return out;
  }
  let n = floorIndex === 0 ? 2 : 3;
  if (floorIndex === 2 && rng() < 0.45) n = 4;
  const pts = take(n);
  return pts.map((x, i) => {
    const kind = biome.enemies[i % biome.enemies.length]!;
    const def = enemyDef(kind);
    return { kind, x, y: def.fly ? flyY : y };
  });
}

function chooseTemplate(room: Room, rng: () => number): { id: string; grid: string[][] } {
  if (room.type === 'boss') return { id: 'boss_arena', grid: cloneGrid(templateBossArena()) };
  if (room.type === 'shop') return { id: 'shop', grid: cloneGrid(templateShop()) };
  if (room.type === 'rest') return { id: 'rest', grid: cloneGrid(templateRest()) };
  if (room.type === 'treasure') return { id: 'treasure', grid: cloneGrid(templateTreasure()) };
  if (room.type === 'start') return { id: 'start', grid: cloneGrid(templateStart()) };
  if (room.type === 'secret') return { id: 'secret', grid: cloneGrid(templateSecret()) };
  if (room.type === 'event') return { id: 'event', grid: cloneGrid(templateEvent()) };
  const vertical = !!(room.doors.u || room.doors.d);
  if (room.type === 'elite' && !vertical) {
    const t = pick(rng, ELITE_TEMPLATES);
    return { id: t.id, grid: cloneGrid(t.build()) };
  }
  const pool = vertical ? SHAFT_TEMPLATES : FLAT_TEMPLATES;
  const t = pick(rng, pool);
  return { id: t.id, grid: cloneGrid(t.build()) };
}

function validate(floor: Floor, links: Link[]): boolean {
  if (floor.rooms.length < 9) return false;
  const types = new Set(floor.rooms.map((r) => r.type));
  for (const need of ['start', 'boss', 'shop', 'rest', 'treasure', 'event', 'elite', 'combat', 'secret'] as RoomType[]) {
    if (!types.has(need)) return false;
  }
  const xs = new Set(floor.rooms.map((r) => r.gx));
  const ys = new Set(floor.rooms.map((r) => r.gy));
  if (xs.size < 3 || ys.size < 3) return false;
  let vert = 0;
  let horiz = 0;
  for (const l of links) {
    if (l.secret) continue;
    const a = parse(l.a);
    const b = parse(l.b);
    if (a.x !== b.x) horiz++;
    if (a.y !== b.y) vert++;
  }
  if (vert < 2 || horiz < 2) return false;
  const start = floor.rooms.find((r) => r.type === 'start');
  const boss = floor.rooms.find((r) => r.type === 'boss');
  if (!start || !boss) return false;
  const adj = adjOf(links);
  const dist = bfs(key(start.gx, start.gy), adj);
  if ((dist.get(key(boss.gx, boss.gy)) ?? 0) < 3) return false;
  const neighborCombat = (adj.get(key(start.gx, start.gy)) ?? []).some((k) => {
    const room = floor.rooms.find((r) => r.gx === parse(k).x && r.gy === parse(k).y);
    return room?.type === 'combat';
  });
  if (!neighborCombat) return false;
  for (const room of floor.rooms) {
    const ks = Object.keys(room.doors);
    if (!ks.length) return false;
  }
  return true;
}

function tryGenerate(seed: number, index: number): { floor: Floor; links: Link[] } | null {
  const rng = mulberry32((seed + index * 7919 + 17) >>> 0);
  const GW = 8;
  const GH = 5;
  const target = 11 + index;
  const sx = 1;
  const sy = 2;
  const cells: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
  const occ = new Set<string>([key(sx, sy)]);
  const parent = new Map<string, string>();
  const frontier: Array<{ x: number; y: number; px: number; py: number }> = [];
  const pushF = (x: number, y: number) => {
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      if (occ.has(key(nx, ny))) continue;
      frontier.push({ x: nx, y: ny, px: x, py: y });
    }
  };
  pushF(sx, sy);
  let guard = 0;
  while (cells.length < target && frontier.length && guard++ < 800) {
    const i = Math.floor(rng() * frontier.length);
    const f = frontier.splice(i, 1)[0]!;
    const k = key(f.x, f.y);
    if (occ.has(k)) continue;
    occ.add(k);
    cells.push({ x: f.x, y: f.y });
    parent.set(k, key(f.px, f.py));
    pushF(f.x, f.y);
  }
  if (cells.length < 9) return null;

  const links: Link[] = [];
  for (const [c, p] of parent) links.push({ a: c, b: p, secret: false });
  let loops = 0;
  for (const c of shuffle(cells, rng)) {
    if (loops >= 2) break;
    for (const [dx, dy] of shuffle(DIRS, rng)) {
      const nk = key(c.x + dx, c.y + dy);
      const ck = key(c.x, c.y);
      if (!occ.has(nk) || linked(links, ck, nk)) continue;
      links.push({ a: ck, b: nk, secret: false });
      loops++;
      break;
    }
  }

  let secretKey: string | null = null;
  outer: for (const c of shuffle(cells, rng)) {
    if (c.x === sx && c.y === sy) continue;
    for (const [dx, dy] of shuffle(DIRS, rng)) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const nk = key(nx, ny);
      if (occ.has(nk)) continue;
      secretKey = nk;
      occ.add(nk);
      cells.push({ x: nx, y: ny });
      links.push({ a: key(c.x, c.y), b: nk, secret: true });
      break outer;
    }
  }
  if (!secretKey) return null;

  const adj = adjOf(links);
  const startK = key(sx, sy);
  const dist = bfs(startK, adj);
  let boss = '';
  let best = -1;
  for (const c of cells) {
    const k = key(c.x, c.y);
    if (k === secretKey) continue;
    const d = dist.get(k) ?? 0;
    if (d > best) {
      best = d;
      boss = k;
    }
  }
  if (best < 3 || !boss) return null;

  const types = new Map<string, RoomType>();
  types.set(startK, 'start');
  types.set(boss, 'boss');
  types.set(secretKey, 'secret');

  let elite = '';
  let eliteScore = 1e9;
  const want = Math.max(3, best - 1);
  for (const c of cells) {
    const k = key(c.x, c.y);
    if (types.has(k)) continue;
    const d = dist.get(k) ?? 0;
    if (d < 2) continue;
    const score = Math.abs(d - want);
    if (score < eliteScore) {
      eliteScore = score;
      elite = k;
    }
  }
  if (!elite) return null;
  types.set(elite, 'elite');

  const path = new Set(shortest(startK, boss, adj));
  const pool = cells.map((c) => key(c.x, c.y)).filter((k) => !types.has(k));
  const branches = shuffle(pool.filter((k) => !path.has(k)), rng);
  const main = shuffle(pool.filter((k) => path.has(k) && (dist.get(k) ?? 0) > 1), rng);
  const near = shuffle(pool.filter((k) => (dist.get(k) ?? 0) <= 1), rng);
  const seenOrder = new Set<string>();
  const order: string[] = [];
  for (const k of [...branches, ...main, ...near]) {
    if (seenOrder.has(k)) continue;
    seenOrder.add(k);
    order.push(k);
  }
  const specials: RoomType[] = ['shop', 'rest', 'treasure', 'event'];
  let si = 0;
  for (const k of order) {
    if (si < specials.length) types.set(k, specials[si++]!);
    else types.set(k, 'combat');
  }
  if (si < specials.length) return null;

  const startNeighbors = adj.get(startK) ?? [];
  if (!startNeighbors.some((k) => types.get(k) === 'combat')) {
    const n = startNeighbors.find((k) => {
      const t = types.get(k);
      return t && t !== 'boss' && t !== 'elite' && t !== 'secret' && t !== 'start';
    });
    if (!n) return null;
    const prev = types.get(n)!;
    types.set(n, 'combat');
    if (specials.includes(prev)) {
      const host = [...types.entries()].find(([k, t]) => t === 'combat' && k !== n && (dist.get(k) ?? 0) > 1);
      if (!host) return null;
      types.set(host[0], prev);
    }
  }

  const biome = biomeAt(index);
  const rooms: Room[] = [];
  for (const c of cells) {
    const id = `${index}:${c.x},${c.y}`;
    const k = key(c.x, c.y);
    const type = types.get(k) ?? 'combat';
    const doors: Room['doors'] = {};
    const secret: Room['secret'] = {};
    for (const l of links) {
      const other = l.a === k ? l.b : l.b === k ? l.a : null;
      if (!other) continue;
      const d = dirOf(k, other);
      const [ox, oy] = other.split(',').map(Number);
      doors[d] = `${index}:${ox},${oy}`;
      if (l.secret) secret[d] = true;
    }
    const draft: Room = {
      id,
      gx: c.x,
      gy: c.y,
      type,
      templateId: '',
      grid: [],
      w: 0,
      h: 0,
      doors,
      secret,
      secretOpen: false,
      explored: false,
      seen: false,
      cleared: type === 'start' || type === 'shop' || type === 'rest' || type === 'treasure' || type === 'event' || type === 'secret',
      locked: false,
      spawns: [],
      props: [],
      upTile: 0,
      downTile: 0,
    };
    const tplRng = mulberry32(hashStr(`${seed}:${id}:tpl`) >>> 0);
    const tpl = chooseTemplate(draft, tplRng);
    draft.templateId = tpl.id;
    draft.grid = tpl.grid;
    draft.w = tpl.grid[0]!.length;
    draft.h = tpl.grid.length;
    carve(draft);
    extractProps(draft);
    if (type === 'event') {
      const ev = pick(mulberry32(hashStr(`${seed}:${id}:ev`)), EVENTS);
      draft.eventId = ev.id;
    }
    const spawnRng = mulberry32(hashStr(`${seed}:${id}:sp`) >>> 0);
    draft.spawns = planSpawns(draft, index, spawnRng);
    rooms.push(draft);
  }

  const floor: Floor = {
    index,
    biome: biome.id,
    rooms,
    startId: `${index}:${sx},${sy}`,
    bossId: `${index}:${parse(boss).x},${parse(boss).y}`,
  };
  if (!validate(floor, links)) return null;
  return { floor, links };
}

function fallback(seed: number, index: number): Floor {
  const biome: BiomeId = biomeAt(index).id;
  const specs: Array<{ x: number; y: number; type: RoomType; doors: Array<[Dir, number, number]> }> = [
    { x: 0, y: 1, type: 'start', doors: [['r', 1, 1]] },
    { x: 1, y: 1, type: 'combat', doors: [['l', 0, 1], ['r', 2, 1], ['u', 1, 0]] },
    { x: 2, y: 1, type: 'elite', doors: [['l', 1, 1], ['d', 2, 2], ['r', 3, 1]] },
    { x: 1, y: 0, type: 'treasure', doors: [['d', 1, 1], ['r', 2, 0]] },
    { x: 2, y: 0, type: 'shop', doors: [['l', 1, 0]] },
    { x: 2, y: 2, type: 'rest', doors: [['u', 2, 1], ['l', 1, 2]] },
    { x: 1, y: 2, type: 'event', doors: [['r', 2, 2], ['d', 1, 3]] },
    { x: 1, y: 3, type: 'combat', doors: [['u', 1, 2], ['r', 2, 3]] },
    { x: 2, y: 3, type: 'boss', doors: [['l', 1, 3]] },
    { x: 3, y: 1, type: 'secret', doors: [['l', 2, 1]] },
  ];
  // secret link is secret
  const rooms: Room[] = specs.map((s) => {
    const id = `${index}:${s.x},${s.y}`;
    const doors: Room['doors'] = {};
    const secret: Room['secret'] = {};
    for (const [d, tx, ty] of s.doors) {
      doors[d] = `${index}:${tx},${ty}`;
      if (s.type === 'secret' || (tx === 3 && ty === 1)) secret[d] = true;
    }
    const draft: Room = {
      id,
      gx: s.x,
      gy: s.y,
      type: s.type,
      templateId: 'fallback',
      grid: [],
      w: 0,
      h: 0,
      doors,
      secret,
      secretOpen: false,
      explored: false,
      seen: false,
      cleared: s.type === 'start' || s.type === 'shop' || s.type === 'rest' || s.type === 'treasure' || s.type === 'event' || s.type === 'secret',
      locked: false,
      spawns: [],
      props: [],
      upTile: 0,
      downTile: 0,
      eventId: s.type === 'event' ? 'fountain' : undefined,
    };
    const tpl = chooseTemplate(draft, mulberry32(seed + index));
    draft.templateId = s.type === 'combat' || s.type === 'elite' ? tpl.id : tpl.id;
    draft.grid = tpl.grid;
    draft.w = tpl.grid[0]!.length;
    draft.h = tpl.grid.length;
    carve(draft);
    extractProps(draft);
    draft.spawns = planSpawns(draft, index, mulberry32(hashStr(`fb:${seed}:${id}`)));
    return draft;
  });
  return {
    index,
    biome,
    rooms,
    startId: `${index}:0,1`,
    bossId: `${index}:2,3`,
  };
}

export function generateFloor(seed: number, index: number): Floor {
  for (let attempt = 0; attempt < 40; attempt++) {
    const made = tryGenerate(seed + attempt * 104729, index);
    if (made) return made.floor;
  }
  return fallback(seed, index);
}

export function generateDungeon(seed: number): Floor[] {
  return [0, 1, 2].map((i) => generateFloor(seed, i));
}

export function debugMap(floor: Floor): string {
  let maxX = 0;
  let maxY = 0;
  for (const r of floor.rooms) {
    maxX = Math.max(maxX, r.gx);
    maxY = Math.max(maxY, r.gy);
  }
  const rows: string[] = [];
  const letter: Record<RoomType, string> = {
    start: 'S', combat: 'c', elite: 'E', treasure: 'T', shop: '$', event: '?', rest: 'R', secret: '*', boss: 'B',
  };
  for (let y = 0; y <= maxY; y++) {
    let line = '';
    for (let x = 0; x <= maxX; x++) {
      const room = floor.rooms.find((r) => r.gx === x && r.gy === y);
      line += room ? letter[room.type] : '.';
    }
    rows.push(line);
  }
  return rows.join('\n');
}

export function oppositeDir(d: Dir): Dir {
  return opposite(d);
}
