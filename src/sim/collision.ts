import { TILE } from '../core/constants';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
}

export interface MoveResult {
  grounded: boolean;
  hazard: boolean;
}

function tileAt(grid: string[][], tx: number, ty: number): string | undefined {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0]!.length) return undefined;
  return grid[ty]![tx];
}

function isSolid(ch: string | undefined, who: 'player' | 'enemy'): boolean {
  if (!ch) return false;
  if (ch === 'o') return who === 'enemy';
  return ch === '#' || ch === '+' || ch === 'x' || ch === '^' || ch === '~';
}

function isPlatform(ch: string | undefined): boolean {
  return ch === '=';
}

function isHazard(ch: string | undefined): boolean {
  return ch === '^' || ch === '~';
}

function overlaps(
  body: Body,
  grid: string[][],
  who: 'player' | 'enemy',
): boolean {
  const left = body.x - body.w / 2;
  const right = body.x + body.w / 2 - 0.001;
  const top = body.y - body.h;
  const bot = body.y - 0.001;
  const x0 = Math.floor(left / TILE);
  const x1 = Math.floor(right / TILE);
  const y0 = Math.floor(top / TILE);
  const y1 = Math.floor(bot / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= grid[0]!.length) {
        if (who === 'enemy') return true;
        continue;
      }
      if (isSolid(tileAt(grid, tx, ty), who)) return true;
    }
  }
  return false;
}

export function onPlatform(grid: string[][], body: Body): boolean {
  const left = body.x - body.w / 2;
  const right = body.x + body.w / 2 - 0.001;
  const x0 = Math.floor(left / TILE);
  const x1 = Math.floor(right / TILE);
  const ty = Math.floor((body.y + 1) / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    if (isPlatform(tileAt(grid, tx, ty))) {
      const top = ty * TILE;
      if (Math.abs(body.y - top) <= 2.5) return true;
    }
  }
  return false;
}

export function moveBody(
  body: Body,
  grid: string[][],
  who: 'player' | 'enemy',
  dropThrough: boolean,
): MoveResult {
  let grounded = false;

  body.x += body.vx;
  if (overlaps(body, grid, who)) {
    if (body.vx > 0) {
      const right = body.x + body.w / 2;
      const tile = Math.floor((right - 0.001) / TILE);
      body.x = tile * TILE - body.w / 2 - 0.01;
    } else if (body.vx < 0) {
      const left = body.x - body.w / 2;
      const tile = Math.floor(left / TILE);
      body.x = (tile + 1) * TILE + body.w / 2 + 0.01;
    } else {
      body.y -= 2;
    }
    body.vx = 0;
  }

  const prevBottom = body.y;
  body.y += body.vy;
  if (overlaps(body, grid, who)) {
    if (body.vy >= 0) {
      const tile = Math.floor((body.y - 0.001) / TILE);
      body.y = tile * TILE - 0.01;
      body.vy = 0;
      grounded = true;
    } else {
      const top = body.y - body.h;
      const tile = Math.floor(top / TILE);
      body.y = (tile + 1) * TILE + body.h + 0.01;
      body.vy = 0;
    }
  }

  if (body.vy >= 0 && !dropThrough) {
    const left = body.x - body.w / 2;
    const right = body.x + body.w / 2 - 0.001;
    const x0 = Math.floor(left / TILE);
    const x1 = Math.floor(right / TILE);
    const ty0 = Math.floor(prevBottom / TILE);
    const ty1 = Math.floor(body.y / TILE);
    let snapped = false;
    for (let ty = ty0; ty <= ty1 && !snapped; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!isPlatform(tileAt(grid, tx, ty))) continue;
        const top = ty * TILE;
        if (prevBottom <= top + 1.5 && body.y >= top) {
          body.y = top - 0.01;
          body.vy = 0;
          grounded = true;
          snapped = true;
          break;
        }
      }
    }
  }

  if (!grounded && body.vy >= 0) {
    const probe: Body = { ...body, y: body.y + 1.25, vx: 0, vy: 0 };
    if (overlaps(probe, grid, who)) grounded = true;
    else if (!dropThrough && onPlatform(grid, body)) grounded = true;
  }

  let hazard = false;
  const left = body.x - body.w / 2;
  const right = body.x + body.w / 2 - 0.001;
  const top = body.y - body.h;
  const bot = body.y + 0.6;
  const x0 = Math.floor(left / TILE);
  const x1 = Math.floor(right / TILE);
  const y0 = Math.floor(top / TILE);
  const y1 = Math.floor(bot / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isHazard(tileAt(grid, tx, ty))) hazard = true;
    }
  }

  return { grounded, hazard };
}

export function floorFeetY(grid: string[][]): number {
  return (grid.length - 1) * TILE - 0.01;
}
