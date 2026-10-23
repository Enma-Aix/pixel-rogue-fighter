import Phaser from 'phaser';

let measureCtx: CanvasRenderingContext2D | null = null;

function ctx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  return measureCtx!;
}

export function measure(text: string): number {
  const c = ctx();
  c.font = '12px FusionPixel';
  return Math.ceil(c.measureText(text).width);
}

export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(cur);
      cur = '';
      continue;
    }
    const next = cur + ch;
    if (cur && measure(next) > max) {
      lines.push(cur);
      cur = ch;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export function rasterText(text: string, color: string, scale = 1): HTMLCanvasElement {
  const c = ctx();
  c.font = '12px FusionPixel';
  const w = Math.max(2, Math.ceil(c.measureText(text || ' ').width) + 2);
  const h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.font = '12px FusionPixel';
  g.fillStyle = color;
  g.textBaseline = 'top';
  g.imageSmoothingEnabled = false;
  g.fillText(text, 1, 2);
  if (scale <= 1) return canvas;
  const big = document.createElement('canvas');
  big.width = w * scale;
  big.height = h * scale;
  const b = big.getContext('2d')!;
  b.imageSmoothingEnabled = false;
  b.drawImage(canvas, 0, 0, big.width, big.height);
  return big;
}

export function ensureText(scene: Phaser.Scene, text: string, color: string, scale = 1): string {
  const safe = text.length ? text : ' ';
  const key = `tx|${scale}|${color}|${safe}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, rasterText(safe, color, scale));
  return key;
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = '#f4f0ea',
  scale = 1,
): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, ensureText(scene, text, color, scale));
  img.setOrigin(0, 0);
  return img;
}

export function setLabel(img: Phaser.GameObjects.Image, text: string, color = '#f4f0ea', scale = 1): void {
  const key = ensureText(img.scene, text, color, scale);
  if (img.texture.key !== key) img.setTexture(key);
}
