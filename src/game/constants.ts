export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GROUND_Y = 430;
export const GRAVITY = 1300;

export const ART = {
  pixel: 3,
  cols: 80,
  rows: 72,
  foot: 62,
  texW: 240,
  texH: 216,
  footSrc: 186,
};

export const TUNING = {
  jumpV: -520,
  move: 205,
  dodgeSpeed: 360,
  dodgeTime: 0.32,
  dodgeIFrame: 0.26,
  dodgeCd: 0.9,
  specialCd: 4.7,
  hitIFrame: 0.34,
  coyote: 0.1,
  buffer: 0.15,
  fallY: 700,
  fallDamage: 14,
};

export interface StageLook {
  name: string;
  label: string;
  skyTop: string;
  skyBot: string;
  far: string;
  farHi: string;
  mid: string;
  midHi: string;
  accent: string;
  groundTop: string;
  ground: string;
  groundDark: string;
  fog: number;
  moon: string;
}

export const STAGE_LOOK: Record<1 | 2 | 3, StageLook> = {
  1: {
    name: "夜郊",
    label: "第一折",
    skyTop: "#12182e",
    skyBot: "#465480",
    far: "#262d4e",
    farHi: "#3c4670",
    mid: "#1a242c",
    midHi: "#314048",
    accent: "#e6b15c",
    groundTop: "#a08a68",
    ground: "#53493e",
    groundDark: "#322c28",
    fog: 0x1c2434,
    moon: "#f3e7c4",
  },
  2: {
    name: "竹影",
    label: "第二折",
    skyTop: "#0c1c1a",
    skyBot: "#1d4c40",
    far: "#14362e",
    farHi: "#215848",
    mid: "#10241c",
    midHi: "#214838",
    accent: "#8fd0a4",
    groundTop: "#7d8a62",
    ground: "#3c4438",
    groundDark: "#262c24",
    fog: 0x10241c,
    moon: "#d5f0e4",
  },
  3: {
    name: "残城",
    label: "第三折",
    skyTop: "#180c12",
    skyBot: "#542838",
    far: "#341824",
    farHi: "#643444",
    mid: "#1c1016",
    midHi: "#4a2830",
    accent: "#e07858",
    groundTop: "#8a7060",
    ground: "#463838",
    groundDark: "#2a1e20",
    fog: 0x2a1218,
    moon: "#f0b8a8",
  },
};

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return Math.abs(a.x - b.x) <= (a.w + b.w) / 2 && Math.abs(a.y - b.y) <= (a.h + b.h) / 2;
}
