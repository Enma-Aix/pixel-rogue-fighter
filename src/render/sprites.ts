import Phaser from 'phaser';
import type { CharacterId, WeaponId } from '../core/types';
import { Pix, outlined } from './pix';
import { bakeGlow, bakeParallax, bakeVignette } from './bake';

export const PLAYER_W = 48;
export const PLAYER_H = 40;
export const PLAYER_OX = 16;
export const PLAYER_OY = 36;

const INK = 0x120c16;
const SKIN = 0xf0c2a4;
const SKIN_DK = 0xc48b6a;
const EMBER = 0xff6a2a;
const EMBER_HI = 0xffd7a8;
const STEEL = 0xd5dbe6;
const STEEL_DK = 0x7d8798;

interface Pose {
  bob: number;
  lean: number;
  front: number;
  back: number;
  crouch: number;
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
  const p: Pose = { bob: 0, lean: 0, front: 0, back: 0, crouch: 0, ang: -0.4, cape: frame, blink: false, glow: 0, fallen: 0 };
  if (anim === 'idle') {
    p.bob = [0, 0, 1, 1, 0, 0][frame % 6]!;
    p.blink = frame % 6 === 4;
    p.ang = -0.5;
  } else if (anim === 'run') {
    const step = [0, 1, 2, 1, 0, -1, -2, -1][frame % 8]!;
    p.front = step;
    p.back = -step;
    p.bob = Math.abs(step) === 2 ? 1 : 0;
    p.lean = 1;
    p.ang = -0.3;
  } else if (anim === 'jump') {
    p.crouch = 2;
    p.front = 2;
    p.back = -1;
    p.ang = -1.2;
    p.bob = -2;
  } else if (anim === 'fall') {
    p.front = 1;
    p.back = -2;
    p.ang = 0.4;
    p.bob = 1;
  } else if (anim === 'land') {
    p.crouch = [3, 2, 1, 0][frame % 4]!;
    p.ang = 0.6;
  } else if (anim === 'charge') {
    p.crouch = 2;
    p.lean = -2;
    p.ang = 2.3;
    p.glow = frame / 3;
  } else if (anim === 'hurt') {
    p.lean = -3;
    p.ang = 1.4;
    p.bob = 1;
  } else if (anim === 'dead') {
    p.fallen = frame / 6;
    p.lean = -2 - frame;
    p.crouch = Math.min(6, frame);
    p.ang = 1.2;
  } else if (anim === 'dash') {
    p.lean = 4;
    p.ang = 0.1;
    p.bob = 1;
    p.crouch = 1;
  } else if (anim === 'parry') {
    p.lean = -1;
    p.ang = -1.35;
    p.crouch = 1;
  } else if (anim === 'heal') {
    p.crouch = 3;
    p.ang = -2.2;
    p.lean = -1;
  } else if (anim === 'l1') p.ang = [-2.2, -1.5, -0.3, 0.55, 0.9, 0.45, 0.05][frame] ?? 0;
  else if (anim === 'l2') p.ang = [-2.4, -1.7, -0.5, 0.4, 1.05, 0.6, 0.1][frame] ?? 0;
  else if (anim === 'l3' || anim === 'l4') {
    p.ang = [1.1, 0.3, -0.7, -1.7, -2.3, -1.5, -0.7][frame] ?? -0.7;
    p.bob = frame >= 2 && frame <= 4 ? -2 : 0;
  } else if (anim === 'heavy') {
    p.ang = [2.5, 2.3, 1.1, 0.15, -0.15, 0.4, 0.7][frame] ?? 0.4;
    p.lean = frame < 2 ? -2 : 2;
    p.crouch = frame < 2 ? 2 : 0;
  } else if (anim === 'heavyFull') {
    p.ang = [2.6, 2.4, 0.8, -0.1, -0.3, 0.5, 0.8][frame] ?? 0.5;
    p.glow = 1;
    p.lean = frame < 2 ? -3 : 3;
    p.crouch = frame < 2 ? 2 : 0;
  } else if (anim === 'air') {
    p.ang = [-0.5, 0.1, 0.7, 1.15, 0.8, 0.3, 0][frame] ?? 0;
    p.bob = -1;
  } else if (anim === 'airHeavy') {
    p.ang = [0.3, 0.9, 1.5, 2.05, 1.7, 1.2, 0.8][frame] ?? 1;
    p.bob = -1;
  } else if (anim === 'plunge') {
    p.ang = 1.55;
    p.lean = 1;
    p.bob = 2;
  } else if (anim === 'skill') {
    p.ang = [-0.8, -0.2, 0.15, 0.15, 0.4, 0.6, 0.2][frame] ?? 0;
    p.lean = [0, 2, 4, 4, 2, 1, 0][frame] ?? 0;
  }
  if (anim.startsWith('l') || anim === 'heavy' || anim === 'air') p.lean += frame === 2 || frame === 3 ? 1 : 0;
  return p;
}

function clothOf(char: CharacterId): { cloth: number; hi: number; dk: number } {
  if (char === 'dancer') return { cloth: 0x24344c, hi: 0x4e6e92, dk: 0x182433 };
  if (char === 'bulwark') return { cloth: 0x3e4656, hi: 0x8d98ab, dk: 0x232833 };
  return { cloth: 0x7a6498, hi: 0xe4d4f4, dk: 0x3a2c4c };
}

function drawWeapon(pix: Pix, x: number, y: number, weapon: WeaponId, ang: number, glow: number): void {
  const len = weapon === 'dagger' ? 10 : weapon === 'hammer' ? 12 : 16;
  const x1 = Math.round(x + Math.cos(ang) * len);
  const y1 = Math.round(y + Math.sin(ang) * len);
  const blade = glow > 0.6 ? EMBER_HI : STEEL;
  pix.line(x, y, x1, y1, INK);
  pix.line(x, y, x1, y1, blade);
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  pix.line(Math.round(x + px), Math.round(y + py), Math.round(x1 + px), Math.round(y1 + py), STEEL_DK);
  if (weapon === 'hammer') {
    const hx = x1;
    const hy = y1;
    pix.rect(hx - 3, hy - 3, 7, 6, 0x8a909c);
    pix.rect(hx - 2, hy - 2, 5, 4, STEEL);
    pix.px(hx - 1, hy - 1, EMBER);
    if (glow > 0.4) pix.rect(hx - 4, hy - 4, 9, 8, EMBER, 70);
  } else {
    pix.px(x1, y1, EMBER_HI);
    pix.rect(x - 1, y - 1, 3, 3, 0x6a5430);
    if (weapon === 'dagger') {
      pix.line(x - 3, y + 2, x + 4, y - 4, STEEL);
      pix.px(x + 4, y - 4, EMBER);
    }
  }
  if (glow > 0.5) {
    pix.line(x, y, x1, y1, EMBER, 90);
  }
}

function drawPlayer(char: CharacterId, weapon: WeaponId, anim: string, frame: number): HTMLCanvasElement {
  const pix = new Pix(PLAYER_W, PLAYER_H);
  const pose = poseFor(anim, frame);
  const colors = clothOf(char);
  const cx = PLAYER_OX + pose.lean;
  const feet = PLAYER_OY + pose.bob + Math.round(pose.fallen * 4);
  if (pose.fallen < 0.8) pix.rect(cx - 6, PLAYER_OY - 1, 12, 2, 0x000000, 70);
  const tw = char === 'bulwark' ? 12 : char === 'dancer' ? 8 : 10;
  const th = 10 - Math.min(4, pose.crouch);
  const leg = 8 - Math.min(4, pose.crouch);
  if (pose.fallen > 0.65) {
    const y = feet - 6;
    outlined(pix, cx - 8, y, 18, 6, colors.cloth);
    pix.rect(cx - 7, y + 1, 4, 2, SKIN);
    pix.rect(cx + 6, y + 1, 3, 3, EMBER);
    drawWeapon(pix, cx + 4, y + 2, weapon, 0.2, 0);
    return pix.toCanvas();
  }
  outlined(pix, cx - 5 + pose.back, feet - leg, 4, leg, colors.dk);
  outlined(pix, cx + 1 + pose.front, feet - leg, 4, leg, 0x1b1622);
  pix.rect(cx - 6 + pose.back, feet - 3, 5, 3, 0x16131a);
  pix.rect(cx + pose.front, feet - 3, 5, 3, 0x0e0c12);
  const tx = cx - Math.floor(tw / 2);
  const ty = feet - leg - th;
  outlined(pix, tx, ty, tw, th, colors.cloth);
  pix.rect(tx + 1, ty + 1, 2, Math.max(1, th - 3), colors.hi);
  if (char === 'bulwark') pix.rect(tx - 1, ty + 1, 2, 4, STEEL_DK);
  pix.rect(tx + tw - 4, ty + 2, 3, 3, EMBER);
  const tail = 1 + (pose.cape % 3);
  pix.px(tx + tw - 1 + tail, ty + 5, EMBER);
  pix.px(tx + tw + tail, ty + 7, EMBER_HI);
  const hw = char === 'bulwark' ? 10 : 8;
  const hx = cx - Math.floor(hw / 2);
  const hy = ty - hw + 2;
  outlined(pix, hx, hy, hw, hw - 1, char === 'bulwark' ? 0x8b95a6 : colors.cloth);
  if (char === 'bulwark') {
    pix.rect(hx + 2, hy + 3, hw - 4, 2, 0x121820);
    pix.px(hx + 3, hy + 3, EMBER);
    pix.px(hx + hw - 4, hy + 3, EMBER_HI);
    pix.rect(hx + 2, hy, hw - 4, 2, STEEL);
  } else {
    pix.rect(hx + 2, hy + 3, hw - 4, 3, SKIN);
    pix.px(hx + 2, hy + 5, SKIN_DK);
    if (!pose.blink) {
      pix.px(hx + 3, hy + 4, INK);
      pix.px(hx + hw - 4, hy + 4, INK);
    } else pix.rect(hx + 3, hy + 4, hw - 6, 1, SKIN_DK);
  }
  if (char === 'wanderer') pix.rect(hx - 1, hy + 2, 2, 4, colors.dk);
  if (char === 'dancer') {
    pix.px(hx + hw, hy + 1, 0x7ad8ff);
    pix.px(hx + hw + 1, hy + 3 + (pose.cape % 2), 0xbff4ff);
    pix.px(hx + hw, hy + 5, 0x7ad8ff);
  }
  const handX = tx + tw - 2;
  const handY = ty + 3;
  pix.rect(handX, handY, 3, 3, SKIN);
  drawWeapon(pix, handX + 1, handY + 1, weapon, pose.ang, pose.glow);
  if (anim === 'heal') {
    pix.rect(hx + 1, hy + hw - 2, 3, 4, 0x7dffb0);
    pix.rect(hx + 2, hy + hw - 4, 1, 2, STEEL);
  }
  return pix.toCanvas();
}

export interface ActorBox {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export const ENEMY_BOX: Record<string, ActorBox> = {
  guard: { w: 40, h: 40, ox: 14, oy: 36 },
  archer: { w: 40, h: 40, ox: 14, oy: 36 },
  crawler: { w: 36, h: 24, ox: 18, oy: 20 },
  knight: { w: 48, h: 48, ox: 18, oy: 44 },
  slag: { w: 40, h: 40, ox: 20, oy: 36 },
  flea: { w: 24, h: 20, ox: 12, oy: 18 },
  bat: { w: 32, h: 24, ox: 16, oy: 16 },
  eliteBrute: { w: 56, h: 52, ox: 28, oy: 48 },
  phantom: { w: 40, h: 42, ox: 16, oy: 38 },
  mage: { w: 40, h: 44, ox: 16, oy: 40 },
  sentinel: { w: 40, h: 46, ox: 16, oy: 42 },
  sentinelElite: { w: 44, h: 46, ox: 18, oy: 42 },
  boss1: { w: 64, h: 64, ox: 26, oy: 58 },
  boss2: { w: 80, h: 72, ox: 40, oy: 68 },
  boss3: { w: 56, h: 68, ox: 24, oy: 62 },
  dummy: { w: 32, h: 40, ox: 16, oy: 36 },
};

function boxOf(kind: string): ActorBox {
  return ENEMY_BOX[kind] ?? ENEMY_BOX.guard!;
}

function drawEnemy(kind: string, anim: string, frame: number): HTMLCanvasElement {
  const box = boxOf(kind);
  const pix = new Pix(box.w, box.h);
  const bob = anim === 'idle' || anim === 'walk' ? frame % 2 : 0;
  const wind = anim === 'telegraph';
  const strike = anim === 'attack';
  const hurt = anim === 'hurt';
  const dead = anim === 'dead';
  const lean = hurt ? -3 : wind ? -2 : strike ? 2 : 0;
  const cx = box.ox + lean;
  const feet = box.oy + (dead ? Math.min(4, frame) : bob);
  const ang = wind ? 2.2 : strike ? 0.15 : -0.6;
  if (kind === 'crawler') drawCrawler(pix, cx, feet, frame, strike, dead);
  else if (kind === 'flea') drawFlea(pix, cx, feet, frame, strike);
  else if (kind === 'bat') drawBat(pix, cx, feet, frame, strike, dead);
  else if (kind === 'slag') drawSlag(pix, cx, feet, frame, wind, dead);
  else if (kind === 'eliteBrute' || kind === 'boss2') drawBrute(pix, cx, feet, frame, wind, strike, dead, kind === 'boss2');
  else if (kind === 'dummy') drawDummy(pix, cx, feet, frame, strike);
  else drawHuman(pix, kind, cx, feet, frame, ang, wind, strike, dead);
  return pix.toCanvas();
}

function drawHuman(pix: Pix, kind: string, cx: number, feet: number, frame: number, ang: number, wind: boolean, strike: boolean, dead: boolean): void {
  const elite = kind === 'knight' || kind === 'sentinelElite' || kind === 'boss1' || kind === 'boss3';
  const tall = kind === 'boss1' || kind === 'boss3' || kind === 'sentinel' || kind === 'sentinelElite';
  const cloth =
    kind === 'phantom' ? 0x6a5a88 :
    kind === 'mage' ? 0x3a2a55 :
    kind === 'boss3' ? 0x2a2450 :
    kind === 'sentinel' || kind === 'sentinelElite' ? 0x3a4668 :
    kind === 'boss1' || kind === 'knight' ? 0x4a3048 :
    kind === 'archer' ? 0x6d7a62 : 0x6a5468;
  const hi = kind === 'boss3' ? 0x9a8cff : kind === 'phantom' ? 0xc8b6ff : STEEL;
  if (dead) {
    outlined(pix, cx - 10, feet - 8, 22, 7, cloth);
    pix.rect(cx + 8, feet - 6, 3, 3, EMBER);
    return;
  }
  const step = animStep(frame);
  const th = tall ? 16 : 12;
  const tw = elite ? 12 : 9;
  outlined(pix, cx - 4 + (wind ? -1 : step), feet - 9, 4, 9, 0x241c28);
  outlined(pix, cx + 1 - step, feet - 9, 4, 9, 0x1a1520);
  const ty = feet - 9 - th;
  outlined(pix, cx - Math.floor(tw / 2), ty, tw, th, cloth);
  pix.rect(cx - Math.floor(tw / 2) + 1, ty + 1, 2, th - 4, hi);
  if (kind === 'boss1' || kind === 'knight') {
    pix.rect(cx - 8, ty + 2, 3, 8, 0x7a2a22);
    pix.px(cx - 8, ty + 1, EMBER);
  }
  const hy = ty - (kind === 'boss3' ? 10 : 8);
  outlined(pix, cx - 4, hy, 8, 8, kind === 'sentinel' || kind === 'sentinelElite' ? 0x9aa6c4 : cloth);
  if (kind === 'mage' || kind === 'boss3') pix.rect(cx - 2, hy - 5, 4, 6, cloth);
  if (kind === 'boss3') {
    pix.px(cx - 3, hy - 6, 0xfff1c2);
    pix.px(cx + 2, hy - 7, 0x7ae0ff);
    pix.px(cx, hy - 8, EMBER_HI);
  }
  pix.rect(cx - 2, hy + 3, 5, 2, kind === 'phantom' ? 0xe8dcff : 0x121018);
  if (kind !== 'phantom') pix.px(cx - 1, hy + 3, EMBER);
  if (strike || wind) pix.px(cx + 1, hy + 3, EMBER_HI);
  const handX = cx + 4;
  const handY = ty + 4;
  if (kind === 'archer') {
    pix.line(handX, handY + (wind ? 2 : 0), handX + (strike ? 12 : 6), handY - 6, 0xc8b48a);
    pix.line(handX + 2, handY - 6, handX + 2, handY + 4, STEEL_DK);
    if (strike) pix.line(handX + 4, handY - 1, handX + 14, handY - 1, EMBER_HI);
  } else if (kind === 'mage' || kind === 'boss3') {
    pix.line(handX, handY, handX + 4, handY + 12, 0x6a5438);
    pix.px(handX + 4, feet - 2, EMBER);
    if (wind || strike) pix.rect(handX + 6, handY - 2, 4, 4, kind === 'boss3' ? 0xb9a6ff : EMBER, 180);
  } else {
    drawWeapon(pix, handX, handY, 'sword', ang, strike ? 0.8 : wind ? 0.3 : 0);
  }
  if (kind === 'sentinelElite') {
    outlined(pix, cx + 8, hy + 6, 6, 10, 0x2a3358);
    pix.rect(cx + 10, hy + 8, 2, 2, 0x7ae0ff);
  }
}

function animStep(frame: number): number {
  return [0, 1, 0, -1][frame % 4]!;
}

function drawCrawler(pix: Pix, cx: number, feet: number, frame: number, strike: boolean, dead: boolean): void {
  if (dead) {
    pix.rect(cx - 8, feet - 4, 16, 3, 0x5c6a62);
    return;
  }
  const y = feet - 8 + (frame % 2);
  outlined(pix, cx - 8, y, 16, 7, 0x6a7568);
  pix.rect(cx - 6, y + 2, 4, 3, 0xd8d0c4);
  pix.px(cx - 5, y + 3, INK);
  pix.px(cx - 3, y + 3, INK);
  const leg = frame % 2 ? 2 : 0;
  for (const ox of [-6, -1, 4, 8]) pix.rect(cx + ox, y + 6, 2, 3 + (ox > 0 ? leg : 2 - leg), 0x3e463e);
  if (strike) pix.rect(cx + 8, y + 1, 5, 3, 0xf0c8b0);
}

function drawFlea(pix: Pix, cx: number, feet: number, frame: number, strike: boolean): void {
  const y = feet - 10 - (strike ? 2 : frame % 2);
  outlined(pix, cx - 5, y, 10, 8, 0x8a3a22);
  pix.rect(cx - 3, y + 2, 6, 3, EMBER);
  pix.px(cx - 2, y + 3, EMBER_HI);
  pix.rect(cx - 4, feet - 3, 2, 3, INK);
  pix.rect(cx + 2, feet - 4, 2, 4, INK);
}

function drawBat(pix: Pix, cx: number, feet: number, frame: number, strike: boolean, dead: boolean): void {
  const y = feet - 6;
  const wing = dead ? 2 : strike ? 8 : 4 + (frame % 3) * 2;
  pix.line(cx, y, cx - wing, y - 4, 0x3a2a38);
  pix.line(cx, y, cx + wing, y - 3, 0x3a2a38);
  pix.line(cx - wing, y - 4, cx - 2, y + 2, 0x5a4058);
  pix.line(cx + wing, y - 3, cx + 2, y + 2, 0x5a4058);
  outlined(pix, cx - 3, y - 2, 6, 5, 0x2a2030);
  pix.px(cx - 1, y, EMBER);
  pix.px(cx + 1, y, EMBER);
}

function drawSlag(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, dead: boolean): void {
  const h = dead ? 8 : 16 + (frame % 2);
  outlined(pix, cx - 10, feet - h, 20, h, 0x3a241c);
  pix.rect(cx - 6, feet - h + 3, 4, 3, EMBER);
  pix.rect(cx + 2, feet - h + 6, 5, 2, 0xffb03a);
  pix.px(cx - 2, feet - 4, EMBER_HI);
  if (wind) pix.rect(cx - 12, feet - 6, 24, 3, EMBER, 120);
}

function drawBrute(pix: Pix, cx: number, feet: number, frame: number, wind: boolean, strike: boolean, dead: boolean, boss: boolean): void {
  const cloth = boss ? 0x4a3028 : 0x5a3428;
  if (dead) {
    outlined(pix, cx - 16, feet - 10, 32, 10, cloth);
    pix.rect(cx - 4, feet - 8, 8, 4, EMBER);
    return;
  }
  const h = boss ? 28 : 22;
  outlined(pix, cx - (boss ? 16 : 12), feet - 10 - h, boss ? 32 : 24, h, cloth);
  outlined(pix, cx - 6, feet - 10, 6, 10, 0x2a1c18);
  outlined(pix, cx + 2, feet - 10, 6, 10, 0x241612);
  const coreY = feet - 12 - h + 8 + (frame % 2);
  pix.rect(cx - 3, coreY, boss ? 8 : 6, boss ? 8 : 6, EMBER);
  pix.rect(cx - 1, coreY + 2, 3, 3, EMBER_HI);
  if (boss) {
    pix.rect(cx - 18, feet - 16 - h, 8, 6, 0x6a4034);
    pix.rect(cx + 10, feet - 16 - h, 8, 6, 0x6a4034);
  }
  const armY = feet - h;
  pix.rect(cx + (boss ? 14 : 10), armY + (wind ? -6 : strike ? 4 : 0), boss ? 8 : 6, 8, 0x3a2822);
  if (wind) pix.rect(cx - 14, feet - 4, 28, 3, 0xffb03a, 140);
}

function drawDummy(pix: Pix, cx: number, feet: number, frame: number, strike: boolean): void {
  outlined(pix, cx - 2, feet - 22, 4, 22, 0x8a6840);
  outlined(pix, cx - 7, feet - 26, 14, 10, 0xc8b48a);
  pix.rect(cx - 4, feet - 22, 8, 4, 0x8a3030);
  pix.rect(cx - 2, feet - 21, 4, 2, 0xf0e6d4);
  pix.rect(cx - 8, feet - 4, 16, 3, 0x6a5438);
  if (strike) pix.line(cx + 6, feet - 16, cx + 14, feet - 12, 0x6a5438);
  if (frame % 4 === 0) pix.px(cx + 1, feet - 20, 0xf0e6d4);
}

const ENEMY_ANIMS = ['idle', 'walk', 'telegraph', 'attack', 'hurt', 'dead'] as const;

function enemyFrames(anim: string): number {
  if (anim === 'walk') return 6;
  if (anim === 'attack' || anim === 'dead') return 4;
  if (anim === 'hurt') return 2;
  return 4;
}

function drawProp(kind: string, frame: number): HTMLCanvasElement {
  const pix = new Pix(32, 32);
  if (kind === 'chest') {
    outlined(pix, 8, 16, 16, 12, 0x8a5a32);
    pix.rect(8, 16, 16, 3, 0xc48a48);
    pix.rect(14, 20, 4, 3, EMBER);
    pix.px(15, 21, EMBER_HI);
  } else if (kind === 'shrine') {
    outlined(pix, 12, 8, 8, 20, 0x6a5a68);
    pix.rect(10, 26, 12, 3, 0x3a3038);
    pix.rect(14, 12, 4, 4, EMBER);
    pix.px(15, 10 + (frame % 2), EMBER_HI);
  } else if (kind === 'npc') {
    outlined(pix, 12, 10, 8, 12, 0x3a4038);
    outlined(pix, 13, 4, 6, 7, 0x2a342c);
    pix.rect(14, 7, 4, 2, SKIN);
    pix.px(15, 7, INK);
    pix.rect(11, 14, 3, 6, 0x6a5438);
    pix.rect(20, 22, 6, 5, 0x8a5a32);
  } else if (kind === 'portal') {
    outlined(pix, 8, 6, 16, 22, 0x3a3058);
    pix.rect(12, 10, 8, 14, frame % 2 ? 0x7a6ae0 : 0xb9a6ff);
    pix.rect(14, 14, 4, 6, 0xf4f0ea);
  } else if (kind === 'lore') {
    outlined(pix, 10, 12, 12, 14, 0xc8c0b0);
    pix.rect(12, 15, 8, 1, 0x3a342c);
    pix.rect(12, 18, 6, 1, 0x3a342c);
    pix.rect(12, 21, 7, 1, 0x3a342c);
    pix.rect(14, 10, 4, 3, EMBER);
  } else if (kind === 'event') {
    outlined(pix, 8, 22, 16, 6, 0x4a4038);
    outlined(pix, 12, 6, 8, 18, 0x7a6888);
    pix.rect(14, 10, 4, 6, EMBER);
    pix.px(15, 8, EMBER_HI);
    pix.px(16, 12, 0xfff1c2);
  } else {
    pix.rect(8, 8, 16, 16, EMBER);
  }
  return pix.toCanvas();
}

function drawFx(kind: string, frame: number): HTMLCanvasElement {
  const pix = new Pix(32, 32);
  const a = frame;
  if (kind === 'slash' || kind === 'spark') {
    pix.line(6, 24 - a * 2, 26, 8 + a, EMBER_HI);
    pix.line(8, 26 - a * 2, 24, 10 + a, EMBER);
    pix.px(26, 8 + a, 0xffffff);
  } else if (kind === 'dust') {
    pix.px(10 + a, 20, 0xc8c0b4);
    pix.px(16, 18 - a, 0xa09890);
    pix.px(22 - a, 21, 0xd8d0c4);
  } else if (kind === 'parry') {
    pix.line(16, 4, 16, 28, EMBER_HI);
    pix.line(6, 16, 26, 16, 0xfff1c2);
    pix.px(16, 16, 0xffffff);
  } else if (kind === 'wave') {
    pix.rect(2, 18, 28, 4, EMBER);
    pix.rect(4, 18, 24, 1, EMBER_HI);
  } else if (kind === 'boom') {
    pix.rect(10 - a, 10 - a, 12 + a * 2, 12 + a * 2, EMBER, 160);
    pix.px(16, 16, 0xffffff);
  } else if (kind === 'blink' || kind === 'dash') {
    pix.line(4, 16, 28, 16, 0xb9a6ff);
    pix.px(26, 16, 0xf4f0ea);
    pix.px(8, 12, 0x7ae0ff);
  } else {
    pix.px(16, 16, EMBER_HI);
  }
  return pix.toCanvas();
}

function drawShot(kind: string): HTMLCanvasElement {
  const pix = new Pix(16, 16);
  if (kind === 'arrow') {
    pix.line(2, 8, 13, 8, 0xe8d8c8);
    pix.px(14, 8, EMBER);
    pix.px(3, 7, 0xc8b49a);
  } else if (kind === 'bolt' || kind === 'ring' || kind === 'nova') {
    pix.rect(5, 5, 6, 6, kind === 'bolt' ? 0xb9a6ff : EMBER);
    pix.rect(7, 7, 2, 2, 0xffffff);
  } else if (kind === 'zone') {
    pix.rect(1, 6, 14, 6, EMBER, 180);
    pix.rect(2, 7, 12, 2, EMBER_HI);
  } else if (kind === 'flame') {
    pix.rect(5, 4, 6, 8, EMBER);
    pix.rect(7, 6, 2, 3, EMBER_HI);
  } else {
    pix.rect(2, 8, 12, 4, EMBER);
    pix.rect(3, 8, 10, 1, EMBER_HI);
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
    for (let f = 0; f < 2; f++) put(scene, `pr:${prop}:${f}`, drawProp(prop, f));
  }
  for (const fx of ['slash', 'spark', 'dust', 'parry', 'wave', 'boom', 'blink', 'dash', 'hit']) {
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
