import type { BiomeId, Room } from '../core/types';
import { TILE } from '../core/constants';
import { BIOMES, type BiomeColors } from '../data/biomes';
import { blob, Pix, hash2, mix } from './pix';

function hex(c: string): number {
  return Number.parseInt(c.slice(1), 16);
}

function solid(ch: string | undefined): boolean {
  return ch === '#' || ch === '+' || ch === 'x' || ch === '^' || ch === '~';
}

function wallish(ch: string | undefined): boolean {
  return ch === '#' || ch === 'x' || ch === '+';
}

export function bakeRoom(room: Room, biome: BiomeId): HTMLCanvasElement {
  const colors = BIOMES[biome].colors;
  const pix = new Pix(room.w * TILE, room.h * TILE);
  const paint: Paint = {
    biome,
    wall: hex(colors.wall),
    wall2: hex(colors.wall2),
    wallHi: hex(colors.wallHi),
    floor: hex(colors.floor),
    floor2: hex(colors.floor2),
    platform: hex(colors.platform),
    accent: hex(colors.accent),
    hazard: hex(colors.hazard),
    decor: hex(colors.decor),
    deep: hex(colors.deep),
    bg: hex(colors.bg),
    bg2: hex(colors.bg2),
  };
  paintBackdrop(pix, room, paint);
  for (let y = 0; y < room.h; y++) {
    for (let x = 0; x < room.w; x++) {
      const ch = room.grid[y]![x]!;
      paintTile(pix, x, y, ch, room, paint);
    }
  }
  paintAirDecor(pix, room, paint);
  paintLamps(pix, room, paint);
  return pix.toCanvas();
}

function paintBackdrop(pix: Pix, room: Room, c: Paint): void {
  const w = room.w * TILE;
  const h = room.h * TILE;
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const sky = mix(c.bg2, c.wall, c.biome === 'sanctum' ? 0.28 : 0.38);
    const ground = mix(c.bg2, c.deep, 0.4);
    let row = mix(sky, ground, Math.pow(t, 0.72));
    const horizon = Math.exp(-((t - 0.62) ** 2) * 18);
    const glow = c.biome === 'molten' ? c.accent : c.biome === 'sanctum' ? c.wallHi : c.wall;
    row = mix(row, glow, horizon * (c.biome === 'molten' ? 0.28 : 0.12));
    pix.rect(0, y, w, 1, row);
  }
  paintScenery(pix, room, c);
}

function paintScenery(pix: Pix, room: Room, c: Paint): void {
  const w = room.w * TILE;
  const h = room.h * TILE;
  const far = mix(c.deep, c.bg2, 0.55);
  const farHi = mix(far, c.wall, 0.35);
  if (c.biome === 'ash') {
    blob(pix, w - 56, 42, 11, 11, mix(c.wallHi, c.bg2, 0.35));
    blob(pix, w - 50, 40, 9, 9, mix(c.bg2, c.bg, 0.4));
    for (let i = 0; i < 4; i++) {
      const x = 28 + Math.floor((i * (w - 70)) / 3);
      arch(pix, x, Math.floor(h * 0.42), 40, Math.floor(h * 0.38), far, farHi);
    }
    for (let i = 0; i < 6; i++) {
      const x = 20 + ((i * 97) % Math.max(40, w - 40));
      pix.rect(x, 18, 1, 10 + (i % 3) * 4, mix(c.decor, c.deep, 0.45));
    }
  } else if (c.biome === 'molten') {
    pix.rect(0, h - 52, w, 28, mix(c.accent, c.deep, 0.72), 90);
    for (let i = 0; i < 7; i++) {
      const x = 16 + Math.floor((i * (w - 36)) / 6);
      const hh = 28 + (hash2(i, 3) % 36);
      pix.rect(x, 16, 8, hh, far);
      pix.rect(x, 16 + hh - 4, 8, 4, mix(c.hazard, c.deep, 0.35));
      pix.px(x + 3, 16 + hh, c.accent);
    }
  } else {
    for (let i = 0; i < 50; i++) {
      const x = hash2(i, 2) % w;
      const y = hash2(i, 6) % Math.floor(h * 0.55);
      pix.px(x, y, i % 5 === 0 ? c.accent : c.wallHi, 160 + (i % 4) * 20);
    }
    for (let i = 0; i < 5; i++) {
      const x = 24 + Math.floor((i * (w - 48)) / 4);
      pix.rect(x, 20, 6, h - 70, far);
      pix.rect(x, 20, 6, 3, farHi);
      pix.rect(x - 4, 28, 14, 3, far);
    }
    blob(pix, Math.floor(w * 0.3), 48, 16, 16, mix(c.wall, c.bg, 0.2), 80);
    blob(pix, Math.floor(w * 0.3), 48, 10, 10, c.bg, 120);
  }
}

function arch(pix: Pix, x: number, y: number, w: number, h: number, color: number, hi: number): void {
  pix.rect(x, y, 5, h, color);
  pix.rect(x + w - 5, y, 5, h, color);
  pix.rect(x, y, w, 4, color);
  pix.rect(x + 4, y - 3, w - 8, 4, color);
  pix.rect(x + 8, y - 5, w - 16, 3, color);
  pix.rect(x, y, 5, 2, hi);
  pix.rect(x + w - 5, y, 2, h, mix(color, 0x000000, 0.25));
}

function paintLamps(pix: Pix, room: Room, c: Paint): void {
  const spots: Array<[number, number]> = [];
  for (let x = 2; x < room.w - 2; x++) {
    if (room.grid[0]?.[x] !== '#') continue;
    if ((x + room.h * 3) % 7 !== 0) continue;
    if (!solid(room.grid[1]?.[x])) spots.push([x * TILE + 8, TILE + 2]);
  }
  for (let y = 2; y < room.h - 2; y++) {
    if (room.grid[y]?.[0] === '#' && !solid(room.grid[y]?.[1]) && y % 5 === 2) {
      spots.push([TILE + 2, y * TILE + 6]);
    }
  }
  for (const [x, y] of spots) {
    wash(pix, x, y + 10, 36, c.accent, 88);
    wash(pix, x, y + 6, 12, 0xfff1c2, 120);
    for (let i = 0; i < 36; i++) pix.rect(x, y + 4 + i, 2, 1, c.accent, Math.max(8, 28 - Math.floor(i * 0.7)));
    pix.rect(x - 2, y + 4, 6, 2, mix(c.wall, c.deep, 0.2));
    pix.rect(x - 1, y, 3, 5, c.accent);
    pix.rect(x, y - 2, 1, 3, 0xfff1c2);
    pix.px(x, y - 3, 0xffffff);
  }
}

function wash(pix: Pix, cx: number, cy: number, r: number, color: number, a: number): void {
  const r2 = r * r;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d > r2) continue;
      const k = 1 - Math.sqrt(d) / r;
      pix.px(cx + x, cy + y, color, Math.floor(a * k * k));
    }
  }
}

interface Paint {
  biome: BiomeId;
  wall: number;
  wall2: number;
  wallHi: number;
  floor: number;
  floor2: number;
  platform: number;
  accent: number;
  hazard: number;
  decor: number;
  deep: number;
  bg: number;
  bg2: number;
}

function paintTile(pix: Pix, tx: number, ty: number, ch: string, room: Room, c: Paint): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const up = room.grid[ty - 1]?.[tx];
  const down = room.grid[ty + 1]?.[tx];
  const left = room.grid[ty]?.[tx - 1];
  const right = room.grid[ty]?.[tx + 1];
  const n = hash2(tx, ty);
  const edge = tx === 0 || tx === room.w - 1 || ty === 0;
  if ((ch === '.' || ch === ',') && edge) {
    pix.rect(x, y, TILE, TILE, c.deep);
    if (tx === 0) pix.rect(x + TILE - 3, y, 3, TILE, c.accent);
    else if (tx === room.w - 1) pix.rect(x, y, 3, TILE, c.accent);
    else pix.rect(x, y + TILE - 3, TILE, 3, c.accent);
    pix.rect(tx === 0 ? x + TILE - 1 : tx === room.w - 1 ? x : x, ty === 0 ? y + TILE - 1 : y, tx === 0 || tx === room.w - 1 ? 1 : TILE, ty === 0 ? 1 : TILE, c.wallHi);
    return;
  }
  if (ch === '#' || ch === 'x') {
    paintWall(pix, x, y, n, c, !wallish(up), !wallish(left), !wallish(right), !wallish(down) && down !== undefined);
    const ul = room.grid[ty - 1]?.[tx - 1];
    const ur = room.grid[ty - 1]?.[tx + 1];
    if (wallish(up) && wallish(left) && !wallish(ul)) {
      pix.px(x, y, mix(c.wall2, c.deep, 0.4));
      pix.px(x + 1, y, mix(c.wall, c.deep, 0.25));
      pix.px(x, y + 1, mix(c.wall, c.deep, 0.25));
    }
    if (wallish(up) && wallish(right) && !wallish(ur)) {
      pix.px(x + 15, y, mix(c.wall2, c.deep, 0.4));
      pix.px(x + 14, y, mix(c.wall, c.deep, 0.25));
    }
    if (ch === 'x') {
      pix.line(x + 3, y + 2, x + 8, y + 8, 0x1a1020);
      pix.line(x + 8, y + 8, x + 5, y + 14, 0x1a1020);
      pix.line(x + 8, y + 7, x + 13, y + 4, 0x1a1020);
      pix.px(x + 8, y + 8, c.accent);
      pix.px(x + 9, y + 8, 0xfff1c2);
    }
    return;
  }
  if (ch === '+') {
    const top = !wallish(up);
    const bot = !wallish(down);
    pix.rect(x + 2, y, 12, TILE, c.wall);
    pix.rect(x + 3, y, 3, TILE, mix(c.wall, c.wallHi, 0.28));
    pix.rect(x + 12, y, 2, TILE, mix(c.wall, c.deep, 0.35));
    pix.rect(x + 6, y + 5, 4, 2, mix(c.wall, c.deep, 0.35));
    if (top) {
      pix.rect(x, y, TILE, 4, c.floor);
      pix.rect(x, y, TILE, 1, c.wallHi);
      pix.rect(x + 1, y + 3, 14, 1, mix(c.floor, c.deep, 0.3));
    }
    if (bot) {
      pix.rect(x, y + TILE - 3, TILE, 3, c.floor2);
      pix.rect(x, y + TILE - 1, TILE, 1, mix(c.floor2, c.deep, 0.4));
    }
    return;
  }
  if (ch === '=') {
    const L = left === '=';
    const R = right === '=';
    const x0 = L ? 0 : 2;
    const x1 = R ? TILE : TILE - 2;
    pix.rect(x + x0, y, x1 - x0, 5, c.platform);
    pix.rect(x + x0, y, x1 - x0, 1, c.wallHi);
    pix.rect(x + x0, y + 4, x1 - x0, 1, mix(c.platform, c.deep, 0.45));
    if (!L) {
      pix.px(x + 2, y, c.wallHi);
      pix.rect(x + 3, y + 5, 2, 3, mix(c.platform, c.deep, 0.25));
    }
    if (!R) {
      pix.px(x + TILE - 3, y, c.wallHi);
      pix.rect(x + TILE - 5, y + 5, 2, 3, mix(c.platform, c.deep, 0.25));
    }
    if ((n & 3) === 0) pix.px(x + 8, y + 2, mix(c.platform, c.deep, 0.4));
    return;
  }
  if (ch === '^') {
    const base = !solid(up) ? y + 4 : y + 1;
    pix.rect(x, base + 9, TILE, 3, mix(c.hazard, c.deep, 0.55));
    for (const ox of [1, 6, 11]) {
      pix.line(x + ox, base + 9, x + ox + 2, base, c.hazard);
      pix.line(x + ox + 4, base + 9, x + ox + 2, base, c.hazard);
      pix.line(x + ox + 1, base + 9, x + ox + 2, base + 1, mix(c.hazard, 0xffffff, 0.35));
      pix.px(x + ox + 2, base, mix(c.hazard, 0xffffff, 0.55));
    }
    return;
  }
  if (ch === '~') {
    pix.rect(x, y + 5, TILE, 11, c.hazard);
    pix.rect(x, y + 5, TILE, 2, mix(c.hazard, 0xffffff, 0.4));
    const wave = n % 5;
    pix.rect(x + wave, y + 7, 4, 1, mix(c.hazard, 0xffffff, 0.25));
    pix.px(x + (n % 12), y + 10, mix(c.hazard, 0x000000, 0.35));
    pix.px(x + ((n >> 3) % 12), y + 12, mix(c.hazard, 0xffffff, 0.45));
    pix.px(x + ((n >> 5) % 10) + 2, y + 8, 0xfff6ea, 180);
    return;
  }
  if (ch === 'o') {
    pix.rect(x, y, TILE, TILE, c.deep);
    pix.rect(x + 2, y + 3, 12, 10, 0x07050a);
    pix.rect(x + 4, y + 6, 8, 5, 0x020108);
    if (!solid(up) && up !== 'o') {
      pix.rect(x, y, TILE, 2, c.wallHi);
      pix.rect(x, y + 2, TILE, 1, mix(c.floor, c.deep, 0.4));
    }
    return;
  }
  if (ch === ',') paintRubble(pix, x, y + 8, n, c);
}

function paintWall(
  pix: Pix,
  x: number,
  y: number,
  n: number,
  c: Paint,
  top: boolean,
  leftAir: boolean,
  rightAir: boolean,
  botAir: boolean,
): void {
  const mortar = mix(c.wall2, c.deep, 0.5);
  for (let row = 0; row < 4; row++) {
    const oy = row * 4;
    const shift = row % 2 === 0 ? 0 : 6;
    const brick = row % 2 === 0 ? c.wall : mix(c.wall, c.wall2, 0.45);
    pix.rect(x, y + oy, TILE, 4, brick);
    pix.rect(x, y + oy + 3, TILE, 1, mortar);
    const seam = (shift + (n % 3)) % 14;
    pix.rect(x + seam, y + oy, 1, 3, mortar);
  }
  if ((n % 8) === 0) pix.rect(x + (n % 8), y + 8, 4, 3, mix(c.wall2, c.deep, 0.15));
  if (c.biome === 'molten' && n % 5 === 0) {
    pix.px(x + 3, y + 6, c.accent);
    pix.px(x + 4, y + 7, c.hazard);
    pix.px(x + 9, y + 11, c.accent);
  }
  if (c.biome === 'sanctum' && n % 7 === 0) {
    pix.rect(x + 5, y + 6, 6, 1, c.accent);
    pix.px(x + 7, y + 5, c.wallHi);
  }
  if (c.biome === 'ash' && n % 9 === 0) pix.line(x + 4, y + 5, x + 10, y + 12, mix(c.deep, c.wall2, 0.2));
  if (top) {
    pix.rect(x, y, TILE, 4, c.floor);
    pix.rect(x, y, TILE, 1, c.wallHi);
    pix.rect(x, y + 3, TILE, 1, mix(c.floor, c.deep, 0.38));
    if ((n & 3) === 0) pix.px(x + (n % 12) + 2, y + 1, mix(c.floor, c.wallHi, 0.6));
    if (leftAir) {
      pix.px(x, y, c.deep);
      pix.px(x, y + 1, mix(c.floor, c.deep, 0.35));
      pix.px(x + 1, y, mix(c.floor, c.wallHi, 0.3));
    }
    if (rightAir) {
      pix.px(x + 15, y, c.deep);
      pix.px(x + 15, y + 1, mix(c.floor, c.deep, 0.35));
      pix.px(x + 14, y, mix(c.floor, c.wallHi, 0.3));
    }
  }
  if (leftAir && !top) {
    pix.rect(x, y, 2, TILE, mix(c.wall, c.wallHi, 0.22));
    pix.rect(x, y, 1, TILE, c.wallHi);
  }
  if (rightAir && !top) pix.rect(x + TILE - 2, y, 2, TILE, mix(c.wall, c.deep, 0.38));
  if (botAir) {
    pix.rect(x, y + TILE - 3, TILE, 3, mix(c.wall2, c.deep, 0.45));
    pix.rect(x, y + TILE - 1, TILE, 1, c.deep);
    if (c.biome === 'ash' && n % 11 === 0) pix.rect(x + 7, y + TILE, 1, 7, mix(c.decor, c.deep, 0.2));
    if (c.biome === 'molten' && n % 8 === 0) {
      pix.rect(x + 8, y + TILE, 2, 5, c.hazard);
      pix.px(x + 8, y + TILE + 5, c.accent);
    }
    if (c.biome === 'sanctum' && n % 10 === 0) {
      pix.line(x + 8, y + TILE, x + 8, y + TILE + 6, c.accent);
      pix.px(x + 7, y + TILE + 2, c.wallHi);
    }
  }
  if (rightAir && c.biome === 'ash' && n % 17 === 0 && !top) {
    pix.rect(x + TILE - 1, y + 2, 1, 8, c.accent);
    pix.rect(x + TILE - 1, y + 9, 4, 3, c.decor);
  }
}

function paintRubble(pix: Pix, x: number, y: number, n: number, c: Paint): void {
  const k = n % 4;
  if (c.biome === 'molten') {
    pix.rect(x + 3, y + 3, 4, 3, mix(c.decor, c.deep, 0.2));
    pix.px(x + 4, y + 4, c.accent);
    pix.px(x + 9, y + 5, c.hazard);
    pix.rect(x + 8, y + 2, 2, 4, c.wall2);
  } else if (c.biome === 'sanctum') {
    pix.rect(x + 6, y, 2, 5, c.decor);
    pix.px(x + 6, y - 1, c.accent);
    pix.px(x + 7, y - 2, 0xfff6ea);
    pix.rect(x + 2, y + 4, 3, 2, c.wall2);
  } else if (k === 0) {
    pix.rect(x + 3, y + 3, 5, 3, c.decor);
    pix.px(x + 4, y + 3, c.wallHi);
    pix.px(x + 6, y + 4, mix(c.decor, c.deep, 0.3));
    pix.rect(x + 10, y + 4, 3, 2, mix(c.decor, c.deep, 0.25));
  } else if (k === 1) {
    pix.line(x + 2, y + 5, x + 8, y + 3, c.decor);
    pix.px(x + 8, y + 2, c.wallHi);
    pix.rect(x + 10, y + 4, 4, 2, c.floor2);
  } else {
    pix.rect(x + 4, y + 2, 6, 4, c.floor2);
    pix.rect(x + 5, y + 2, 3, 1, c.wallHi);
    pix.px(x + 11, y + 5, c.decor);
  }
}

function paintAirDecor(pix: Pix, room: Room, c: Paint): void {
  for (let ty = 1; ty < room.h - 1; ty++) {
    for (let tx = 2; tx < room.w - 2; tx++) {
      const ch = room.grid[ty]?.[tx];
      if (ch !== '.') continue;
      const below = room.grid[ty + 1]?.[tx];
      if (below !== '#' && below !== '=' && below !== 'x' && below !== '+') continue;
      const n = hash2(tx, ty + 9);
      if (n % 6 !== 0) continue;
      paintRubble(pix, tx * TILE, ty * TILE + 8, n, c);
    }
  }
}

export function bakeParallax(biome: BiomeId, layer: 'far' | 'near'): HTMLCanvasElement {
  const colors: BiomeColors = BIOMES[biome].colors;
  const pix = new Pix(480, 320);
  const bg = hex(layer === 'far' ? colors.bg : colors.bg2);
  const deep = hex(colors.deep);
  const wall = hex(colors.wall);
  const accent = hex(colors.accent);
  const hi = hex(colors.wallHi);
  pix.rect(0, 0, 480, 320, layer === 'far' ? bg : mix(bg, deep, 0.22));
  if (layer === 'far') {
    if (biome === 'molten') pix.rect(0, 210, 480, 40, mix(accent, deep, 0.55), 140);
    if (biome === 'sanctum') {
      for (let i = 0; i < 70; i++) pix.px(hash2(i, 4) % 480, hash2(i, 8) % 180, i % 6 === 0 ? accent : hi, 200);
      blob(pix, 360, 70, 22, 22, mix(wall, hi, 0.25), 90);
      blob(pix, 360, 70, 14, 14, bg, 140);
    } else if (biome === 'ash') {
      blob(pix, 400, 64, 14, 14, mix(hi, wall, 0.4));
      blob(pix, 406, 60, 11, 11, bg);
    }
    for (let i = 0; i < 8; i++) {
      const x = (i * 70 + (hash2(i, 3) % 18)) % 480;
      const h = 50 + (hash2(i, 9) % 80);
      const bw = 36 + (hash2(i, 1) % 28);
      const col = mix(wall, deep, 0.58);
      pix.rect(x, 200 - h, bw, h + 120, col);
      pix.rect(x, 200 - h, bw, 3, mix(wall, accent, biome === 'molten' ? 0.45 : 0.2));
      if (i % 2 === 0) {
        pix.rect(x + 8, 200 - h + 16, 6, 8, mix(deep, bg, 0.3));
        pix.rect(x + bw - 14, 200 - h + 28, 5, 7, mix(deep, bg, 0.3));
      }
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const x = (i * 58) % 480;
      const h = 80 + (hash2(i, 2) % 90);
      const col = mix(wall, deep, 0.15);
      pix.rect(x + 10, 240 - h, 16, h, col);
      pix.rect(x + 12, 240 - h, 3, h, mix(col, hi, 0.18));
      pix.rect(x, 240 - h + 18, 36, 7, mix(wall, deep, 0.28));
      pix.rect(x + 4, 240 - h + 36, 28, 4, mix(wall, deep, 0.35));
      if (biome === 'ash' && i % 2 === 0) {
        pix.rect(x + 16, 240 - h - 12, 3, 14, accent);
        pix.rect(x + 14, 240 - h - 2, 7, 4, hex(colors.decor));
      } else if (biome === 'molten') {
        pix.rect(x + 16, 230 - h, 4, h, mix(accent, deep, 0.25), 160);
        pix.px(x + 17, 236 - h, 0xfff1c2);
      } else if (i % 3 === 0) {
        pix.rect(x + 14, 240 - h - 8, 6, 10, accent);
        pix.px(x + 16, 240 - h - 10, hi);
      }
      pix.rect(x + 14, 250 - h + 24, 6, 8, mix(deep, bg, 0.2));
    }
    pix.rect(0, 248, 480, 72, mix(deep, bg, 0.45));
    if (biome === 'molten') pix.rect(0, 248, 480, 6, mix(accent, deep, 0.4), 150);
  }
  return pix.toCanvas();
}

export function bakeGlow(): HTMLCanvasElement {
  const pix = new Pix(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5) / 16;
      const a = Math.max(0, 1 - d);
      pix.px(x, y, 0xfff1d2, Math.floor(a * a * 200));
    }
  }
  return pix.toCanvas();
}

export function bakeVignette(): HTMLCanvasElement {
  const pix = new Pix(480, 270);
  for (let y = 0; y < 270; y++) {
    for (let x = 0; x < 480; x++) {
      const nx = Math.abs(x - 240) / 240;
      const ny = Math.abs(y - 135) / 135;
      const d = Math.max(nx * 0.85, ny);
      if (d > 0.72) pix.px(x, y, 0x07040a, Math.floor((d - 0.72) * 520));
    }
  }
  return pix.toCanvas();
}
