import Phaser from 'phaser';
import type { CharacterId, WeaponId } from '../core/types';
import { blob, inkOutline, mix, Pix } from './pix';
import { bakeGlow, bakeParallax, bakeVignette } from './bake';

export const PLAYER_W = 72;
export const PLAYER_H = 64;
export const PLAYER_OX = 26;
export const PLAYER_OY = 54;

const INK = 0x140c18;
const SKIN = 0xf2c3a2;
const SKIN_HI = 0xffe0c8;
const SKIN_DK = 0xc48462;
const EMBER = 0xff6a2a;
const EMBER_HI = 0xffe1b0;
const EMBER_DK = 0xa33a16;
const STEEL = 0xd5dbe6;
const STEEL_DK = 0x6e7888;
const GOLD = 0xc8a05a;

interface Pose {
  bob: number;
  lean: number;
  front: number;
  back: number;
  crouch: number;
  stretch: number;
  ang: number;
  cape: number;
  blink: boolean;
  glow: number;
  fallen: number;
}

const LOCO = ['idle', 'run', 'jump', 'fall', 'land', 'charge', 'hurt', 'dead', 'dash', 'parry', 'heal'] as const;

function attackAnims(weapon: WeaponId): string[] {
  const base = ['l1', 'l2', 'l3', 'heavy', 'heavyFull', 'air', 'airHeavy', 'plunge', 'skill'];
  if (weapon === 'dagger') base.splice(3, 0, 'l4');
  return base;
}

function framesOf(anim: string): number {
  if (anim === 'idle') return 6;
  if (anim === 'run') return 8;
  if (anim === 'dead') return 7;
  if (anim === 'land' || anim === 'charge' || anim === 'dash' || anim === 'parry' || anim === 'heal') return 4;
  if (anim === 'jump' || anim === 'fall' || anim === 'hurt') return 3;
  return 7;
}

function poseFor(anim: string, frame: number): Pose {
  const p: Pose = {
    bob: 0, lean: 0, front: 0, back: 0, crouch: 0, stretch: 0,
    ang: -0.55, cape: frame, blink: false, glow: 0, fallen: 0,
  };
  if (anim === 'idle') {
    p.bob = [0, 0, 1, 1, 0, 0][frame % 6]!;
    p.blink = frame % 6 === 4;
    p.ang = -0.7;
  } else if (anim === 'run') {
    const step = [0, 1, 2, 1, 0, -1, -2, -1][frame % 8]!;
    p.front = step;
    p.back = -step;
    p.bob = Math.abs(step) === 2 ? -1 : 0;
    p.lean = 1;
    p.ang = -0.35;
    p.stretch = Math.abs(step) === 2 ? 1 : 0;
  } else if (anim === 'jump') {
    p.stretch = frame === 0 ? 3 : 2;
    p.front = 2;
    p.back = -2;
    p.ang = -1.15;
    p.bob = frame === 0 ? -2 : -1;
    p.crouch = frame === 0 ? 1 : 0;
  } else if (anim === 'fall') {
    p.stretch = 1;
    p.front = 2;
    p.back = -1;
    p.ang = 0.55;
    p.bob = 1;
  } else if (anim === 'land') {
    p.crouch = [5, 3, 1, 0][frame % 4]!;
    p.ang = 0.85;
    p.front = frame === 0 ? 2 : 0;
    p.back = frame === 0 ? -1 : 0;
  } else if (anim === 'charge') {
    p.crouch = 3;
    p.lean = -2;
    p.ang = 2.35;
    p.glow = frame / 3;
  } else if (anim === 'hurt') {
    p.lean = -4;
    p.ang = 1.5;
    p.bob = 1;
    p.crouch = 1;
  } else if (anim === 'dead') {
    p.fallen = frame / 6;
    p.lean = -2 - frame;
    p.crouch = Math.min(6, frame);
    p.ang = 1.3;
  } else if (anim === 'dash') {
    p.lean = 5;
    p.ang = 0.05;
    p.bob = 1;
    p.crouch = 2;
  } else if (anim === 'parry') {
    p.lean = -1;
    p.ang = -1.45;
    p.crouch = frame < 2 ? 2 : 1;
  } else if (anim === 'heal') {
    p.crouch = 3;
    p.ang = -2.3;
    p.lean = -1;
  } else if (anim === 'l1') p.ang = [-2.3, -1.6, -0.35, 0.55, 0.95, 0.5, 0.05][frame] ?? 0;
  else if (anim === 'l2') p.ang = [-2.5, -1.8, -0.55, 0.4, 1.1, 0.65, 0.1][frame] ?? 0;
  else if (anim === 'l3' || anim === 'l4') {
    p.ang = [1.15, 0.35, -0.65, -1.7, -2.35, -1.55, -0.7][frame] ?? -0.7;
    p.bob = frame >= 2 && frame <= 4 ? -2 : 0;
    p.stretch = frame >= 2 && frame <= 4 ? 2 : 0;
  } else if (anim === 'heavy') {
    p.ang = [2.55, 2.35, 1.15, 0.1, -0.2, 0.4, 0.75][frame] ?? 0.4;
    p.lean = frame < 2 ? -3 : 3;
    p.crouch = frame < 2 ? 3 : 0;
  } else if (anim === 'heavyFull') {
    p.ang = [2.7, 2.45, 0.85, -0.15, -0.35, 0.5, 0.85][frame] ?? 0.5;
    p.glow = 1;
    p.lean = frame < 2 ? -3 : 4;
    p.crouch = frame < 2 ? 3 : 0;
  } else if (anim === 'air') {
    p.ang = [-0.6, 0.05, 0.7, 1.2, 0.85, 0.3, 0][frame] ?? 0;
    p.bob = -1;
    p.stretch = 1;
  } else if (anim === 'airHeavy') {
    p.ang = [0.35, 0.95, 1.55, 2.1, 1.75, 1.2, 0.8][frame] ?? 1;
    p.bob = -1;
    p.stretch = 1;
  } else if (anim === 'plunge') {
    p.ang = 1.6;
    p.lean = 1;
    p.bob = 2;
    p.stretch = 2;
  } else if (anim === 'skill') {
    p.ang = [-0.9, -0.25, 0.15, 0.2, 0.45, 0.65, 0.2][frame] ?? 0;
    p.lean = [0, 2, 5, 5, 3, 1, 0][frame] ?? 0;
    p.crouch = frame >= 2 && frame <= 4 ? 1 : 0;
  }
  const swing = anim.startsWith('l') || anim === 'heavy' || anim === 'heavyFull' || anim === 'air' || anim === 'airHeavy';
  if (swing && frame === 0) {
    p.crouch = Math.max(p.crouch, 2);
    p.lean -= 1;
  }
  if (swing && (frame === 2 || frame === 3)) p.lean += 1;
  return p;
}

interface Palette {
  cloth: number;
  hi: number;
  dk: number;
  skin: number;
  skinHi: number;
  skinDk: number;
  hair: number;
  hairHi: number;
  scarf: number;
  scarfHi: number;
  boot: number;
  bootHi: number;
  metal: number;
  metalHi: number;
  helm: boolean;
  slim: boolean;
  wide: boolean;
}

function paletteOf(char: CharacterId): Palette {
  if (char === 'dancer') {
    return {
      cloth: 0x1c3858, hi: 0x8ed4f2, dk: 0x102033,
      skin: 0xf6d0b4, skinHi: 0xffead8, skinDk: 0xd09674,
      hair: 0x14202e, hairHi: 0xd8f6ff,
      scarf: 0x7ad8ff, scarfHi: 0xe8fbff,
      boot: 0x101820, bootHi: 0x3a4a5c,
      metal: 0xb7c4d4, metalHi: 0xf4f7fb,
      helm: false, slim: true, wide: false,
    };
  }
  if (char === 'bulwark') {
    return {
      cloth: 0x4a5568, hi: 0xd5dde8, dk: 0x2a3140,
      skin: SKIN, skinHi: SKIN_HI, skinDk: SKIN_DK,
      hair: 0x8e3030, hairHi: 0xf0d0a0,
      scarf: 0x8e3030, scarfHi: 0xe07058,
      boot: 0x2a241c, bootHi: 0x6a5840,
      metal: 0x9aa4b4, metalHi: 0xf2f5fa,
      helm: true, slim: false, wide: true,
    };
  }
  return {
    cloth: 0x6a5088, hi: 0xd4c0ee, dk: 0x3a2a54,
    skin: SKIN, skinHi: SKIN_HI, skinDk: SKIN_DK,
    hair: 0x241828, hairHi: 0x7a6088,
    scarf: 0xe85a32, scarfHi: 0xffc090,
    boot: 0x241820, bootHi: 0x5a4038,
    metal: STEEL, metalHi: 0xf4f7fb,
    helm: false, slim: false, wide: false,
  };
}

function upSwing(anim: string): boolean {
  return anim === 'l3' || anim === 'l4' || anim === 'airHeavy' || anim === 'plunge';
}

function swinging(anim: string): boolean {
  return anim.startsWith('l') || anim === 'heavy' || anim === 'heavyFull' || anim === 'air' || anim === 'airHeavy' || anim === 'plunge' || anim === 'skill';
}

function blade(
  pix: Pix,
  x: number,
  y: number,
  ang: number,
  len: number,
  core: number,
  edge: number,
  a = 255,
): { x: number; y: number } {
  const x1 = Math.round(x + Math.cos(ang) * len);
  const y1 = Math.round(y + Math.sin(ang) * len);
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  pix.line(Math.round(x - px), Math.round(y - py), Math.round(x1 - px), Math.round(y1 - py), mix(core, 0x000000, 0.45), a);
  pix.line(x, y, x1, y1, core, a);
  pix.line(Math.round(x + px), Math.round(y + py), Math.round(x1 + px), Math.round(y1 + py), edge, a);
  pix.px(x1, y1, edge, a);
  return { x: x1, y: y1 };
}

function guard(pix: Pix, x: number, y: number, ang: number): void {
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  for (let i = -2; i <= 2; i++) {
    pix.px(Math.round(x + px * i), Math.round(y + py * i), GOLD);
  }
  pix.px(Math.round(x), Math.round(y), EMBER_DK);
}

function hammerHead(pix: Pix, x: number, y: number, ang: number, glow: number): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const px = -s;
  const py = c;
  for (let i = -5; i <= 5; i++) {
    for (let j = -3; j <= 2; j++) {
      const edge = Math.abs(i) >= 4 || j === -3 || j === 2;
      const col = edge ? STEEL_DK : i === 0 ? mix(STEEL, EMBER, 0.25) : STEEL;
      pix.px(Math.round(x + px * i + c * j), Math.round(y + py * i + s * j), col);
    }
  }
  pix.px(x, y, glow > 0.4 ? EMBER_HI : EMBER);
  if (glow > 0.4) blob(pix, x, y, 6, 5, EMBER, 70);
}

function drawWeapon(pix: Pix, x: number, y: number, weapon: WeaponId, ang: number, glow: number, trail: number): void {
  const len = weapon === 'dagger' ? 11 : weapon === 'hammer' ? 13 : 16;
  const hot = glow > 0.55;
  const core = hot ? EMBER_HI : weapon === 'hammer' ? 0x8a6844 : STEEL;
  const edge = hot ? 0xffffff : weapon === 'hammer' ? 0xc4a070 : STEEL_DK;
  if (trail !== 0) {
    blade(pix, x, y, ang + trail, len - 1, EMBER, EMBER_HI, 150);
    blade(pix, x, y, ang + trail * 1.7, len - 3, EMBER_DK, EMBER, 80);
  }
  const tip = blade(pix, x, y, ang, len, core, edge);
  if (weapon === 'hammer') hammerHead(pix, tip.x, tip.y, ang, glow);
  else {
    guard(pix, x + Math.cos(ang) * 3, y + Math.sin(ang) * 3, ang);
    pix.rect(x - 1, y - 1, 3, 3, 0x6a4a28);
    pix.px(x, y, GOLD);
    pix.px(tip.x, tip.y, EMBER_HI);
    if (weapon === 'dagger') {
      blade(pix, x - 2, y + 3, ang + 2.4, 9, STEEL, STEEL_DK);
      pix.px(Math.round(x - 2 + Math.cos(ang + 2.4) * 9), Math.round(y + 3 + Math.sin(ang + 2.4) * 9), EMBER);
    }
  }
  if (hot) blade(pix, x, y, ang, len, EMBER, EMBER_HI, 80);
}

function boot(pix: Pix, x: number, y: number, pal: Palette): void {
  pix.rect(x - 1, y, 5, 4, pal.boot);
  pix.rect(x, y, 3, 1, pal.bootHi);
  pix.px(x + 3, y + 3, mix(pal.boot, 0x000000, 0.45));
  pix.erase(x - 1, y);
  pix.erase(x + 3, y + 3);
}

function limb(pix: Pix, x: number, y: number, h: number, mid: number, dk: number): void {
  const hh = Math.max(2, h);
  pix.rect(x, y, 3, hh, mid);
  pix.rect(x, y, 1, hh, dk);
  pix.rect(x + 1, y, 2, 1, mix(mid, 0xffffff, 0.2));
}

function cape(pix: Pix, x: number, y: number, len: number, pal: Palette, frame: number, dash: boolean): void {
  const n = len + (dash ? 5 : 0);
  for (let i = 0; i < n; i++) {
    const sway = i < 2 ? 0 : ((frame + i) % 3) - 1;
    const xx = x - Math.floor(i * 0.7) + sway;
    const yy = y + Math.floor(i * 0.82);
    const w = i < 2 ? 2 : i < n * 0.65 ? 4 : 3;
    pix.rect(xx - w + 1, yy, w, 2, i % 2 === 0 ? pal.scarf : mix(pal.scarf, 0x000000, 0.28));
    pix.px(xx - w + 1, yy, pal.scarfHi);
    if (i > 3 && i % 3 === 0) pix.px(xx - w, yy + 2, pal.scarfHi);
  }
}

function hairTail(pix: Pix, x: number, y: number, pal: Palette, frame: number, long: boolean): void {
  const flick = (frame % 3) - 1;
  const n = long ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const sway = i > 1 ? flick + ((i + frame) % 2) : 0;
    const xx = x + sway + (long ? Math.floor(i * 0.35) : 0);
    pix.rect(xx, y + i, 2, 1, i % 2 ? pal.hairHi : pal.hair);
    if (long && i % 2 === 0) pix.px(xx + 2, y + i, pal.scarf);
  }
}

function head(pix: Pix, x: number, y: number, pal: Palette, blink: boolean, frame: number): void {
  if (pal.helm) {
    pix.rect(x - 1, y, 10, 8, pal.metal);
    pix.rect(x, y, 8, 2, pal.metalHi);
    pix.rect(x, y + 1, 1, 6, pal.dk);
    pix.rect(x + 1, y + 3, 6, 2, 0x12141c);
    pix.px(x + 2, y + 3, EMBER);
    pix.px(x + 5, y + 3, EMBER_HI);
    pix.erase(x - 1, y);
    pix.erase(x + 8, y);
    const bob = frame % 2;
    pix.rect(x + 3, y - 4 - bob, 2, 4, pal.scarf);
    pix.px(x + 3, y - 5 - bob, pal.scarfHi);
    pix.px(x + 4, y - 3 - bob, EMBER_HI);
    return;
  }
  pix.rect(x, y + 2, 8, 6, pal.skin);
  pix.rect(x, y + 2, 1, 5, pal.skinDk);
  pix.rect(x + 1, y + 2, 6, 1, pal.skinHi);
  pix.erase(x, y + 7);
  pix.erase(x + 7, y + 7);
  pix.rect(x - 2, y - 1, 12, 4, pal.hair);
  pix.rect(x + 1, y - 2, 5, 2, pal.hair);
  pix.rect(x + 2, y - 2, 2, 1, pal.hairHi);
  pix.rect(x - 2, y + 2, 3, 4, pal.hair);
  pix.rect(x + 6, y + 2, 3, 3, pal.hair);
  pix.erase(x - 2, y - 1);
  pix.erase(x + 9, y - 1);
  pix.erase(x + 1, y - 2);
  if (blink) pix.rect(x + 2, y + 4, 4, 1, pal.skinDk);
  else {
    pix.px(x + 2, y + 4, INK);
    pix.px(x + 5, y + 4, INK);
    pix.px(x + 6, y + 4, pal.skinHi);
  }
  pix.px(x + 1, y + 6, pal.skinDk);
  pix.px(x + 6, y + 6, pal.skinDk);
  hairTail(pix, x + 8, y + 1, pal, frame, pal.slim);
}

function kiteShield(pix: Pix, x: number, y: number, h: number, metal: number): void {
  for (let row = 0; row < h; row++) {
    const t = row / Math.max(1, h - 1);
    const w = t < 0.12 ? 4 : t < 0.58 ? 11 : Math.max(2, Math.round(11 * (1 - (t - 0.58) / 0.42)));
    const x0 = x - Math.floor(w / 2);
    pix.rect(x0, y + row, w, 1, t > 0.16 && t < 0.3 ? mix(metal, 0xffffff, 0.3) : metal);
    pix.px(x0, y + row, mix(metal, 0x000000, 0.45));
    pix.px(x, y + row, mix(metal, 0xffffff, 0.2));
  }
  const emblem = y + Math.floor(h * 0.36);
  pix.rect(x - 1, emblem, 3, 3, EMBER);
  pix.px(x, emblem, EMBER_HI);
}

function drawPlayer(char: CharacterId, weapon: WeaponId, anim: string, frame: number): HTMLCanvasElement {
  const pix = new Pix(PLAYER_W, PLAYER_H);
  const pose = poseFor(anim, frame);
  const pal = paletteOf(char);
  const cx = PLAYER_OX + pose.lean;
  const feet = PLAYER_OY + pose.bob + (pose.fallen > 0.45 ? Math.round(pose.fallen * 8) : 0);
  const squat = Math.max(0, pose.crouch);
  const stretch = pose.stretch;
  const wide = pal.wide ? 2 : pal.slim ? -2 : 0;
  const legH = Math.max(4, 9 + stretch - Math.min(5, squat));
  const th = Math.max(6, 11 + (pal.wide ? 1 : 0) - Math.min(4, squat));
  const tw = 10 + wide + (squat >= 3 ? 2 : 0) - (stretch > 1 ? 1 : 0);

  if (pose.fallen < 0.75) blob(pix, cx, PLAYER_OY + 2, 7 - Math.min(3, squat), 2, 0x000000, 70);

  if (pose.fallen > 0.62) {
    const y = feet - 8;
    pix.rect(cx - 12, y, 22, 6, pal.cloth);
    pix.rect(cx - 12, y, 22, 1, pal.hi);
    pix.rect(cx - 10, y + 2, 5, 3, pal.skin);
    pix.rect(cx + 6, y + 1, 4, 3, pal.boot);
    pix.px(cx + 8, y + 2, EMBER);
    drawWeapon(pix, cx + 2, y + 3, weapon, 0.2, pose.glow, 0);
    inkOutline(pix);
    return pix.toCanvas();
  }

  const backX = cx - 5 + pose.back * 2;
  const frontX = cx + 1 + pose.front * 2;
  const tx = cx - Math.floor(tw / 2);
  const ty = feet - legH - th + 2;

  cape(pix, tx + 1, ty + 2, pal.wide ? 11 : pal.slim ? 5 : 8, pal, pose.cape + (anim === 'run' ? 1 : 0), anim === 'dash');

  limb(pix, backX, feet - legH, legH - 4, pal.dk, mix(pal.dk, 0x000000, 0.35));
  boot(pix, backX, feet - 4, pal);
  limb(pix, frontX, feet - legH, legH - 4, pal.cloth, pal.dk);
  boot(pix, frontX, feet - 4, pal);

  for (let row = 0; row < th; row++) {
    const flare = row > th * 0.5 ? Math.min(pal.wide ? 2 : 3, Math.floor((row - th * 0.5) / 1.6)) : 0;
    const w = tw + flare * 2;
    const x0 = cx - Math.floor(w / 2);
    pix.rect(x0, ty + row, w, 1, row < 2 && !pal.helm ? pal.dk : pal.cloth);
    pix.px(x0, ty + row, pal.dk);
    pix.px(x0 + w - 1, ty + row, pal.hi);
  }
  pix.rect(cx - 1, ty + Math.floor(th * 0.42), 2, 2, EMBER);
  pix.px(cx - 1, ty + Math.floor(th * 0.42), EMBER_HI);
  pix.rect(tx + tw - 4, ty + 1, 3, 3, pal.hi);
  if (!pal.wide) pix.rect(tx - 3, ty + 3, 3, 5, mix(pal.dk, 0x3a2418, 0.15));

  const shoulderX = tx + tw - 3;
  const shoulderY = ty + 3;
  limb(pix, tx - 1, ty + 4, 6, pal.dk, mix(pal.dk, 0x000000, 0.3));
  pix.rect(tx - 1, ty + 9, 3, 3, pal.helm ? pal.metal : pal.skinDk);

  head(pix, cx - 4, ty - (pal.helm ? 8 : 7), pal, pose.blink, pose.cape);

  if (pal.wide) kiteShield(pix, tx - 1, ty + 1, 16, pal.metal);

  const armAng = pose.ang * 0.35 - 0.2;
  const reach = 7;
  const hx = Math.round(shoulderX + Math.cos(armAng) * reach);
  const hy = Math.round(shoulderY + Math.sin(armAng) * reach);
  pix.line(shoulderX, shoulderY, hx, hy, pal.cloth);
  pix.line(shoulderX, shoulderY + 1, hx, hy + 1, pal.dk);
  pix.rect(hx - 1, hy - 1, 3, 3, pal.helm ? pal.metal : pal.skin);
  pix.px(hx, hy - 1, pal.helm ? pal.metalHi : pal.skinHi);

  const trail = swinging(anim) && frame >= 2 && frame <= 4 ? (upSwing(anim) ? 0.55 : -0.55) : 0;
  drawWeapon(pix, hx + 1, hy + 1, weapon, pose.ang, pose.glow, trail);

  if (anim === 'heal') {
    pix.rect(cx - 2, ty + 4, 4, 5, 0x7dffb0);
    pix.rect(cx - 1, ty + 2, 2, 2, STEEL);
    pix.px(cx, ty + 1, 0xe8fff4);
  }
  if (anim === 'parry' && frame < 3) {
    pix.line(cx + 6, ty - 2, cx + 6, ty + th, EMBER_HI, 180);
    pix.px(cx + 6, ty + 2, 0xffffff);
  }

  inkOutline(pix);

  if (anim === 'dash') {
    for (let i = 1; i <= 4; i++) {
      pix.rect(cx - 6 - i * 4, feet - 18 + i, 3, 12 - i, pal.hi, 50 - i * 8);
    }
  }
  if (anim === 'run' && Math.abs(pose.front) === 2) {
    pix.px(frontX - 2, feet, 0xd8d0c4, 140);
    pix.px(frontX - 4, feet - 1, 0xb8b0a4, 100);
  }
  if (pose.glow > 0.6) blob(pix, hx + 4, hy, 5, 4, EMBER, 60);
  return pix.toCanvas();
}

export interface ActorBox {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export const ENEMY_BOX: Record<string, ActorBox> = {
  guard: { w: 56, h: 56, ox: 20, oy: 48 },
  archer: { w: 56, h: 56, ox: 22, oy: 48 },
  crawler: { w: 48, h: 32, ox: 22, oy: 26 },
  knight: { w: 64, h: 64, ox: 24, oy: 56 },
  slag: { w: 52, h: 52, ox: 24, oy: 46 },
  flea: { w: 32, h: 28, ox: 16, oy: 24 },
  bat: { w: 52, h: 36, ox: 26, oy: 22 },
  eliteBrute: { w: 72, h: 64, ox: 34, oy: 58 },
  phantom: { w: 48, h: 56, ox: 22, oy: 50 },
  mage: { w: 48, h: 60, ox: 22, oy: 54 },
  sentinel: { w: 52, h: 60, ox: 20, oy: 54 },
  sentinelElite: { w: 64, h: 60, ox: 26, oy: 54 },
  boss1: { w: 88, h: 88, ox: 36, oy: 78 },
  boss2: { w: 104, h: 96, ox: 50, oy: 88 },
  boss3: { w: 72, h: 88, ox: 34, oy: 78 },
  dummy: { w: 40, h: 52, ox: 18, oy: 46 },
};

function boxOf(kind: string): ActorBox {
  return ENEMY_BOX[kind] ?? ENEMY_BOX.guard!;
}

function stride(frame: number): number {
  return [0, 1, 2, 1, 0, -1, -2, -1][frame % 8]!;
}

function drawEnemy(kind: string, anim: string, frame: number): HTMLCanvasElement {
  const box = boxOf(kind);
  const pix = new Pix(box.w, box.h);
  const wind = anim === 'telegraph';
  const strike = anim === 'attack';
  const hurt = anim === 'hurt';
  const dead = anim === 'dead';
  const step = anim === 'walk' ? stride(frame) : 0;
  const lean = hurt ? -4 : wind ? -2 - frame : strike ? [3, 4, 2, 1, 0, 0][frame] ?? 0 : anim === 'walk' ? 1 : 0;
  const cx = box.ox + lean;
  const bob = dead ? Math.min(6, frame) : anim === 'idle' ? frame % 2 : anim === 'walk' && Math.abs(step) === 2 ? 1 : 0;
  const feet = box.oy + bob;
  if (kind === 'crawler') drawCrawler(pix, cx, feet, frame, strike, dead);
  else if (kind === 'flea') drawFlea(pix, cx, feet, frame, strike, wind);
  else if (kind === 'bat') drawBat(pix, cx, feet, frame, strike, dead, wind);
  else if (kind === 'slag') drawSlag(pix, cx, feet, frame, wind, strike, dead);
  else if (kind === 'eliteBrute' || kind === 'boss2') drawBrute(pix, cx, feet, frame, wind, strike, dead, kind === 'boss2', step);
  else if (kind === 'dummy') drawDummy(pix, cx, feet, frame, strike);
  else if (kind === 'archer') drawArcher(pix, cx, feet, frame, wind, strike, dead, step);
  else if (kind === 'phantom') drawPhantom(pix, cx, feet, frame, wind, strike, dead);
  else if (kind === 'mage') drawMage(pix, cx, feet, frame, wind, strike, dead);
  else if (kind === 'boss3') drawBoss3(pix, cx, feet, frame, wind, strike, dead);
  else if (kind === 'sentinelElite') {
    drawSentinel(pix, cx - 6, feet, frame, wind, strike, dead, true);
    drawSentinel(pix, cx + 8, feet, frame + 2, wind, strike, dead, false);
  } else if (kind === 'boss1' || kind === 'knight' || kind === 'guard' || kind === 'sentinel') {
    drawSoldier(pix, kind, cx, feet, frame, wind, strike, dead, step);
  } else drawSoldier(pix, 'guard', cx, feet, frame, wind, strike, dead, step);
  if (!dead) inkOutline(pix);
  else inkOutline(pix);
  if (wind) blob(pix, cx + 8, feet - 20, 4, 3, EMBER, 50 + frame * 20);
  return pix.toCanvas();
}

function legs(pix: Pix, cx: number, feet: number, step: number, cloth: number, dk: number, h = 10): void {
  limb(pix, cx - 5 + -step, feet - h, h - 3, dk, mix(dk, 0x000000, 0.4));
  pix.rect(cx - 6 - step, feet - 4, 5, 4, 0x241820);
  pix.rect(cx - 5 - step, feet - 4, 2, 1, 0x5a4638);
  limb(pix, cx + 1 + step, feet - h, h - 3, cloth, dk);
  pix.rect(cx + step, feet - 4, 5, 4, 0x1a1418);
  pix.rect(cx + 1 + step, feet - 4, 2, 1, 0x4a3a32);
}

function soldierWeapon(pix: Pix, kind: string, x: number, y: number, wind: boolean, strike: boolean, frame: number): void {
  const ang = wind ? -1.35 + frame * 0.12 : strike ? [0.15, 0.55, 0.9, 0.4, 0.1, -0.2][frame] ?? 0.2 : -0.55;
  const len = kind === 'boss1' ? 22 : kind === 'knight' ? 18 : kind === 'sentinel' ? 20 : 16;
  if (strike && frame <= 2) blade(pix, x, y, ang - 0.7, len, EMBER, EMBER_HI, 120);
  const core = kind === 'boss1' ? EMBER_HI : STEEL;
  const edge = kind === 'boss1' ? 0xffffff : STEEL_DK;
  const tip = blade(pix, x, y, ang, len, core, edge);
  if (kind === 'boss1' || kind === 'knight') blade(pix, x, y + 1, ang, len - 2, mix(core, EMBER, 0.4), edge, 200);
  guard(pix, x + Math.cos(ang) * 3, y + Math.sin(ang) * 3, ang);
  pix.px(tip.x, tip.y, EMBER_HI);
}

function drawSoldier(
  pix: Pix,
  kind: string,
  cx: number,
  feet: number,
  frame: number,
  wind: boolean,
  strike: boolean,
  dead: boolean,
  step: number,
): void {
  const boss = kind === 'boss1';
  const knight = kind === 'knight' || boss;
  const stone = kind === 'sentinel';
  const cloth = stone ? 0x9aa6c0 : knight ? 0x5a3848 : 0x6a546c;
  const hi = stone ? 0xe4ecff : knight ? 0xcbb0b8 : 0xd4c8d8;
  const dk = stone ? 0x3a4460 : knight ? 0x2e1c28 : 0x3a2c40;
  if (dead) {
    pix.rect(cx - 14, feet - 8, 26, 7, cloth);
    pix.rect(cx - 14, feet - 8, 26, 1, hi);
    pix.rect(cx + 8, feet - 6, 4, 3, EMBER);
    return;
  }
  const tall = boss ? 20 : knight || stone ? 14 : 12;
  const tw = boss ? 16 : knight ? 13 : 11;
  const ty = feet - 10 - tall;
  const tx = cx - Math.floor(tw / 2);
  const capePal = paletteOf(boss || knight ? 'bulwark' : 'wanderer');
  cape(pix, tx + 1, ty + 1, boss ? 18 : knight ? 12 : 6, capePal, frame, false);
  legs(pix, cx, feet, step, cloth, dk, boss ? 12 : 10);
  for (let row = 0; row < tall; row++) {
    const flare = row > tall * 0.6 ? Math.min(boss ? 4 : 2, Math.floor((row - tall * 0.6) / 2)) : 0;
    const w = tw + flare * 2;
    const x0 = cx - Math.floor(w / 2);
    pix.rect(x0, ty + row, w, 1, row < 2 ? dk : cloth);
    pix.px(x0, ty + row, dk);
    pix.px(x0 + w - 1, ty + row, hi);
  }
  pix.rect(cx - 1, ty + Math.floor(tall * 0.4), 3, 1, EMBER);
  pix.px(cx, ty + Math.floor(tall * 0.4) - 1, EMBER_HI);
  if (knight) {
    pix.rect(tx - 3, ty + 1, 4, 5, 0x7a848f);
    pix.rect(tx + tw - 1, ty + 1, 4, 5, 0x7a848f);
    pix.px(tx - 2, ty + 2, STEEL);
    pix.px(tx + tw, ty + 2, STEEL);
  }
  if (kind === 'guard' || kind === 'knight') kiteShield(pix, cx + (kind === 'knight' ? 8 : 7), ty + 1, kind === 'knight' ? 18 : 15, 0x9aa6b8);
  const hy = ty - (boss ? 12 : 9);
  pix.rect(cx - (boss ? 6 : 5), hy, boss ? 12 : 10, boss ? 10 : 8, stone ? 0xc5d0e4 : 0x4a403c);
  pix.rect(cx - 4, hy, boss ? 8 : 6, 2, stone ? 0xf4f7ff : STEEL);
  pix.rect(cx - 3, hy + 4, boss ? 7 : 5, 2, 0x121018);
  pix.px(cx - 2, hy + 4, EMBER);
  pix.px(cx + (boss ? 2 : 1), hy + 4, EMBER_HI);
  if (boss) {
    pix.line(cx - 6, hy + 2, cx - 10, hy - 6, 0x2a2420);
    pix.line(cx + 6, hy + 2, cx + 10, hy - 6, 0x2a2420);
    pix.px(cx - 10, hy - 6, EMBER);
    pix.px(cx + 10, hy - 6, EMBER_HI);
    const plume = frame % 3;
    pix.rect(cx - 1, hy - 6 - plume, 2, 5, 0x8a2420);
    pix.px(cx - 1, hy - 7 - plume, EMBER_HI);
  } else if (knight) {
    pix.rect(cx - 1, hy - 3 - (frame % 2), 2, 3, 0xa04038);
  }
  soldierWeapon(pix, kind, cx + 6, ty + 6, wind, strike, frame);
}

function drawArcher(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, strike: boolean, dead: boolean, step: number): void {
  if (dead) {
    pix.rect(cx - 10, feet - 6, 20, 5, 0x3a4a38);
    pix.rect(cx + 6, feet - 5, 6, 2, 0xc8b48a);
    return;
  }
  const cloth = 0x4a5a48;
  const hi = 0xa8c4a4;
  const dk = 0x243028;
  legs(pix, cx, feet, step, cloth, dk, 9);
  const ty = feet - 20;
  pix.rect(cx - 4, ty, 9, 11, cloth);
  pix.rect(cx - 4, ty, 1, 11, dk);
  pix.rect(cx - 2, ty, 5, 1, hi);
  pix.rect(cx - 3, ty + 8, 7, 2, 0x6a5438);
  pix.rect(cx + 4, ty + 2, 2, 5, 0x8a6848);
  pix.px(cx + 5, ty + 3, EMBER);
  pix.rect(cx - 4, ty - 8, 8, 8, dk);
  pix.rect(cx - 3, ty - 9, 6, 3, 0x1c2820);
  pix.px(cx - 4, ty - 9, hi);
  pix.rect(cx - 2, ty - 5, 5, 3, SKIN);
  if (frame % 6 !== 4) {
    pix.px(cx - 1, ty - 4, INK);
    pix.px(cx + 2, ty - 4, INK);
  }
  const pull = wind ? 2 + frame : strike ? 0 : 1;
  const bx = cx + 7;
  const by = ty + 2;
  pix.line(bx, by - 8, bx + 3, by, 0x8a6844);
  pix.line(bx, by + 8, bx + 3, by, 0x8a6844);
  pix.line(bx + 1, by - 7, bx + 1, by + 7, 0xe8dcc8);
  if (pull > 0 && !strike) {
    pix.line(bx + 1 - pull, by, bx + 1, by - 6, 0xe8dcc8);
    pix.line(bx + 1 - pull, by, bx + 1, by + 6, 0xe8dcc8);
    pix.line(bx + 1 - pull, by, bx + 12, by, STEEL);
    pix.px(bx + 13, by, EMBER_HI);
  }
  if (strike) pix.line(bx + 4, by, bx + 16, by - 1, EMBER_HI, 160);
}

function drawPhantom(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, strike: boolean, dead: boolean): void {
  if (dead) {
    for (let i = 0; i < 8; i++) pix.px(cx - 6 + i * 2, feet - 2, 0xb9a6ff, 120);
    return;
  }
  const rise = wind ? -2 : strike ? 2 : 0;
  const top = feet - 32 + rise;
  for (let row = 0; row < 22; row++) {
    const w = 4 + Math.floor(Math.sin(row / 4) * 2) + (row > 14 ? 2 : 0);
    const sway = row > 16 ? ((frame + row) % 3) - 1 : 0;
    pix.rect(cx - Math.floor(w / 2) + sway, top + row, w, 1, row < 3 ? 0xe8dcff : 0x7a68a8);
  }
  for (let i = 0; i < 8; i++) {
    const wave = (frame + i) % 3;
    pix.rect(cx - 6 + i, feet - 8 + wave, 1, 5 - wave, i % 2 ? 0xc8b6ff : 0x5a4a88);
  }
  pix.rect(cx - 3, top + 6, 2, 3, 0xfff6ea);
  pix.rect(cx + 2, top + 6, 2, 3, 0xfff6ea);
  pix.px(cx - 2, top + 7, 0x7a68ff);
  pix.px(cx + 3, top + 7, 0x7a68ff);
  if (strike || wind) blade(pix, cx + 4, top + 12, strike ? 0.4 : -1.1, 12, 0xe8dcff, 0xffffff, 200);
}

function drawMage(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, strike: boolean, dead: boolean): void {
  if (dead) {
    pix.rect(cx - 8, feet - 6, 16, 5, 0x3a2a55);
    pix.px(cx + 4, feet - 4, 0xb9a6ff);
    return;
  }
  for (let row = 0; row < 18; row++) {
    const w = 5 + Math.floor(row * 0.45);
    pix.rect(cx - Math.floor(w / 2), feet - 18 + row, w, 1, row < 2 ? 0x6a5a88 : 0x3a2a55);
    if (row > 4 && row % 4 === 0) pix.px(cx, feet - 18 + row, 0xb9a6ff);
  }
  pix.rect(cx - 3, feet - 26, 7, 6, 0x2a2040);
  pix.rect(cx - 4, feet - 32, 9, 4, 0x241838);
  pix.rect(cx - 2, feet - 36 - (frame % 2), 4, 5, 0x3a2a55);
  pix.px(cx - 1, feet - 37 - (frame % 2), 0xb9a6ff);
  pix.rect(cx - 2, feet - 24, 5, 3, SKIN);
  pix.px(cx - 1, feet - 23, INK);
  pix.px(cx + 2, feet - 23, INK);
  const orbY = feet - 28 + (wind ? -4 - frame : strike ? 2 : 0);
  pix.line(cx + 5, feet - 16, cx + 8, orbY, 0x6a5438);
  blob(pix, cx + 8, orbY, 3, 3, wind || strike ? 0xd8ccff : 0xb9a6ff);
  pix.px(cx + 8, orbY, 0xffffff);
}

function drawBoss3(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, strike: boolean, dead: boolean): void {
  if (dead) {
    pix.rect(cx - 10, feet - 8, 22, 6, 0x2a2450);
    pix.px(cx, feet - 10, 0xfff1c2);
    pix.px(cx + 4, feet - 12, 0x7ae0ff);
    return;
  }
  const hover = Math.sin(frame) > 0 ? -1 : 0;
  const top = feet - 48 + hover + (wind ? -2 : 0);
  for (let row = 0; row < 30; row++) {
    const w = row < 8 ? 6 : 8 + Math.floor((row - 8) * 0.35);
    pix.rect(cx - Math.floor(w / 2), top + row, w, 1, row < 6 ? 0x1a1430 : 0x2e2858);
    if (row % 5 === 0) pix.px(cx - 1, top + row, 0x9a8cff);
  }
  for (let i = 0; i < 12; i++) {
    const wave = (frame + i) % 4;
    pix.px(cx - 8 + i, feet - 6 + (wave % 3), i % 2 ? 0xb9a6ff : 0x6a5cff);
  }
  pix.rect(cx - 5, top - 2, 10, 8, 0x161226);
  pix.rect(cx - 6, top - 6, 3, 4, 0xfff1c2);
  pix.rect(cx + 3, top - 7, 3, 5, 0x7ae0ff);
  pix.rect(cx - 1, top - 8, 2, 4, EMBER_HI);
  pix.rect(cx - 3, top + 2, 2, 2, 0xfff6ea);
  pix.rect(cx + 2, top + 2, 2, 2, 0xfff6ea);
  for (let i = 0; i < 7; i++) {
    const sway = ((frame + i) % 3) - 1;
    pix.px(cx - 6 + sway, top + 2 + i, 0xd8ccff);
    pix.px(cx + 6 + sway, top + 3 + i, 0x7ae0ff);
  }
  const ang = wind ? -1.2 : strike ? 0.4 : -0.4;
  blade(pix, cx + 6, top + 14, ang, 16, 0xe8dcff, 0xffffff);
  if (!dead) {
    pix.px(cx - 14, top + 16 + (frame % 3), 0xfff1c2, 180);
    pix.px(cx + 14, top + 20 + ((frame + 1) % 3), EMBER_HI, 180);
  }
}

function drawSentinel(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, strike: boolean, dead: boolean, main: boolean): void {
  const cloth = main ? 0x8ea0c0 : 0x6a5a98;
  const hi = main ? 0xeef3ff : 0xd8ccff;
  if (dead && main) {
    pix.rect(cx - 8, feet - 6, 16, 5, cloth);
    return;
  }
  if (dead) return;
  legs(pix, cx, feet, 0, cloth, 0x2a3350, 10);
  pix.rect(cx - 5, feet - 26, 11, 16, cloth);
  pix.rect(cx - 5, feet - 26, 2, 16, 0x2a3350);
  pix.rect(cx - 2, feet - 26, 6, 1, hi);
  pix.rect(cx - 4, feet - 34, 9, 8, hi);
  pix.rect(cx - 2, feet - 30, 5, 2, 0x12141c);
  pix.px(cx - 1, feet - 30, main ? 0x7ae0ff : EMBER);
  if ((frame + (main ? 0 : 2)) % 7 === 0) {
    pix.line(cx - 2, feet - 20, cx + 2, feet - 16, 0x2a3350);
  }
  const ang = wind ? -1.2 : strike ? 0.3 : -0.4;
  blade(pix, cx + 5, feet - 20, ang, 16, hi, 0xffffff);
  if (!main) pix.rect(cx + 6, feet - 24, 5, 8, 0x2a2048, 180);
}

function drawCrawler(pix: Pix, cx: number, feet: number, frame: number, strike: boolean, dead: boolean): void {
  if (dead) {
    blob(pix, cx, feet - 3, 10, 2, 0x4a5648);
    return;
  }
  const y = feet - 8 + (strike ? -2 : frame % 2);
  blob(pix, cx + 6, y, 6, 4, 0x7d8c78);
  blob(pix, cx - 2, y + 1, 7, 4, 0x5e6c5a);
  blob(pix, cx - 10, y + 2, 5, 3, 0x3e4a3e);
  pix.rect(cx + 2, y - 1, 2, 2, 0xf2f6ea);
  pix.rect(cx + 6, y - 1, 2, 2, 0xf2f6ea);
  pix.px(cx + 2, y - 1, INK);
  pix.px(cx + 6, y - 1, INK);
  pix.rect(cx - 6, y, 2, 2, EMBER);
  for (let i = 0; i < 4; i++) {
    const phase = (frame + i) % 3;
    const lx = cx - 8 + i * 5;
    pix.line(lx, y + 3, lx - 1 + phase, y + 8, 0x2a3228);
    pix.px(lx - 1 + phase, y + 8, 0x1a2018);
  }
  if (strike) {
    pix.line(cx + 10, y, cx + 16, y - 2, 0xf0c8b0);
    pix.line(cx + 10, y + 2, cx + 16, y + 3, 0xf0c8b0);
  }
}

function drawFlea(pix: Pix, cx: number, feet: number, frame: number, strike: boolean, wind: boolean): void {
  const hop = strike ? -4 : wind ? 2 : -(frame % 2);
  const y = feet - 12 + hop;
  blob(pix, cx, y, 6, 5, 0x8a3a22);
  blob(pix, cx - 1, y + 1, 3, 2, EMBER);
  pix.px(cx - 3, y - 1, EMBER_HI);
  pix.px(cx + 2, y - 1, 0xfff1c2);
  const leg = wind ? 1 : (frame % 2) * 2;
  pix.line(cx - 3, y + 3, cx - 6, feet - 1, INK);
  pix.line(cx - 6, feet - 1, cx - 8, feet, INK);
  pix.line(cx + 2, y + 3, cx + 4 + leg, feet - 2, INK);
  pix.line(cx + 4 + leg, feet - 2, cx + 7 + leg, feet, INK);
  pix.rect(cx + 6 + leg, feet - 1, 3, 2, 0x3a1810);
}

function drawBat(pix: Pix, cx: number, feet: number, frame: number, strike: boolean, dead: boolean, wind: boolean): void {
  const pose = dead ? 0 : strike ? 0 : wind ? 2 : frame % 3;
  const spans = [4, 10, 14];
  const wing = spans[pose] ?? 8;
  const y = feet - 6;
  const membrane = 0x4a3048;
  const bone = 0x2a1828;
  pix.line(cx, y, cx - wing, y - 2 - pose, bone);
  pix.line(cx, y, cx + wing, y - 1 - pose, bone);
  pix.line(cx - wing, y - 2 - pose, cx - 2, y + 3, membrane);
  pix.line(cx + wing, y - 1 - pose, cx + 2, y + 3, membrane);
  pix.line(cx - Math.floor(wing * 0.6), y - pose, cx, y + 2, membrane);
  pix.line(cx + Math.floor(wing * 0.6), y - pose, cx, y + 2, membrane);
  blob(pix, cx, y, 4, 3, 0x241820);
  pix.px(cx - 2, y, EMBER);
  pix.px(cx + 1, y, EMBER_HI);
  if (!dead) {
    pix.px(cx - 1, y + 3, 0xf0d8cc);
  }
}

function drawSlag(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, strike: boolean, dead: boolean): void {
  if (dead) {
    blob(pix, cx, feet - 4, 12, 3, 0x3a241c);
    pix.px(cx, feet - 4, EMBER);
    return;
  }
  const h = 16 + (frame % 2);
  blob(pix, cx, feet - h + 6, 12, 8, 0x4a2c22);
  blob(pix, cx - 2, feet - h, 8, 6, 0x5a3428);
  blob(pix, cx + 4, feet - 8, 6, 5, 0x3a2018);
  pix.line(cx - 4, feet - h + 2, cx + 2, feet - 6, EMBER);
  pix.line(cx + 1, feet - h + 4, cx + 6, feet - 8, 0xffb03a);
  pix.px(cx - 2, feet - h + 3, EMBER_HI);
  pix.px(cx + 3, feet - 7, EMBER_HI);
  const arm = wind ? -6 : strike ? 4 : 0;
  blob(pix, cx + 12, feet - 14 + arm, 5, 4, 0x3a241c);
  if (wind) pix.rect(cx - 12, feet - 4, 24, 3, EMBER, 90);
}

function drawBrute(
  pix: Pix,
  cx: number,
  feet: number,
  frame: number,
  wind: boolean,
  strike: boolean,
  dead: boolean,
  boss: boolean,
  step: number,
): void {
  const cloth = boss ? 0x5a3428 : 0x6a4034;
  const dk = 0x2a1814;
  if (dead) {
    blob(pix, cx, feet - 6, boss ? 22 : 16, 5, cloth);
    pix.rect(cx - 4, feet - 8, 8, 4, EMBER);
    return;
  }
  const bodyH = boss ? 28 : 22;
  const bodyW = boss ? 18 : 14;
  legs(pix, cx, feet, step, dk, 0x1a100e, boss ? 12 : 10);
  if (boss) {
    pix.rect(cx - 4, feet - 12, 5, 12, 0x3a221c);
    pix.rect(cx + 2, feet - 12, 5, 12, 0x2a1814);
  }
  blob(pix, cx, feet - 12 - bodyH / 2, bodyW, Math.floor(bodyH / 2), cloth);
  pix.rect(cx - 4, feet - 16 - bodyH, 8, 6, mix(cloth, 0xffffff, 0.08));
  const coreY = feet - bodyH + (frame % 2);
  blob(pix, cx, coreY, boss ? 5 : 4, boss ? 5 : 3, EMBER);
  pix.px(cx, coreY, EMBER_HI);
  if (boss) {
    pix.line(cx - 10, feet - bodyH, cx - 18, feet - bodyH - 10, 0x3a221c);
    pix.line(cx + 10, feet - bodyH, cx + 18, feet - bodyH - 10, 0x3a221c);
    pix.px(cx - 18, feet - bodyH - 10, EMBER);
    pix.px(cx + 18, feet - bodyH - 10, EMBER_HI);
    blob(pix, cx - 16, feet - 18, 6, 4, 0x4a2c24);
    blob(pix, cx + 16, feet - 18, 6, 4, 0x4a2c24);
  }
  const armY = wind ? -8 : strike ? 6 : 0;
  blob(pix, cx + (boss ? 18 : 14), feet - bodyH + 8 + armY, boss ? 7 : 5, 4, dk);
  pix.rect(cx + (boss ? 16 : 12), feet - 8, 4, 3, 0x1a100e);
  if (wind) pix.rect(cx - 16, feet - 3, boss ? 36 : 28, 3, 0xffb03a, 120);
}

function drawDummy(pix: Pix, cx: number, feet: number, frame: number, strike: boolean): void {
  pix.rect(cx - 2, feet - 28, 4, 28, 0x8a6840);
  pix.rect(cx - 1, feet - 28, 1, 28, 0xc4a070);
  pix.rect(cx - 8, feet - 30, 16, 12, 0xd8c4a0);
  pix.rect(cx - 8, feet - 30, 16, 2, 0xf0e6d0);
  pix.rect(cx - 6, feet - 26, 12, 3, 0xa04038);
  pix.rect(cx - 3, feet - 22, 6, 2, 0xf4efe4);
  pix.px(cx - 2, feet - 25, INK);
  pix.px(cx + 2, feet - 25, INK);
  if (frame % 5 !== 0) pix.rect(cx - 1, feet - 22, 3, 1, 0xc48462);
  pix.rect(cx - 10, feet - 4, 20, 4, 0x5a4630);
  pix.rect(cx - 10, feet - 4, 20, 1, 0x8a6848);
  pix.line(cx - 7, feet - 16, cx - 12, feet - 8, 0xc8b48a);
  if (strike) pix.line(cx + 6, feet - 18, cx + 14, feet - 12, 0x6a5438);
  if (frame % 4 === 0) pix.px(cx + 4, feet - 28, 0xf0e6d4);
}

const ENEMY_ANIMS = ['idle', 'walk', 'telegraph', 'attack', 'hurt', 'dead'] as const;

function enemyFrames(anim: string): number {
  if (anim === 'walk') return 8;
  if (anim === 'idle') return 6;
  if (anim === 'attack' || anim === 'dead') return 6;
  if (anim === 'hurt') return 3;
  if (anim === 'telegraph') return 4;
  return 4;
}

function drawProp(kind: string, frame: number): HTMLCanvasElement {
  const pix = new Pix(40, 40);
  const flick = frame % 2;
  if (kind === 'chest') {
    pix.rect(8, 18, 24, 16, 0x6a3e24);
    pix.rect(8, 18, 24, 4, 0xc48a48);
    pix.rect(8, 18, 24, 1, 0xf0c48a);
    pix.rect(9, 23, 1, 10, 0x3a2418);
    pix.rect(30, 23, 1, 10, 0x3a2418);
    pix.rect(18, 24, 4, 5, GOLD);
    pix.px(19, 26, frame === 2 ? EMBER_HI : EMBER);
    pix.rect(12, 30, 16, 2, 0x3a2418);
    if (frame === 3) pix.px(28, 16, 0xfff6ea);
  } else if (kind === 'shrine') {
    pix.rect(16, 10, 8, 22, 0x6a5a68);
    pix.rect(17, 10, 2, 22, 0xc8b8d0);
    pix.rect(12, 30, 16, 4, 0x3a3038);
    pix.rect(12, 30, 16, 1, 0x8a7a88);
    blob(pix, 20, 12 - flick, 3, 4, EMBER);
    pix.px(20, 10 - flick, EMBER_HI);
    pix.px(19, 14, 0xfff1c2);
  } else if (kind === 'npc') {
    pix.rect(16, 16, 8, 14, 0x3e4a3c);
    pix.rect(16, 16, 2, 14, 0x1e2820);
    pix.rect(17, 16, 6, 1, 0x8aa888);
    pix.rect(17, 8, 6, 8, 0x2a342c);
    pix.rect(18, 12, 4, 3, SKIN);
    pix.px(19, 13, INK);
    pix.px(21, 13, INK);
    hairTail(pix, 22, 9, paletteOf('wanderer'), frame, false);
    pix.rect(13, 18, 3, 8, 0x6a5438);
    pix.rect(24, 28, 8, 6, 0x8a5a32);
    pix.rect(26, 30, 4, 2, GOLD);
  } else if (kind === 'portal') {
    pix.rect(10, 8, 4, 26, 0x3a3058);
    pix.rect(26, 8, 4, 26, 0x3a3058);
    pix.rect(10, 6, 20, 4, 0x6a5a98);
    pix.rect(12, 4, 16, 3, 0xb9a6ff);
    blob(pix, 20, 20, 6, 8, frame % 2 ? 0x7a6ae8 : 0xc8b8ff);
    pix.rect(18, 16, 4, 8, 0xf4f0ea);
    pix.px(14, 14, 0xfff6ea, 180);
    pix.px(26, 24, EMBER_HI, 160);
  } else if (kind === 'lore') {
    pix.rect(12, 14, 16, 16, 0xe4dcc8);
    pix.rect(12, 14, 16, 2, 0xf8f2e6);
    pix.rect(12, 14, 2, 16, 0x8a6848);
    pix.rect(15, 18, 10, 1, 0x5a4638);
    pix.rect(15, 21, 8, 1, 0x5a4638);
    pix.rect(15, 24, 9, 1, 0x5a4638);
    pix.px(22, 12 - flick, EMBER_HI);
    pix.px(24, 14, EMBER);
  } else if (kind === 'event') {
    pix.rect(8, 30, 24, 6, 0x3a342c);
    pix.rect(14, 8, 12, 24, 0x7a6888);
    pix.rect(15, 8, 3, 22, 0xd4c4e0);
    pix.rect(18, 14, 4, 8, EMBER);
    pix.px(19, 12 - flick, EMBER_HI);
    pix.px(22, 16, 0xfff1c2);
    pix.line(16, 10, 22, 28, 0x3a3048);
  } else {
    pix.rect(12, 12, 16, 16, EMBER);
  }
  inkOutline(pix);
  return pix.toCanvas();
}

function arc(pix: Pix, cx: number, cy: number, r: number, a0: number, a1: number, color: number, a: number): void {
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = a0 + (a1 - a0) * t;
    pix.px(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), color, a);
  }
}

function drawFx(kind: string, frame: number): HTMLCanvasElement {
  const pix = new Pix(48, 48);
  const a = 255 - frame * 50;
  if (kind === 'slash' || kind === 'slashSword' || kind === 'spark') {
    arc(pix, 24, 28, 16 - frame, -2.2, 0.6, EMBER, a);
    arc(pix, 24, 28, 14 - frame, -2.0, 0.45, EMBER_HI, a);
    arc(pix, 24, 28, 12 - frame, -1.8, 0.3, 0xffffff, Math.max(80, a - 40));
    pix.px(38 - frame, 14 + frame * 2, 0xffffff);
  } else if (kind === 'slashHammer' || kind === 'boom') {
    arc(pix, 24, 30, 14 + frame * 2, -2.4, 0.8, EMBER, a);
    arc(pix, 24, 30, 11 + frame, -2.2, 0.6, 0xffffff, a);
    pix.rect(8, 30, 32, 3, EMBER, 140);
    pix.px(24, 28, 0xffffff);
  } else if (kind === 'slashDagger') {
    arc(pix, 20, 26, 10, -1.4, 0.4, STEEL, a);
    arc(pix, 28, 22, 9, -2.4, -0.6, EMBER_HI, a);
    pix.px(34, 16, 0xffffff);
  } else if (kind === 'slashUp' || kind === 'plunge') {
    pix.line(24, 40, 24, 6 + frame * 4, EMBER_HI, a);
    pix.line(22, 36, 22, 10 + frame * 3, EMBER, a);
    pix.line(26, 36, 26, 12, 0xffffff, Math.max(60, a - 80));
  } else if (kind === 'dust') {
    blob(pix, 14 + frame * 2, 30, 3, 2, 0xd8d0c4, 140);
    blob(pix, 24, 28 - frame, 2, 2, 0xb8b0a4, 120);
    blob(pix, 32 - frame, 31, 2, 2, 0xe8e0d4, 100);
  } else if (kind === 'parry' || kind === 'dodge') {
    arc(pix, 24, 24, 10 + frame * 3, 0, 6.2, kind === 'parry' ? EMBER_HI : 0xbfe9ff, a);
    arc(pix, 24, 24, 7 + frame * 2, 0, 6.2, 0xffffff, Math.max(40, a - 60));
    pix.px(24, 24, 0xffffff);
  } else if (kind === 'wave') {
    pix.rect(2, 28, 44, 5, EMBER, 160);
    pix.rect(4, 28, 40, 1, EMBER_HI);
    pix.rect(8, 26 - frame, 6, 3, 0xfff1c2, 140);
    pix.rect(30, 25 - frame, 5, 3, 0xfff1c2, 120);
  } else if (kind === 'hit' || kind === 'burst') {
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8;
      const r = 6 + frame * 4;
      pix.line(24, 24, 24 + Math.cos(ang) * r, 24 + Math.sin(ang) * r, i % 2 ? EMBER_HI : 0xffffff, a);
    }
  } else if (kind === 'blink' || kind === 'dash') {
    for (let i = 0; i < 4; i++) {
      pix.line(4, 16 + i * 5, 40 - frame * 4, 16 + i * 5, i % 2 ? 0xb9a6ff : 0xf4f0ea, a);
    }
    pix.px(40, 24, 0xffffff);
  } else {
    pix.px(24, 24, EMBER_HI);
  }
  return pix.toCanvas();
}

function drawShot(kind: string): HTMLCanvasElement {
  const pix = new Pix(16, 16);
  if (kind === 'arrow') {
    pix.line(1, 8, 12, 8, 0xe8dcc8);
    pix.line(1, 8, 4, 6, 0xc8b49a);
    pix.line(1, 8, 4, 10, 0xc8b49a);
    pix.px(13, 8, EMBER_HI);
    pix.px(14, 8, 0xffffff);
    pix.px(12, 7, EMBER);
  } else if (kind === 'bolt' || kind === 'ring' || kind === 'nova') {
    blob(pix, 8, 8, 4, 4, kind === 'bolt' ? 0xb9a6ff : EMBER);
    pix.rect(7, 7, 2, 2, 0xffffff);
    pix.px(4, 5, 0xfff6ea);
  } else if (kind === 'zone') {
    pix.rect(1, 6, 14, 6, EMBER, 170);
    pix.rect(2, 7, 12, 2, EMBER_HI);
    pix.px(4, 6, 0xffffff);
    pix.px(11, 8, 0xfff1c2);
  } else if (kind === 'flame') {
    blob(pix, 8, 9, 3, 5, EMBER);
    blob(pix, 8, 7, 2, 3, EMBER_HI);
    pix.px(8, 5, 0xffffff);
  } else {
    pix.rect(1, 7, 14, 4, EMBER);
    pix.rect(2, 7, 12, 1, EMBER_HI);
    pix.px(14, 8, 0xffffff);
  }
  return pix.toCanvas();
}

const ICONS: Record<string, string[]> = {
  heart: ['..rr..', '.rwwr.', 'rwwwr.', '.rrr..'],
  feather: ['..w...', '.ww...', 'www...', '.ww...', '..w...'],
  coin: ['..yy..', '.ywwy.', '.ywy..', '..yy..'],
  drop: ['..c...', '.cc...', 'ccc...', '.cc...'],
  shield: ['ssss..', 's..s..', 's..s..', '.ss...'],
  fang: ['w.....', '.w....', '..w...', '...w..'],
  brand: ['..e...', '.eee..', '..e...', '..e...'],
  spark: ['..e...', 'eeee..', '..e...', '.e.e..'],
  star: ['..y...', '.yyy..', 'yyyyy.', '.yyy..'],
  hammer: ['ssss..', '.ss...', '.ss...', '.ww...'],
  tag: ['yyyy..', 'y..y..', '.yy...'],
  eye: [' eee..', 'eweee.', '.eee..'],
  flame: ['..e...', '.eee..', 'eeeee.', '.eee..'],
  glass: ['..c...', '.c.c..', '..c...'],
  ghost: [' wwww.', 'w.ww.w', '.wwww.'],
  wing: ['ww....', '.ww...', '..ww..', '...w..'],
  phoenix: ['.e.e..', 'eeeee.', '.eee..', '..e...'],
  crown: ['y.y.y.', 'yyyyy.', '.yyy..'],
};

function drawIcon(rows: string[]): HTMLCanvasElement {
  const pix = new Pix(10, 10);
  const map: Record<string, number> = {
    r: 0xe05050,
    w: 0xf4f0ea,
    y: 0xf0c85c,
    c: 0x7ae0ff,
    s: 0xb7c0cc,
    e: EMBER,
  };
  pix.stamp(2, 2, rows, map);
  return pix.toCanvas();
}

function put(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
}

/** Headless GL sometimes uploads a canvas before its pixels land. Push them again next frame. */
export function refreshCanvases(scene: Phaser.Scene): void {
  for (const key of scene.textures.getTextureKeys()) {
    const src = scene.textures.get(key).source[0] as { isCanvas?: boolean; update?: () => void } | undefined;
    if (src?.isCanvas) src.update?.();
  }
}

export function playerKey(char: CharacterId, weapon: WeaponId, anim: string, frame: number): string {
  const n = framesOf(anim);
  return `pl:${char}:${weapon}:${anim}:${((frame % n) + n) % n}`;
}

export function enemyKey(kind: string, anim: string, frame: number): string {
  const n = enemyFrames(anim);
  return `en:${kind}:${anim}:${((frame % n) + n) % n}`;
}

export function installArt(scene: Phaser.Scene): void {
  const chars: CharacterId[] = ['wanderer', 'dancer', 'bulwark'];
  const weapons: WeaponId[] = ['sword', 'hammer', 'dagger'];
  for (const char of chars) {
    for (const weapon of weapons) {
      for (const anim of [...LOCO, ...attackAnims(weapon)]) {
        const n = framesOf(anim);
        for (let f = 0; f < n; f++) put(scene, playerKey(char, weapon, anim, f), drawPlayer(char, weapon, anim, f));
      }
    }
  }
  for (const kind of Object.keys(ENEMY_BOX)) {
    for (const anim of ENEMY_ANIMS) {
      const n = enemyFrames(anim);
      for (let f = 0; f < n; f++) put(scene, enemyKey(kind, anim, f), drawEnemy(kind, anim, f));
    }
  }
  for (const prop of ['chest', 'shrine', 'npc', 'portal', 'lore', 'event']) {
    for (let f = 0; f < 4; f++) put(scene, `pr:${prop}:${f}`, drawProp(prop, f));
  }
  for (const fx of ['slash', 'slashSword', 'slashHammer', 'slashDagger', 'slashUp', 'plunge', 'spark', 'dust', 'parry', 'wave', 'boom', 'blink', 'dash', 'hit', 'burst', 'dodge']) {
    for (let f = 0; f < 3; f++) put(scene, `fx:${fx}:${f}`, drawFx(fx, f));
  }
  for (const shot of ['arrow', 'bolt', 'wave', 'ring', 'zone', 'flame', 'nova']) put(scene, `shot:${shot}`, drawShot(shot));
  for (const [name, rows] of Object.entries(ICONS)) put(scene, `icon:${name}`, drawIcon(rows));
  for (const biome of ['ash', 'molten', 'sanctum'] as const) {
    put(scene, `para:${biome}:far`, bakeParallax(biome, 'far'));
    put(scene, `para:${biome}:near`, bakeParallax(biome, 'near'));
  }
  put(scene, 'glow', bakeGlow());
  put(scene, 'vignette', bakeVignette());
}
