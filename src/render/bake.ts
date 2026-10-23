import type { BiomeId, Room } from '../core/types';
import { TILE } from '../core/constants';
import { BIOMES, type BiomeColors } from '../data/biomes';
import { Pix, hash2, mix } from './pix';

function hex(c: string): number {
  return Number.parseInt(c.slice(1), 16);
}

function solid(ch: string | undefined): boolean {
  return ch === '#' || ch === '+' || ch === 'x' || ch === '^' || ch === '~';
}

export function bakeRoom(room: Room, biome: BiomeId): HTMLCanvasElement {
  const colors = BIOMES[biome].colors;
  const pix = new Pix(room.w * TILE, room.h * TILE);
  const paint: Paint = {
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
  paintLamps(pix, room, paint);
  return pix.toCanvas();
}

function paintBackdrop(pix: Pix, room: Room, c: Paint): void {
  const w = room.w * TILE;
  const h = room.h * TILE;
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const sky = mix(c.bg2, c.wall, 0.42);
    const ground = mix(c.bg2, c.deep, 0.35);
    pix.rect(0, y, w, 1, mix(sky, ground, Math.pow(t, 0.75)));
  }
}

function paintLamps(pix: Pix, room: Room, c: Paint): void {
  const spots: Array<[number, number]> = [];
  for (let x = 2; x < room.w - 2; x++) {
    if (room.grid[0]?.[x] !== '#') continue;
    if ((x + room.h) % 6 !== 0) continue;
    if (!solid(room.grid[1]?.[x])) spots.push([x * TILE + 8, TILE + 2]);
  }
  for (let y = 2; y < room.h - 2; y++) {
    if (room.grid[y]?.[0] === '#' && !solid(room.grid[y]?.[1]) && y % 5 === 2) {
      spots.push([TILE + 2, y * TILE + 8]);
    }
  }
  for (const [x, y] of spots) {
    wash(pix, x, y + 6, 22, c.accent, 70);
    pix.rect(x - 1, y, 3, 5, c.accent);
    pix.px(x, y - 1, c.wallHi);
    pix.px(x, y, 0xfff1c2);
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
  const n = hash2(tx, ty);
  const edge = tx === 0 || tx === room.w - 1 || ty === 0;
  if ((ch === '.' || ch === ',') && edge) {
    pix.rect(x, y, TILE, TILE, c.deep);
    if (tx === 0) pix.rect(x + TILE - 2, y, 2, TILE, c.accent);
    else if (tx === room.w - 1) pix.rect(x, y, 2, TILE, c.accent);
    else pix.rect(x, y + TILE - 2, TILE, 2, c.accent);
    return;
  }
  if (ch === '#' || ch === 'x') {
    const top = !solid(up);
    pix.rect(x, y, TILE, TILE, top ? c.floor2 : c.wall2);
    for (let by = 0; by < TILE; by += 4) {
      const off = (by / 4) % 2 === 0 ? 0 : 5;
      pix.rect(x + off, y + by, 8, 3, mix(c.wall, c.wall2, (n >> (by % 5)) & 1 ? 0.35 : 0));
    }
    if (top) {
      pix.rect(x, y, TILE, 3, c.floor);
      pix.rect(x, y, TILE, 1, c.wallHi);
      if ((n & 7) === 0) pix.rect(x + (n % 10), y + 4, 3, 1, c.decor);
    } else if ((n & 15) === 0) {
      pix.px(x + (n % 12) + 2, y + ((n >> 4) % 12) + 2, c.wallHi);
    }
    if (ch === 'x') {
      pix.line(x + 3, y + 2, x + 8, y + 8, 0x1a1020);
      pix.line(x + 8, y + 8, x + 5, y + 14, 0x1a1020);
      pix.line(x + 8, y + 7, x + 13, y + 4, 0x1a1020);
      pix.px(x + 8, y + 8, c.accent);
      pix.px(x + 9, y + 8, c.accent);
    }
    return;
  }
  if (ch === '+') {
    pix.rect(x + 3, y, 10, TILE, c.wall);
    pix.rect(x + 4, y, 2, TILE, c.wallHi);
    pix.rect(x + 3, y, 10, 2, c.floor);
    pix.rect(x + 5, y + 6, 6, 2, mix(c.wall, c.deep, 0.4));
    return;
  }
  if (ch === '=') {
    pix.rect(x, y, TILE, 5, c.platform);
    pix.rect(x, y, TILE, 1, c.wallHi);
    pix.rect(x, y + 4, TILE, 1, mix(c.platform, c.deep, 0.4));
    return;
  }
  if (ch === '^') {
    const base = !solid(up) ? y + 6 : y + 2;
    for (const ox of [1, 6, 11]) {
      pix.line(x + ox, base + 8, x + ox + 2, base, c.hazard);
      pix.line(x + ox + 4, base + 8, x + ox + 2, base, c.hazard);
      pix.px(x + ox + 2, base, mix(c.hazard, 0xffffff, 0.45));
    }
    return;
  }
  if (ch === '~') {
    pix.rect(x, y + 6, TILE, 10, c.hazard);
    pix.rect(x, y + 6, TILE, 2, mix(c.hazard, 0xffffff, 0.35));
    pix.px(x + (n % 12), y + 10, mix(c.hazard, 0x000000, 0.35));
    pix.px(x + ((n >> 3) % 12), y + 13, mix(c.hazard, 0xffffff, 0.4));
    return;
  }
  if (ch === 'o') {
    pix.rect(x, y, TILE, TILE, c.deep);
    pix.rect(x + 2, y + 3, 12, 10, 0x07050a);
    if (!solid(up) && up !== 'o') pix.rect(x, y, TILE, 2, c.wallHi);
    return;
  }
  if (ch === ',') {
    pix.rect(x + 3, y + 12, 4, 3, c.decor);
    pix.rect(x + 9, y + 13, 3, 2, mix(c.decor, c.deep, 0.3));
    pix.px(x + 4, y + 12, c.wallHi);
  }
}

export function bakeParallax(biome: BiomeId, layer: 'far' | 'near'): HTMLCanvasElement {
  const colors: BiomeColors = BIOMES[biome].colors;
  const pix = new Pix(480, 320);
  const bg = hex(layer === 'far' ? colors.bg : colors.bg2);
  const deep = hex(colors.deep);
  const wall = hex(colors.wall);
  const accent = hex(colors.accent);
  pix.rect(0, 0, 480, 320, layer === 'far' ? bg : mix(bg, deep, 0.25));
  if (layer === 'far') {
    for (let i = 0; i < 8; i++) {
      const x = (i * 70 + hash2(i, 3) % 20) % 480;
      const h = 40 + (hash2(i, 9) % 70);
      const w = 50 + (hash2(i, 1) % 40);
      pix.rect(x, 180 - h, w, h + 140, mix(wall, deep, 0.55));
      pix.rect(x, 180 - h, w, 3, mix(wall, accent, 0.25));
    }
    for (let i = 0; i < 40; i++) {
      const x = hash2(i, 4) % 480;
      const y = hash2(i, 8) % 140;
      pix.px(x, y, mix(accent, 0xffffff, 0.4), 180);
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const x = (i * 56) % 480;
      const h = 70 + (hash2(i, 2) % 80);
      pix.rect(x + 8, 230 - h, 18, h, mix(wall, deep, 0.2));
      pix.rect(x, 230 - h + 16, 34, 8, mix(wall, deep, 0.35));
      if (i % 3 === 0) pix.rect(x + 14, 230 - h - 10, 4, 12, accent);
    }
    pix.rect(0, 250, 480, 70, mix(deep, bg, 0.4));
  }
  return pix.toCanvas();
}

export function bakeGlow(): HTMLCanvasElement {
  const pix = new Pix(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5) / 16;
      const a = Math.max(0, 1 - d);
      pix.px(x, y, 0xfff1d2, Math.floor(a * a * 180));
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
      if (d > 0.72) pix.px(x, y, 0x07040a, Math.floor((d - 0.72) * 500));
    }
  }
  return pix.toCanvas();
}
