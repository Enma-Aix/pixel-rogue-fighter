import Phaser from "phaser";
import { ART, STAGE_LOOK, type StageLook } from "./constants";
import { Rng } from "./rng";

type Buf = (string | null)[][];

export interface Pose {
  bob?: number;
  lean?: number;
  headX?: number;
  frontArm?: number;
  backArm?: number;
  frontFootX?: number;
  frontFootY?: number;
  backFootX?: number;
  backFootY?: number;
  weapon?: number;
  pull?: number;
  glow?: boolean;
  prone?: boolean;
  scarfT?: number;
}

interface Style {
  skin: string;
  hair: string;
  cloth: string;
  clothDark: string;
  pants: string;
  boot: string;
  metal: string;
  metalDark: string;
  accent: string;
  blade: string;
  wood: string;
  outline: string;
  cape?: string;
  bulk: number;
  head: "hair" | "helmet" | "hood" | "horns";
  weapon: "sword" | "spear" | "hammer" | "bow" | "greatsword";
  scarf?: boolean;
  eye: string;
  glow: string;
  armored?: boolean;
}

interface Skel {
  cx: number;
  foot: number;
  hipY: number;
  chestY: number;
  head: { x: number; y: number; r: number };
  shoulderF: { x: number; y: number };
  shoulderB: { x: number; y: number };
  hipF: { x: number; y: number };
  hipB: { x: number; y: number };
  handF: { x: number; y: number };
  handB: { x: number; y: number };
  footF: { x: number; y: number };
  footB: { x: number; y: number };
  bulk: number;
  arm: number;
}

export const SHEET: Record<string, Record<string, { start: number; count: number }>> = {
  player: {
    idle: { start: 0, count: 4 },
    run: { start: 4, count: 4 },
    jump: { start: 8, count: 1 },
    fall: { start: 9, count: 1 },
    l1: { start: 10, count: 3 },
    l2: { start: 13, count: 3 },
    heavy: { start: 16, count: 4 },
    air: { start: 20, count: 2 },
    dodge: { start: 22, count: 2 },
    special: { start: 24, count: 2 },
    hit: { start: 26, count: 1 },
    dead: { start: 27, count: 1 },
  },
  grunt: {
    idle: { start: 0, count: 2 },
    run: { start: 2, count: 4 },
    attack: { start: 6, count: 3 },
    hit: { start: 9, count: 1 },
    dead: { start: 10, count: 1 },
  },
  shield: {
    idle: { start: 0, count: 2 },
    run: { start: 2, count: 4 },
    attack: { start: 6, count: 3 },
    hit: { start: 9, count: 1 },
    dead: { start: 10, count: 1 },
  },
  leaper: {
    idle: { start: 0, count: 2 },
    run: { start: 2, count: 4 },
    attack: { start: 6, count: 3 },
    hit: { start: 9, count: 1 },
    dead: { start: 10, count: 1 },
  },
  archer: {
    idle: { start: 0, count: 2 },
    run: { start: 2, count: 4 },
    attack: { start: 6, count: 3 },
    hit: { start: 9, count: 1 },
    dead: { start: 10, count: 1 },
  },
  bomber: {
    idle: { start: 0, count: 2 },
    run: { start: 2, count: 4 },
    attack: { start: 6, count: 3 },
    hit: { start: 9, count: 1 },
    dead: { start: 10, count: 1 },
  },
  brute: {
    idle: { start: 0, count: 2 },
    run: { start: 2, count: 4 },
    charge: { start: 6, count: 2 },
    slam: { start: 8, count: 3 },
    hit: { start: 11, count: 1 },
    dead: { start: 12, count: 1 },
  },
  boss: {
    idle: { start: 0, count: 2 },
    run: { start: 2, count: 4 },
    slash: { start: 6, count: 4 },
    dash: { start: 10, count: 2 },
    cast: { start: 12, count: 2 },
    slam: { start: 14, count: 3 },
    hit: { start: 17, count: 1 },
    dead: { start: 18, count: 1 },
  },
};

export function loopFrame(id: string, anim: string, time: number, fps: number): number {
  const clip = SHEET[id][anim];
  const i = Math.floor(time * fps) % clip.count;
  return clip.start + i;
}

export function playFrame(id: string, anim: string, progress: number): number {
  const clip = SHEET[id][anim === "finisher" ? "heavy" : anim];
  const i = Math.min(clip.count - 1, Math.max(0, Math.floor(progress * clip.count)));
  return clip.start + i;
}

const STYLES: Record<string, Style> = {
  player: {
    skin: "#f2c3a2",
    hair: "#2c243c",
    cloth: "#3e78b0",
    clothDark: "#2a527c",
    pants: "#2a3144",
    boot: "#5a3a2a",
    metal: "#d7e0ea",
    metalDark: "#7f93a8",
    accent: "#e23b34",
    blade: "#e7f6ff",
    wood: "#8a6239",
    outline: "#16131c",
    bulk: 1,
    head: "hair",
    weapon: "sword",
    scarf: true,
    eye: "#1b1a22",
    glow: "#8eebff",
  },
  grunt: {
    skin: "#e7b48f",
    hair: "#3a2a22",
    cloth: "#3f8f52",
    clothDark: "#2c6639",
    pants: "#2c342c",
    boot: "#4a382c",
    metal: "#c5ced6",
    metalDark: "#6d7884",
    accent: "#e2c15a",
    blade: "#dfe6ee",
    wood: "#9a7044",
    outline: "#16140f",
    bulk: 1,
    head: "helmet",
    weapon: "spear",
    eye: "#1c140f",
    glow: "#ffffff",
  },
  archer: {
    skin: "#e0b090",
    hair: "#241c18",
    cloth: "#7a5340",
    clothDark: "#543628",
    pants: "#3a2e2a",
    boot: "#2c221c",
    metal: "#d7c3a2",
    metalDark: "#6e5a48",
    accent: "#9cbc6a",
    blade: "#ece4d4",
    wood: "#c48448",
    outline: "#140e0c",
    bulk: 0.96,
    head: "hood",
    weapon: "bow",
    eye: "#1a120e",
    glow: "#ffffff",
  },
  brute: {
    skin: "#d7a484",
    hair: "#2a2420",
    cloth: "#6a707c",
    clothDark: "#454b56",
    pants: "#3a3e46",
    boot: "#2a2c32",
    metal: "#c5ced8",
    metalDark: "#5e6773",
    accent: "#d24a3a",
    blade: "#9aa3af",
    wood: "#6e5340",
    outline: "#121418",
    bulk: 1.32,
    head: "helmet",
    weapon: "hammer",
    eye: "#1a120e",
    glow: "#ffffff",
    armored: true,
  },
  shield: {
    skin: "#e4c2a4",
    hair: "#2a2420",
    cloth: "#3a5878",
    clothDark: "#243848",
    pants: "#2a3038",
    boot: "#3a342c",
    metal: "#d5e4f2",
    metalDark: "#6e8498",
    accent: "#7eb6e6",
    blade: "#e7eef6",
    wood: "#8a6844",
    outline: "#12161c",
    bulk: 1.12,
    head: "helmet",
    weapon: "spear",
    eye: "#1a140f",
    glow: "#ffffff",
    armored: true,
  },
  bomber: {
    skin: "#e8b898",
    hair: "#241810",
    cloth: "#a84828",
    clothDark: "#6e2c18",
    pants: "#3a2820",
    boot: "#2a1c16",
    metal: "#e6c27a",
    metalDark: "#8a6230",
    accent: "#ffb15a",
    blade: "#ffe0a8",
    wood: "#c48448",
    outline: "#160e0c",
    bulk: 0.98,
    head: "hood",
    weapon: "bow",
    eye: "#2a120c",
    glow: "#ffd0a0",
  },
  leaper: {
    skin: "#d7b09a",
    hair: "#1a121c",
    cloth: "#4a2c58",
    clothDark: "#2e1a38",
    pants: "#241824",
    boot: "#1c141c",
    metal: "#c8b8d4",
    metalDark: "#6a5878",
    accent: "#e07ad4",
    blade: "#f4e8ff",
    wood: "#6a4038",
    outline: "#120c14",
    bulk: 0.86,
    head: "hood",
    weapon: "sword",
    scarf: true,
    eye: "#1a1020",
    glow: "#e8b0ff",
  },
  boss: {
    skin: "#efc2a4",
    hair: "#140e18",
    cloth: "#4b2a72",
    clothDark: "#2d1846",
    pants: "#24182e",
    boot: "#1a1218",
    metal: "#e6c36a",
    metalDark: "#8a6a2e",
    accent: "#e25a4a",
    blade: "#f4e8ff",
    wood: "#5a4030",
    outline: "#120c16",
    cape: "#7a2438",
    bulk: 1.22,
    head: "horns",
    weapon: "greatsword",
    eye: "#2a1020",
    glow: "#e2b0ff",
    armored: true,
  },
};

function plot(buf: Buf, x: number, y: number, color: string): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (iy < 0 || ix < 0 || iy >= buf.length || ix >= buf[0].length) return;
  buf[iy][ix] = color;
}

function stampDisc(buf: Buf, x: number, y: number, r: number, color: string): void {
  const r2 = r * r + 0.2;
  for (let yy = Math.floor(y - r - 1); yy <= Math.ceil(y + r + 1); yy += 1) {
    for (let xx = Math.floor(x - r - 1); xx <= Math.ceil(x + r + 1); xx += 1) {
      const dx = xx - x;
      const dy = yy - y;
      if (dx * dx + dy * dy <= r2) plot(buf, xx, yy, color);
    }
  }
}

function stampLine(buf: Buf, x0: number, y0: number, x1: number, y1: number, r: number, color: string): void {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist * 2));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    stampDisc(buf, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, color);
  }
}

function stampRect(buf: Buf, x: number, y: number, w: number, h: number, color: string): void {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) plot(buf, xx, yy, color);
  }
}

function createBuf(w: number, h: number): Buf {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

function applyOutline(buf: Buf, color: string): Buf {
  const h = buf.length;
  const w = buf[0].length;
  const out = buf.map((row) => row.slice());
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (buf[y][x]) continue;
      for (const [dx, dy] of dirs) {
        const ny = y + dy;
        const nx = x + dx;
        if (ny >= 0 && nx >= 0 && ny < h && nx < w && buf[ny][nx]) {
          out[y][x] = color;
          break;
        }
      }
    }
  }
  return out;
}

function upscale(buf: Buf): HTMLCanvasElement {
  const h = buf.length;
  const w = buf[0].length;
  const canvas = document.createElement("canvas");
  canvas.width = w * ART.pixel;
  canvas.height = h * ART.pixel;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const color = buf[y][x];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * ART.pixel, y * ART.pixel, ART.pixel, ART.pixel);
    }
  }
  return canvas;
}

function tip(x: number, y: number, deg: number, len: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  return { x: x + Math.sin(r) * len, y: y + Math.cos(r) * len };
}

function skeleton(style: Style, pose: Pose): Skel {
  const bulk = style.bulk;
  const leg = 10 * bulk;
  const torso = 9 * bulk;
  const headR = 5.15 * bulk;
  const arm = 8.3 * bulk;
  const cx = ART.cols / 2 + (pose.lean ?? 0);
  const foot = ART.foot + (pose.bob ?? 0);
  const hipY = foot - leg;
  const chestY = hipY - torso;
  const head = { x: cx + (pose.headX ?? 0), y: chestY - headR - 1.4 * bulk, r: headR };
  const shoulderF = { x: cx + 4.2 * bulk, y: chestY + 1.5 };
  const shoulderB = { x: cx - 3.4 * bulk, y: chestY + 1.2 };
  const hipF = { x: cx + 2.4 * bulk, y: hipY };
  const hipB = { x: cx - 2.2 * bulk, y: hipY };
  return {
    cx,
    foot,
    hipY,
    chestY,
    head,
    shoulderF,
    shoulderB,
    hipF,
    hipB,
    handF: tip(shoulderF.x, shoulderF.y, pose.frontArm ?? 16, arm),
    handB: tip(shoulderB.x, shoulderB.y, pose.backArm ?? -14, arm * 0.92),
    footF: { x: cx + (pose.frontFootX ?? 3.5), y: foot + (pose.frontFootY ?? 0) },
    footB: { x: cx + (pose.backFootX ?? -3.5), y: foot + (pose.backFootY ?? 0) },
    bulk,
    arm,
  };
}

function drawWeapon(buf: Buf, style: Style, pose: Pose, hand: { x: number; y: number }): void {
  if (style.weapon === "bow") {
    const pull = pose.pull ?? 1;
    const x = hand.x + 1;
    const y = hand.y;
    for (let a = -60; a <= 60; a += 8) {
      const r = (a * Math.PI) / 180;
      stampDisc(buf, x + 2, y + Math.sin(r) * 8.5, 1.15, style.wood);
    }
    const px = x - pull;
    stampLine(buf, x + 2, y - 8, px, y, 0.7, style.metalDark);
    stampLine(buf, x + 2, y + 8, px, y, 0.7, style.metalDark);
    if (pull > 2.2) {
      stampLine(buf, px, y, x + 14, y, 0.6, style.wood);
      stampDisc(buf, x + 15, y, 1.35, style.metal);
    }
    return;
  }
  const angle = pose.weapon ?? 1.05;
  const length = style.weapon === "greatsword" ? 18 : style.weapon === "spear" ? 16 : style.weapon === "hammer" ? 11 : 13;
  const thick = style.weapon === "greatsword" ? 1.7 : style.weapon === "hammer" ? 1.45 : style.weapon === "spear" ? 1.05 : 1.25;
  const x2 = hand.x + Math.cos(angle) * length;
  const y2 = hand.y + Math.sin(angle) * length;
  const shaft = style.weapon === "sword" || style.weapon === "greatsword" ? style.blade : style.wood;
  stampLine(buf, hand.x, hand.y, x2, y2, thick, shaft);
  if (style.weapon === "sword" || style.weapon === "greatsword") {
    const hx = hand.x + Math.cos(angle) * 3;
    const hy = hand.y + Math.sin(angle) * 3;
    const gx = Math.cos(angle + Math.PI / 2) * 3.2;
    const gy = Math.sin(angle + Math.PI / 2) * 3.2;
    stampLine(buf, hx - gx, hy - gy, hx + gx, hy + gy, 1.05, style.metal);
    stampLine(buf, hand.x + Math.cos(angle) * 2, hand.y + Math.sin(angle) * 2, x2, y2, 0.55, "#ffffff");
  } else if (style.weapon === "spear") {
    stampLine(buf, x2, y2, x2 + Math.cos(angle) * 5, y2 + Math.sin(angle) * 5, 1.55, style.metal);
  } else if (style.weapon === "hammer") {
    stampDisc(buf, x2, y2, 4.4, style.metal);
    stampDisc(buf, x2, y2, 2.3, style.metalDark);
  }
}

function drawProne(buf: Buf, style: Style, sk: Skel): void {
  const y = sk.foot - 3;
  const x = sk.cx - 2;
  stampLine(buf, x, y, x - 14, y - 1, 1.7 * sk.bulk, style.pants);
  stampLine(buf, x, y + 1, x - 12, y + 3, 1.6 * sk.bulk, style.pants);
  stampDisc(buf, x - 14, y - 1, 2, style.boot);
  stampRect(buf, x - 1, y - 4, 16, 7, style.cloth);
  stampRect(buf, x - 1, y - 4, 3, 7, style.clothDark);
  stampDisc(buf, x + 18, y - 1, sk.head.r * 0.92, style.skin);
  stampDisc(buf, x + 18, y - 3.2, sk.head.r * 0.78, style.hair);
  stampLine(buf, x + 6, y + 1, x + 8, y + 7, 1.3, style.cloth);
  stampLine(buf, x - 2, y + 6, x + 12, y + 7, 0.9, style.blade);
}

function drawBody(buf: Buf, style: Style, pose: Pose, sk: Skel): void {
  if (pose.prone) {
    drawProne(buf, style, sk);
    return;
  }
  if (style.cape) {
    const wave = pose.scarfT ?? 0;
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      const x = sk.cx - 1 - t * 12 + Math.sin(wave + t * 3) * 1.1;
      const y = sk.chestY - 2 + t * 16;
      stampDisc(buf, x, y, 2.5 * (1 - t * 0.25), style.cape);
    }
  }
  stampLine(buf, sk.hipB.x, sk.hipB.y, sk.footB.x, sk.footB.y, 1.7 * sk.bulk, style.pants);
  stampDisc(buf, sk.footB.x, sk.footB.y, 2.15 * Math.min(sk.bulk, 1.15), style.boot);
  const armColor = style.armored ? style.metalDark : style.cloth;
  stampLine(buf, sk.shoulderB.x, sk.shoulderB.y, sk.handB.x, sk.handB.y, 1.45 * sk.bulk, armColor);
  stampDisc(buf, sk.handB.x, sk.handB.y, 1.45, style.skin);

  const top = sk.chestY - 1;
  const height = sk.hipY - top + 2;
  const width = 7.4 * sk.bulk;
  stampRect(buf, sk.cx - width / 2, top, width, height, style.cloth);
  stampRect(buf, sk.cx - width / 2, top, 2.1, height, style.clothDark);
  if (style.armored) {
    stampRect(buf, sk.cx - width / 2 + 2, top + 2, width - 4, 3.2, style.metal);
    stampDisc(buf, sk.shoulderF.x, sk.shoulderF.y, 2.8 * sk.bulk, style.metal);
    stampDisc(buf, sk.shoulderB.x, sk.shoulderB.y, 2.5 * sk.bulk, style.metalDark);
  }
  stampRect(buf, sk.cx - width / 2, sk.hipY - 1.4, width, 2.3, style.metalDark);
  plot(buf, sk.cx, sk.hipY - 0.4, style.accent);

  stampDisc(buf, sk.head.x, sk.head.y + sk.head.r * 0.15, 1.6, style.skin);
  drawHead(buf, style, sk.head);

  stampLine(buf, sk.hipF.x, sk.hipF.y, sk.footF.x, sk.footF.y, 1.9 * sk.bulk, style.pants);
  stampDisc(buf, sk.footF.x, sk.footF.y, 2.25 * Math.min(sk.bulk, 1.15), style.boot);
  stampLine(buf, sk.shoulderF.x, sk.shoulderF.y, sk.handF.x, sk.handF.y, 1.65 * sk.bulk, style.armored ? style.metal : style.cloth);
  stampDisc(buf, sk.handF.x, sk.handF.y, 1.55, style.skin);
  drawWeapon(buf, style, pose, sk.handF);

  if (style.scarf) {
    const wave = pose.scarfT ?? 0;
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const x = sk.cx - t * 9 + Math.sin(wave * 1.6 + t * 4) * 1.2;
      const y = sk.chestY - 3 + t * 2.4 + Math.cos(wave + t * 2) * 0.7;
      stampDisc(buf, x, y, i === 0 ? 1.7 : 1.15, style.accent);
    }
  }
}

function drawHead(buf: Buf, style: Style, head: { x: number; y: number; r: number }): void {
  const { x, y, r } = head;
  stampDisc(buf, x, y, r, style.skin);
  if (style.head === "hair") {
    stampDisc(buf, x - 0.3, y - 1.3, r * 0.98, style.hair);
    stampDisc(buf, x + 0.8, y + 1.5, r * 0.7, style.skin);
    stampLine(buf, x - r + 1, y - 1, x - r - 5, y + 3, 1.45, style.hair);
    stampDisc(buf, x - r - 5, y + 4, 2.1, style.hair);
  } else if (style.head === "helmet") {
    stampDisc(buf, x, y - 0.8, r + 0.35, style.metal);
    stampDisc(buf, x + 0.5, y + 1.8, r * 0.62, style.skin);
    stampLine(buf, x - 1, y - r, x - 7, y - r - 5, 1.55, style.accent);
    stampDisc(buf, x - 7, y - r - 5, 1.9, style.accent);
    stampLine(buf, x - 1, y + 0.4, x + r * 0.8, y + 0.4, 0.7, style.metalDark);
  } else if (style.head === "hood") {
    stampDisc(buf, x - 0.4, y - 0.5, r + 1.25, style.cloth);
    stampDisc(buf, x + 1.1, y + 1.6, r * 0.55, style.skin);
    stampLine(buf, x - r, y + 1, x - r - 3, y + 8, 1.8, style.clothDark);
  } else {
    stampDisc(buf, x, y - 0.6, r + 0.15, style.hair);
    stampDisc(buf, x + 0.7, y + 1.6, r * 0.66, style.skin);
    stampLine(buf, x - 2, y - r + 1, x - 8, y - r - 7, 1.55, style.metalDark);
    stampLine(buf, x + 2, y - r + 1, x + 7, y - r - 8, 1.55, style.metal);
    stampLine(buf, x - r + 1, y - 1, x + r - 1, y - 1, 0.9, style.metal);
  }
}

function drawFace(buf: Buf, style: Style, sk: Skel): void {
  if (sk.head.y > ART.rows) return;
  const ex = sk.head.x + sk.head.r * 0.28;
  const ey = sk.head.y + sk.head.r * (style.head === "hair" ? 0.12 : 0.32);
  plot(buf, ex, ey, "#f7f4ee");
  plot(buf, ex + 1, ey, style.eye);
  if (style.bulk > 1.15) {
    plot(buf, ex, ey + 1, "#f7f4ee");
    plot(buf, ex + 1, ey + 1, style.eye);
  }
}

function drawGlow(buf: Buf, style: Style, sk: Skel): void {
  stampDisc(buf, sk.handF.x + 7, sk.handF.y, 3.6, style.glow);
  stampDisc(buf, sk.handF.x + 7, sk.handF.y, 1.7, "#f8ffff");
}

function renderPose(style: Style, pose: Pose): HTMLCanvasElement {
  const buf = createBuf(ART.cols, ART.rows);
  const sk = skeleton(style, pose);
  drawBody(buf, style, pose, sk);
  const outlined = applyOutline(buf, style.outline);
  if (!pose.prone) drawFace(outlined, style, sk);
  if (pose.glow) drawGlow(outlined, style, sk);
  return upscale(outlined);
}

function p(partial: Pose): Pose {
  return partial;
}

const RUN: Pose[] = [
  p({ lean: 2, frontArm: -28, backArm: 36, frontFootX: 8, backFootX: -7, backFootY: -3, weapon: 0.95, bob: 0 }),
  p({ lean: 2, frontArm: 8, backArm: 8, frontFootX: 2, frontFootY: -1, backFootX: -1, weapon: 1.05, bob: 1 }),
  p({ lean: 2, frontArm: 38, backArm: -34, frontFootX: -6, frontFootY: -3, backFootX: 8, weapon: 1.15, bob: 0 }),
  p({ lean: 2, frontArm: 6, backArm: -8, frontFootX: 0, backFootX: 3, backFootY: -2, weapon: 1.05, bob: 1 }),
];

function idle(n: number, weapon = 1.05): Pose[] {
  return Array.from({ length: n }, (_, i) =>
    p({
      bob: [0, 0.7, 0, -0.4][i % 4],
      frontArm: 18,
      backArm: -12,
      weapon,
      frontFootX: 3.5,
      backFootX: -3.5,
      scarfT: i,
    }),
  );
}

function posesFor(id: string): Pose[] {
  if (id === "player") {
    return [
      ...idle(4, 1.02).map((pose, i) => ({ ...pose, scarfT: i * 0.8 })),
      ...RUN.map((pose, i) => ({ ...pose, scarfT: i })),
      p({ frontArm: 150, backArm: 164, frontFootX: 4, frontFootY: -6, backFootX: -3, backFootY: -5, weapon: -0.7, lean: 1, scarfT: 1 }),
      p({ frontArm: 36, backArm: -16, frontFootX: 3, frontFootY: 1, backFootX: -4, backFootY: 2, weapon: 0.45, lean: 1, scarfT: 2 }),
      p({ lean: -3, frontArm: 168, backArm: 20, weapon: -2.25, frontFootX: 2, backFootX: -5, scarfT: 0 }),
      p({ lean: 3, frontArm: 78, backArm: -8, weapon: -0.3, frontFootX: 7, backFootX: -3, scarfT: 1 }),
      p({ lean: 2, frontArm: 24, backArm: -18, weapon: 0.75, frontFootX: 6, backFootX: -4, bob: 1, scarfT: 2 }),
      p({ lean: 3, frontArm: 18, weapon: 1.15, frontFootX: 6, backFootX: -2, scarfT: 0 }),
      p({ lean: -1, frontArm: 104, weapon: -0.1, frontFootX: 3, backFootX: -5, scarfT: 1 }),
      p({ lean: -3, frontArm: 156, weapon: -1.4, frontFootX: 1, backFootX: -6, scarfT: 2 }),
      p({ lean: -3, frontArm: 172, weapon: -1.7, bob: 1, frontFootX: 1, backFootX: -4, scarfT: 0 }),
      p({ lean: -4, frontArm: 196, weapon: -2.35, bob: 2, frontFootX: 0, backFootX: -5, scarfT: 1 }),
      p({ lean: 5, frontArm: 34, weapon: 0.55, frontFootX: 9, backFootX: -2, scarfT: 2 }),
      p({ lean: 3, frontArm: 12, weapon: 1.05, bob: 1, frontFootX: 6, backFootX: -3, scarfT: 3 }),
      p({ frontArm: 138, weapon: -1.05, frontFootX: 4, frontFootY: -5, backFootX: -3, backFootY: -4, scarfT: 0 }),
      p({ lean: 3, frontArm: 28, weapon: 0.5, frontFootX: 6, frontFootY: -2, backFootX: -2, backFootY: -2, scarfT: 1 }),
      p({ bob: 7, lean: 5, frontArm: 48, backArm: 40, frontFootX: 7, frontFootY: -2, backFootX: -1, weapon: 0.8, scarfT: 1 }),
      p({ bob: 8, lean: 7, frontArm: 70, backArm: 54, frontFootX: 9, backFootX: 1, weapon: 0.45, scarfT: 2 }),
      p({ lean: -2, frontArm: 96, weapon: -0.05, frontFootX: 3, backFootX: -4, scarfT: 0 }),
      p({ lean: 2, frontArm: 90, weapon: 0, frontFootX: 6, backFootX: -3, glow: true, scarfT: 1 }),
      p({ lean: -6, frontArm: -16, backArm: -36, weapon: 1.4, headX: -2, bob: 1, frontFootX: -1, backFootX: -6, scarfT: 2 }),
      p({ prone: true }),
    ];
  }
  if (id === "grunt" || id === "shield" || id === "leaper") {
    return [
      ...idle(2, 0.15),
      ...RUN.map((pose) => ({ ...pose, weapon: 0.2 })),
      p({ lean: -2, frontArm: 70, weapon: -0.45, frontFootX: 2, backFootX: -4 }),
      p({ lean: 4, frontArm: 92, weapon: 0.05, frontFootX: 7, backFootX: -2 }),
      p({ lean: 3, frontArm: 88, weapon: 0.12, frontFootX: 6, backFootX: -3 }),
      p({ lean: -5, frontArm: 10, weapon: 0.8, headX: -1 }),
      p({ prone: true }),
    ];
  }
  if (id === "archer" || id === "bomber") {
    return [
      ...idle(2, 0).map((pose) => ({ ...pose, pull: 1, frontArm: 80 })),
      ...RUN.map((pose) => ({ ...pose, pull: 1, frontArm: 70, weapon: 0 })),
      p({ pull: 1.2, frontArm: 82, lean: 0, frontFootX: 3, backFootX: -3 }),
      p({ pull: 3.4, frontArm: 74, lean: -2, frontFootX: 2, backFootX: -4 }),
      p({ pull: 6, frontArm: 64, lean: -3, frontFootX: 1, backFootX: -5 }),
      p({ lean: -5, pull: 1, frontArm: 40, headX: -1 }),
      p({ prone: true }),
    ];
  }
  if (id === "brute") {
    return [
      ...idle(2, -1.2),
      ...RUN.map((pose) => ({ ...pose, weapon: -0.8 })),
      p({ lean: -4, frontArm: 160, weapon: -1.5, bob: 1, frontFootX: 2, backFootX: -5 }),
      p({ lean: 6, frontArm: 46, weapon: 0.25, frontFootX: 8, backFootX: -1 }),
      p({ lean: -4, frontArm: 190, weapon: -2.2, bob: 2, frontFootX: 1, backFootX: -4 }),
      p({ lean: 2, frontArm: 24, weapon: 1.25, bob: 3, frontFootX: 5, backFootX: -2 }),
      p({ lean: 1, frontArm: 14, weapon: 1.4, bob: 2, frontFootX: 4, backFootX: -2 }),
      p({ lean: -5, frontArm: 20, weapon: 0.9 }),
      p({ prone: true }),
    ];
  }
  return [
    ...idle(2, -1.4),
    ...RUN.map((pose) => ({ ...pose, weapon: -0.9 })),
    p({ lean: -3, frontArm: 168, weapon: -2.1, bob: 1 }),
    p({ lean: 2, frontArm: 90, weapon: -0.45, frontFootX: 6 }),
    p({ lean: 4, frontArm: 40, weapon: 0.35, frontFootX: 8 }),
    p({ lean: 2, frontArm: 18, weapon: 0.9, bob: 1 }),
    p({ lean: -2, frontArm: 100, weapon: -0.1 }),
    p({ lean: 3, frontArm: 88, weapon: 0.05, frontFootX: 6, glow: true }),
    p({ lean: -3, frontArm: 96, weapon: -0.2, glow: true }),
    p({ lean: 1, frontArm: 90, weapon: 0, glow: true }),
    p({ lean: -4, frontArm: 188, weapon: -2.3, bob: 2 }),
    p({ lean: 3, frontArm: 30, weapon: 1.15, bob: 3, frontFootX: 5 }),
    p({ lean: 1, frontArm: 16, weapon: 1.35, bob: 2 }),
    p({ lean: -6, frontArm: 8, weapon: 1.1, headX: -2 }),
    p({ prone: true }),
  ];
}

function countOf(id: string): number {
  return Object.values(SHEET[id]).reduce((max, clip) => Math.max(max, clip.start + clip.count), 0);
}

function addSheet(scene: Phaser.Scene, key: string, frames: HTMLCanvasElement[]): void {
  const fw = frames[0].width;
  const fh = frames[0].height;
  const sheet = document.createElement("canvas");
  sheet.width = fw * frames.length;
  sheet.height = fh;
  const ctx = sheet.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  frames.forEach((frame, index) => ctx.drawImage(frame, index * fw, 0));
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addSpriteSheet(key, sheet as unknown as HTMLImageElement, { frameWidth: fw, frameHeight: fh });
}

function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function makeSky(look: StageLook): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const bands = 45;
  for (let i = 0; i < bands; i += 1) {
    ctx.fillStyle = mix(look.skyTop, look.skyBot, i / (bands - 1));
    const y = Math.floor((i * 540) / bands);
    const h = Math.ceil(540 / bands) + 1;
    ctx.fillRect(0, y, 960, h);
  }
  const rng = new Rng(look.name.length * 97 + 3);
  for (let i = 0; i < 80; i += 1) {
    const bright = rng.chance(0.18);
    ctx.fillStyle = bright ? "#f6f1e2" : "#c9d4ea";
    ctx.fillRect(rng.int(960), rng.int(250), bright ? 2 : 1, bright ? 2 : 1);
  }
  const mx = 790;
  const my = 86;
  ctx.fillStyle = look.moon;
  ctx.beginPath();
  ctx.arc(mx, my, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.skyTop;
  ctx.beginPath();
  ctx.arc(mx + 12, my - 6, 22, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function makeFar(look: StageLook): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 640, 540);
  ctx.fillStyle = look.far;
  for (let x = 0; x < 640; x += 2) {
    const ridge =
      300 +
      Math.sin(x * 0.02) * 48 +
      Math.sin(x * 0.047 + 1.4) * 26 +
      Math.sin(x * 0.01) * 18;
    ctx.fillRect(x, ridge, 2, 540 - ridge);
  }
  ctx.fillStyle = look.farHi;
  for (let x = 0; x < 640; x += 2) {
    const ridge =
      300 +
      Math.sin(x * 0.02) * 48 +
      Math.sin(x * 0.047 + 1.4) * 26 +
      Math.sin(x * 0.01) * 18;
    ctx.fillRect(x, ridge, 2, 3);
  }
  return canvas;
}

function makeMid(stage: number, look: StageLook): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 540;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 720, 540);
  const ground = 430;
  if (stage === 1) {
    tree(ctx, 70, ground, 78, look.mid, look.midHi);
    pagoda(ctx, 180, ground, look.mid, look.accent);
    tree(ctx, 340, ground, 96, look.mid, look.midHi);
    tree(ctx, 470, ground, 64, look.mid, look.midHi);
    pagoda(ctx, 560, ground, look.mid, look.accent);
  } else if (stage === 2) {
    for (let i = 0; i < 9; i += 1) {
      bamboo(ctx, 30 + i * 78, ground, 90 + (i % 3) * 28, i % 2 ? look.midHi : look.mid);
    }
  } else {
    ruin(ctx, 40, ground, 70, 86, look.mid, look.accent);
    ruin(ctx, 220, ground, 110, 120, look.mid, look.accent);
    ruin(ctx, 430, ground, 54, 70, look.mid, look.accent);
    ruin(ctx, 560, ground, 90, 100, look.mid, look.accent);
  }
  return canvas;
}

function tree(ctx: CanvasRenderingContext2D, x: number, ground: number, h: number, color: string, leaf: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, ground - h, 8, h);
  ctx.fillStyle = leaf;
  for (let i = 0; i < 3; i += 1) {
    const fw = 36 - i * 8;
    const fy = ground - h - 8 + i * 16;
    ctx.fillRect(x + 4 - fw / 2, fy, fw, 14);
  }
}

function pagoda(ctx: CanvasRenderingContext2D, x: number, ground: number, color: string, roof: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, ground - 78, 26, 78);
  ctx.fillStyle = roof;
  for (let i = 0; i < 3; i += 1) {
    const w = 54 - i * 10;
    ctx.fillRect(x + 13 - w / 2, ground - 34 - i * 24, w, 5);
  }
}

function bamboo(ctx: CanvasRenderingContext2D, x: number, ground: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, ground - h, 5, h);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let y = ground - h + 8; y < ground; y += 16) ctx.fillRect(x, y, 5, 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + 5, ground - h + 16, 16, 3);
  ctx.fillRect(x - 16, ground - h + 32, 16, 3);
}

function ruin(ctx: CanvasRenderingContext2D, x: number, ground: number, w: number, h: number, color: string, accent: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, ground - h, w, h);
  ctx.clearRect(x + Math.floor(w * 0.45), ground - h, 10, 12);
  ctx.clearRect(x + 8, ground - Math.floor(h * 0.55), 10, 16);
  ctx.fillStyle = accent;
  ctx.fillRect(x + w - 6, ground - h - 16, 3, 18);
  ctx.fillRect(x + w - 12, ground - h - 16, 12, 4);
}

function makeGround(look: StageLook): { top: HTMLCanvasElement; fill: HTMLCanvasElement } {
  const top = document.createElement("canvas");
  top.width = 48;
  top.height = 18;
  const tctx = top.getContext("2d");
  const fill = document.createElement("canvas");
  fill.width = 48;
  fill.height = 48;
  const fctx = fill.getContext("2d");
  if (!tctx || !fctx) return { top, fill };
  tctx.fillStyle = look.groundTop;
  tctx.fillRect(0, 0, 48, 8);
  tctx.fillStyle = look.ground;
  tctx.fillRect(0, 8, 48, 10);
  tctx.fillStyle = "rgba(255,255,255,0.28)";
  tctx.fillRect(0, 0, 48, 2);
  tctx.fillStyle = look.groundDark;
  for (let i = 0; i < 8; i += 1) tctx.fillRect((i * 11) % 46, 4 + (i % 3), 3, 2);

  fctx.fillStyle = look.ground;
  fctx.fillRect(0, 0, 48, 48);
  fctx.fillStyle = look.groundDark;
  fctx.fillRect(0, 16, 48, 1);
  fctx.fillRect(0, 32, 48, 1);
  fctx.fillRect(24, 0, 1, 16);
  fctx.fillRect(8, 16, 1, 16);
  fctx.fillRect(36, 32, 1, 16);
  for (let i = 0; i < 10; i += 1) fctx.fillRect((i * 13) % 44, (i * 7) % 44, 2, 2);
  return { top, fill };
}

function prop(draw: (ctx: CanvasRenderingContext2D) => void, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  return canvas;
}

function makeProps(scene: Phaser.Scene): void {
  addCanvas(
    scene,
    "grass",
    prop((ctx) => {
      ctx.fillStyle = "#6f8f48";
      ctx.fillRect(4, 10, 3, 10);
      ctx.fillRect(10, 6, 3, 14);
      ctx.fillRect(16, 11, 3, 9);
      ctx.fillStyle = "#cfe07a";
      ctx.fillRect(9, 4, 5, 3);
    }, 24, 24),
  );
  addCanvas(
    scene,
    "rock",
    prop((ctx) => {
      ctx.fillStyle = "#6d675e";
      ctx.fillRect(4, 10, 20, 10);
      ctx.fillRect(8, 6, 12, 6);
      ctx.fillStyle = "#948c80";
      ctx.fillRect(8, 8, 6, 3);
    }, 28, 22),
  );
  addCanvas(
    scene,
    "banner",
    prop((ctx) => {
      ctx.fillStyle = "#8a8174";
      ctx.fillRect(4, 2, 3, 36);
      ctx.fillStyle = "#a33b3b";
      ctx.fillRect(7, 4, 14, 18);
      ctx.fillStyle = "#e6c36a";
      ctx.fillRect(10, 8, 8, 3);
    }, 24, 40),
  );
  addCanvas(
    scene,
    "grave",
    prop((ctx) => {
      ctx.fillStyle = "#8d8680";
      ctx.fillRect(6, 8, 16, 22);
      ctx.fillRect(8, 4, 12, 6);
      ctx.fillStyle = "#5c564e";
      ctx.fillRect(12, 12, 4, 8);
    }, 28, 32),
  );
  const lanternFrames: HTMLCanvasElement[] = [];
  for (let f = 0; f < 2; f += 1) {
    lanternFrames.push(
      prop((ctx) => {
        ctx.fillStyle = "#3a2418";
        ctx.fillRect(10, 0, 4, 8);
        ctx.fillStyle = "#8a2e24";
        ctx.fillRect(4, 8, 16, 18);
        ctx.fillStyle = f === 0 ? "#ffd27a" : "#ffe7b0";
        ctx.fillRect(8, 12, 8, 8);
        ctx.fillStyle = "#e6c36a";
        ctx.fillRect(4, 26, 16, 3);
      }, 24, 36),
    );
  }
  addSheet(scene, "lantern", lanternFrames);

  const portal: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f += 1) {
    const buf = createBuf(24, 36);
    stampRect(buf, 4, 4, 4, 28, "#d7c08a");
    stampRect(buf, 16, 4, 4, 28, "#d7c08a");
    stampRect(buf, 4, 2, 16, 4, "#e6c36a");
    for (let y = 8; y < 30; y += 2) {
      const sway = Math.sin(y * 0.4 + f) * 1.5;
      stampDisc(buf, 12 + sway, y, 1.2, f % 2 ? "#9ee7ff" : "#f3e2ff");
    }
    portal.push(upscale(buf));
  }
  addSheet(scene, "portal", portal);

  const slash: HTMLCanvasElement[] = [];
  for (let f = 0; f < 4; f += 1) {
    const buf = createBuf(28, 28);
    const span = 0.45 + f * 0.4;
    for (let a = -1.3; a < -1.3 + span; a += 0.12) {
      stampDisc(buf, 8 + Math.cos(a) * (8 + f * 2), 16 + Math.sin(a) * (8 + f * 2), f === 3 ? 0.8 : 1.35, f % 2 ? "#d9f6ff" : "#ffffff");
    }
    slash.push(upscale(buf));
  }
  addSheet(scene, "slash", slash);

  const dust: HTMLCanvasElement[] = [];
  for (let f = 0; f < 3; f += 1) {
    const buf = createBuf(16, 12);
    stampDisc(buf, 5, 7, 2.2 - f * 0.3, "#d9d3c8");
    stampDisc(buf, 10, 6, 1.8, "#b7b1a6");
    if (f > 0) stampDisc(buf, 8, 4, 1.2, "#eeeae2");
    dust.push(upscale(buf));
  }
  addSheet(scene, "dust", dust);

  const energy = createBuf(18, 8);
  stampDisc(energy, 4, 4, 2.4, "#16324a");
  stampLine(energy, 2, 4, 16, 4, 1.6, "#9eecff");
  stampLine(energy, 4, 4, 15, 4, 0.7, "#ffffff");
  addCanvas(scene, "energy", upscale(energy));

  const arrow = createBuf(16, 6);
  stampLine(arrow, 1, 3, 12, 3, 0.8, "#c49658");
  stampLine(arrow, 11, 1, 15, 3, 0.9, "#e8eef4");
  stampLine(arrow, 11, 5, 15, 3, 0.9, "#e8eef4");
  addCanvas(scene, "arrow", upscale(arrow));

  const bomb = createBuf(12, 12);
  stampDisc(bomb, 6, 6, 4.2, "#6a2414");
  stampDisc(bomb, 6, 6, 2.6, "#e07030");
  stampDisc(bomb, 6, 3.2, 1.1, "#ffe08a");
  addCanvas(scene, "bomb", upscale(bomb));

  const crescent = createBuf(16, 12);
  for (let a = -0.8; a <= 0.8; a += 0.15) {
    stampDisc(crescent, 8 + Math.cos(a) * 5, 6 + Math.sin(a) * 4, 1.3, "#e4c6ff");
  }
  stampDisc(crescent, 12, 6, 1.6, "#fff6ff");
  addCanvas(scene, "crescent", upscale(crescent));

  const shock = createBuf(18, 8);
  stampLine(shock, 1, 5, 16, 4, 1.8, "#e6d2b4");
  stampDisc(shock, 6, 4, 1.4, "#fff4e2");
  stampDisc(shock, 12, 5, 1.5, "#fff4e2");
  addCanvas(scene, "shock", upscale(shock));

  const px = document.createElement("canvas");
  px.width = 6;
  px.height = 6;
  const pctx = px.getContext("2d");
  if (pctx) {
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(0, 0, 6, 6);
  }
  addCanvas(scene, "px", px);
}

export function createArt(scene: Phaser.Scene): void {
  for (const id of Object.keys(STYLES)) {
    const frames = posesFor(id).map((pose, index) => renderPose(STYLES[id], { ...pose, scarfT: pose.scarfT ?? index }));
    const expect = countOf(id);
    if (frames.length !== expect) {
      throw new Error(`${id} 帧数是 ${frames.length}，动画表需要 ${expect}`);
    }
    addSheet(scene, `ch-${id}`, frames);
  }
  ([1, 2, 3] as const).forEach((stage) => {
    const look = STAGE_LOOK[stage];
    addCanvas(scene, `sky-${stage}`, makeSky(look));
    addCanvas(scene, `far-${stage}`, makeFar(look));
    addCanvas(scene, `mid-${stage}`, makeMid(stage, look));
    const ground = makeGround(look);
    addCanvas(scene, `ground-top-${stage}`, ground.top);
    addCanvas(scene, `ground-fill-${stage}`, ground.fill);
  });
  makeProps(scene);
}
