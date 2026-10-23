export class Pix {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  erase(x: number, y: number): void {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const i = (iy * this.w + ix) * 4;
    this.data[i] = 0;
    this.data[i + 1] = 0;
    this.data[i + 2] = 0;
    this.data[i + 3] = 0;
  }

  px(x: number, y: number, color: number, a = 255): void {
    const ix = x | 0;
    const iy = y | 0;
    if (a <= 0 || ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const i = (iy * this.w + ix) * 4;
    const srcA = a / 255;
    if (srcA >= 1 || this.data[i + 3] === 0) {
      this.data[i] = (color >> 16) & 255;
      this.data[i + 1] = (color >> 8) & 255;
      this.data[i + 2] = color & 255;
      this.data[i + 3] = a;
      return;
    }
    const dstA = this.data[i + 3]! / 255;
    const outA = srcA + dstA * (1 - srcA);
    const k = srcA / outA;
    const ik = 1 - k;
    this.data[i] = ((color >> 16) & 255) * k + this.data[i]! * ik;
    this.data[i + 1] = ((color >> 8) & 255) * k + this.data[i + 1]! * ik;
    this.data[i + 2] = (color & 255) * k + this.data[i + 2]! * ik;
    this.data[i + 3] = outA * 255;
  }

  rect(x: number, y: number, w: number, h: number, color: number, a = 255): void {
    const x0 = x | 0;
    const y0 = y | 0;
    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) this.px(x0 + ix, y0 + iy, color, a);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: number, a = 255): void {
    let x = x0 | 0;
    let y = y0 | 0;
    const dx = Math.abs((x1 | 0) - x);
    const dy = Math.abs((y1 | 0) - y);
    const sx = x < (x1 | 0) ? 1 : -1;
    const sy = y < (y1 | 0) ? 1 : -1;
    let err = dx - dy;
    for (let n = 0; n < 80; n++) {
      this.px(x, y, color, a);
      if (x === (x1 | 0) && y === (y1 | 0)) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  stamp(x: number, y: number, rows: readonly string[], map: Record<string, number>): void {
    for (let iy = 0; iy < rows.length; iy++) {
      const row = rows[iy]!;
      for (let ix = 0; ix < row.length; ix++) {
        const ch = row[ix]!;
        if (ch === '.' || ch === ' ') continue;
        const color = map[ch];
        if (color === undefined) continue;
        this.px(x + ix, y + iy, color);
      }
    }
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(this.w, this.h);
    image.data.set(this.data);
    ctx.putImageData(image, 0, 0);
    return canvas;
  }
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = ar + (br - ar) * t;
  const g = ag + (bg - ag) * t;
  const bl = ab + (bb - ab) * t;
  return ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
}

export function hash2(x: number, y: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

export function outlined(pix: Pix, x: number, y: number, w: number, h: number, fill: number, line = 0x120c16): void {
  pix.rect(x, y, w, h, line);
  if (w >= 3 && h >= 3) pix.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

export function blob(pix: Pix, cx: number, cy: number, rx: number, ry: number, color: number, a = 255): void {
  const rxs = Math.max(1, rx);
  const rys = Math.max(1, ry);
  for (let y = -rys; y <= rys; y++) {
    for (let x = -rxs; x <= rxs; x++) {
      const nx = x / rxs;
      const ny = y / rys;
      if (nx * nx + ny * ny <= 1.02) pix.px(cx + x, cy + y, color, a);
    }
  }
}

/** One-pixel ink around opaque pixels. Drawn shapes stay the colors they were painted. */
export function inkOutline(pix: Pix, color = 0x100910): void {
  const w = pix.w;
  const h = pix.h;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = pix.data[i * 4 + 3]! > 40 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid[y * w + x]) continue;
      let touch = false;
      if (x > 0 && solid[y * w + x - 1]) touch = true;
      else if (x + 1 < w && solid[y * w + x + 1]) touch = true;
      else if (y > 0 && solid[(y - 1) * w + x]) touch = true;
      else if (y + 1 < h && solid[(y + 1) * w + x]) touch = true;
      if (touch) pix.px(x, y, color);
    }
  }
}
