export interface BuiltRoom {
  id: string;
  grid: string[][];
}

function grid(w: number, h: number): string[][] {
  const rows: string[][] = [];
  for (let y = 0; y < h; y++) {
    const row = new Array<string>(w).fill('.');
    if (y === 0 || y === h - 1) row.fill('#');
    row[0] = '#';
    row[w - 1] = '#';
    rows.push(row);
  }
  return rows;
}

function set(g: string[][], x: number, y: number, ch: string): void {
  if (y < 1 || x < 1 || y >= g.length - 1 || x >= g[0]!.length - 1) return;
  g[y]![x] = ch;
}

function hline(g: string[][], x: number, y: number, len: number, ch: string): void {
  for (let i = 0; i < len; i++) set(g, x + i, y, ch);
}

function rect(g: string[][], x: number, y: number, w: number, h: number, ch: string): void {
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < w; ix++) set(g, x + ix, y + iy, ch);
  }
}

function decor(g: string[][], spots: Array<[number, number]>): void {
  for (const [x, y] of spots) set(g, x, y, ',');
}

function flatBase(): string[][] {
  return grid(36, 18);
}

function shaftBase(): string[][] {
  return grid(28, 30);
}

export function templateFlatArena(): string[][] {
  const g = flatBase();
  const h = g.length;
  hline(g, 5, h - 5, 8, '=');
  hline(g, 22, h - 5, 8, '=');
  hline(g, 14, h - 9, 8, '=');
  decor(g, [[6, h - 2], [28, h - 2], [17, h - 10]]);
  return g;
}

export function templateFlatPillars(): string[][] {
  const g = flatBase();
  const h = g.length;
  for (const x of [8, 17, 26]) {
    rect(g, x, h - 6, 2, 5, '+');
  }
  hline(g, 11, h - 9, 6, '=');
  hline(g, 20, h - 8, 5, '=');
  decor(g, [[4, h - 2], [32, h - 2]]);
  return g;
}

export function templateFlatStairs(): string[][] {
  const g = flatBase();
  const h = g.length;
  hline(g, 4, h - 5, 6, '=');
  hline(g, 12, h - 8, 6, '=');
  hline(g, 20, h - 5, 6, '=');
  hline(g, 27, h - 9, 6, '=');
  set(g, 15, h - 1, '^');
  set(g, 16, h - 1, '^');
  decor(g, [[7, h - 6], [23, h - 6]]);
  return g;
}

export function templateFlatLedges(): string[][] {
  const g = flatBase();
  const h = g.length;
  hline(g, 4, h - 5, 4, '=');
  hline(g, 11, h - 6, 3, '=');
  hline(g, 17, h - 5, 4, '=');
  hline(g, 24, h - 8, 4, '=');
  hline(g, 30, h - 5, 4, '=');
  hline(g, 14, h - 10, 7, '=');
  decor(g, [[8, h - 2], [20, h - 2]]);
  return g;
}

export function templateFlatPits(): string[][] {
  const g = flatBase();
  const h = g.length;
  for (const x of [10, 11, 23, 24]) set(g, x, h - 1, '^');
  hline(g, 8, h - 5, 6, '=');
  hline(g, 21, h - 5, 6, '=');
  hline(g, 14, h - 9, 8, '=');
  decor(g, [[5, h - 2], [30, h - 2]]);
  return g;
}

export function templateFlatSplit(): string[][] {
  const g = flatBase();
  const h = g.length;
  hline(g, 3, h - 5, 10, '=');
  hline(g, 22, h - 5, 10, '=');
  hline(g, 13, h - 9, 10, '=');
  rect(g, 17, h - 4, 2, 3, '+');
  decor(g, [[6, h - 6], [28, h - 6], [16, h - 2]]);
  return g;
}

export function templateEliteFort(): string[][] {
  const g = flatBase();
  const h = g.length;
  rect(g, 6, h - 6, 2, 5, '+');
  rect(g, 28, h - 6, 2, 5, '+');
  hline(g, 10, h - 5, 5, '=');
  hline(g, 20, h - 5, 5, '=');
  hline(g, 14, h - 9, 8, '=');
  set(g, 16, h - 1, '^');
  set(g, 19, h - 1, '^');
  decor(g, [[4, h - 2], [32, h - 2]]);
  return g;
}

export function templateShaftWell(): string[][] {
  const g = shaftBase();
  const h = g.length;
  const w = g[0]!.length;
  const steps = [h - 5, h - 9, h - 13, h - 17, h - 21, h - 25];
  steps.forEach((y, i) => {
    const x = i % 2 === 0 ? 3 : w - 11;
    hline(g, x, y, 8, '=');
  });
  hline(g, Math.floor(w / 2) - 4, 5, 8, '=');
  decor(g, [[4, h - 2], [w - 5, h - 2], [6, h - 10]]);
  return g;
}

export function templateShaftZigZag(): string[][] {
  const g = shaftBase();
  const h = g.length;
  const w = g[0]!.length;
  hline(g, 3, h - 5, 7, '=');
  hline(g, w - 11, h - 9, 7, '=');
  hline(g, 4, h - 13, 6, '=');
  hline(g, w - 12, h - 17, 8, '=');
  hline(g, 5, h - 21, 6, '=');
  hline(g, w - 11, h - 25, 7, '=');
  hline(g, Math.floor(w / 2) - 4, 4, 8, '=');
  decor(g, [[8, h - 2], [18, h - 6]]);
  return g;
}

export function templateShaftStacks(): string[][] {
  const g = shaftBase();
  const h = g.length;
  for (const y of [h - 5, h - 9, h - 13]) hline(g, 3, y, 6, '=');
  for (const y of [h - 7, h - 11, h - 15, h - 19]) hline(g, 18, y, 6, '=');
  hline(g, 10, h - 23, 8, '=');
  hline(g, 8, 5, 10, '=');
  decor(g, [[5, h - 2], [22, h - 2]]);
  return g;
}

export function templateBossArena(): string[][] {
  const g = grid(48, 18);
  const h = g.length;
  hline(g, 6, h - 5, 7, '=');
  hline(g, 35, h - 5, 7, '=');
  hline(g, 20, h - 8, 8, '=');
  rect(g, 4, h - 5, 2, 4, '+');
  rect(g, 42, h - 5, 2, 4, '+');
  decor(g, [[10, h - 2], [24, h - 2], [36, h - 2]]);
  return g;
}

export function templateShop(): string[][] {
  const g = grid(32, 17);
  const h = g.length;
  rect(g, 20, h - 4, 6, 3, '+');
  hline(g, 5, h - 6, 6, '=');
  set(g, 12, h - 2, 'N');
  decor(g, [[7, h - 2], [26, h - 5]]);
  return g;
}

export function templateRest(): string[][] {
  const g = grid(32, 17);
  const h = g.length;
  hline(g, 6, h - 6, 5, '=');
  hline(g, 20, h - 6, 5, '=');
  set(g, 16, h - 2, 'R');
  decor(g, [[8, h - 2], [23, h - 2], [16, h - 7]]);
  return g;
}

export function templateTreasure(): string[][] {
  const g = grid(30, 16);
  const h = g.length;
  hline(g, 5, h - 5, 5, '=');
  hline(g, 19, h - 5, 5, '=');
  set(g, 14, h - 2, 'T');
  decor(g, [[8, h - 2], [21, h - 2]]);
  return g;
}

export function templateStart(): string[][] {
  const g = grid(34, 17);
  const h = g.length;
  hline(g, 6, h - 5, 6, '=');
  hline(g, 21, h - 5, 6, '=');
  set(g, 16, h - 2, 'L');
  decor(g, [[5, h - 2], [28, h - 2], [16, h - 6]]);
  return g;
}

export function templateSecret(): string[][] {
  const g = grid(26, 16);
  const h = g.length;
  hline(g, 5, h - 5, 5, '=');
  hline(g, 15, h - 6, 5, '=');
  set(g, 12, h - 2, 'T');
  decor(g, [[7, h - 2], [18, h - 2]]);
  return g;
}

export function templateEvent(): string[][] {
  const g = grid(32, 17);
  const h = g.length;
  hline(g, 6, h - 6, 5, '=');
  hline(g, 20, h - 6, 5, '=');
  set(g, 16, h - 2, 'E');
  decor(g, [[9, h - 2], [22, h - 2]]);
  return g;
}

export function templateTutorial(): string[][] {
  const g = grid(34, 17);
  const h = g.length;
  hline(g, 8, h - 6, 6, '=');
  hline(g, 20, h - 8, 7, '=');
  decor(g, [[5, h - 2], [28, h - 2]]);
  return g;
}

export const FLAT_TEMPLATES: Array<{ id: string; build: () => string[][] }> = [
  { id: 'flat_arena', build: templateFlatArena },
  { id: 'flat_pillars', build: templateFlatPillars },
  { id: 'flat_stairs', build: templateFlatStairs },
  { id: 'flat_ledges', build: templateFlatLedges },
  { id: 'flat_pits', build: templateFlatPits },
  { id: 'flat_split', build: templateFlatSplit },
];

export const SHAFT_TEMPLATES: Array<{ id: string; build: () => string[][] }> = [
  { id: 'shaft_well', build: templateShaftWell },
  { id: 'shaft_zig', build: templateShaftZigZag },
  { id: 'shaft_stacks', build: templateShaftStacks },
];

export const ELITE_TEMPLATES: Array<{ id: string; build: () => string[][] }> = [
  { id: 'elite_fort', build: templateEliteFort },
  { id: 'flat_pillars', build: templateFlatPillars },
  { id: 'flat_pits', build: templateFlatPits },
];

export function cloneGrid(src: string[][]): string[][] {
  return src.map((row) => row.slice());
}
