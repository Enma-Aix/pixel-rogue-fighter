import Phaser from "phaser";
import { ART } from "./constants";
import { FONT } from "./ui";

const FOOT_ORIGIN = ART.footSrc / ART.texH;

export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const node = scene.add
    .text(x + Phaser.Math.Between(-6, 6), y, text, {
      fontFamily: FONT,
      fontSize: "20px",
      color,
      stroke: "#1a1014",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(60)
    .setScale(1.35);
  scene.tweens.add({
    targets: node,
    y: y - 46,
    scale: 1,
    alpha: 0,
    duration: 520,
    ease: "Cubic.easeOut",
    onComplete: () => node.destroy(),
  });
}

export function spawnSlash(scene: Phaser.Scene, x: number, y: number, dir: number, heavy: boolean): void {
  const img = scene.add.image(x, y, "slash", 0).setOrigin(0.5).setFlipX(dir < 0).setDepth(18);
  if (heavy) img.setScale(1.4);
  let frame = 0;
  const timer = scene.time.addEvent({
    delay: 36,
    repeat: 3,
    callback: () => {
      frame += 1;
      if (!img.active) return;
      if (frame > 3) img.destroy();
      else img.setFrame(frame);
    },
  });
  scene.tweens.add({
    targets: img,
    alpha: 0,
    delay: 90,
    duration: 120,
    onComplete: () => {
      timer.remove(false);
      img.destroy();
    },
  });
}

export function spawnDust(scene: Phaser.Scene, x: number, y: number): void {
  const img = scene.add.image(x, y - 4, "dust", 0).setOrigin(0.5, 1).setDepth(8);
  scene.tweens.add({
    targets: img,
    y: y - 14,
    alpha: 0,
    scaleX: 1.4,
    duration: 280,
    onUpdate: () => {
      if (img.active) img.setFrame(Math.min(2, Math.floor(((1 - img.alpha) * 3) as number)));
    },
    onComplete: () => img.destroy(),
  });
  for (let i = 0; i < 3; i += 1) {
    const mote = scene.add.image(x, y - 6, "px").setDepth(8).setTint(0xd8c4a4).setScale(0.55);
    scene.tweens.add({
      targets: mote,
      x: x + Phaser.Math.Between(-18, 18),
      y: y - Phaser.Math.Between(8, 22),
      alpha: 0,
      duration: 220 + i * 30,
      onComplete: () => mote.destroy(),
    });
  }
}

export function spawnSpark(scene: Phaser.Scene, x: number, y: number, color: number, count = 6): void {
  const ring = scene.add.circle(x, y, 8, color, 0.7).setDepth(25);
  scene.tweens.add({
    targets: ring,
    scale: 2.8,
    alpha: 0,
    duration: 160,
    onComplete: () => ring.destroy(),
  });
  for (let i = 0; i < count; i += 1) {
    const bit = scene.add.image(x, y, "px").setDepth(26).setTint(color).setScale(1.15 + Math.random() * 0.85);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 22 + Math.random() * 34;
    scene.tweens.add({
      targets: bit,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.72 - 8,
      alpha: 0,
      duration: 180 + Math.random() * 140,
      ease: "Quad.easeOut",
      onComplete: () => bit.destroy(),
    });
  }
}

export function spawnAfterimage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frame: string | number,
  flip: boolean,
): void {
  const img = scene.add
    .image(x, y, "ch-player", frame)
    .setOrigin(0.5, FOOT_ORIGIN)
    .setFlipX(flip)
    .setDepth(9)
    .setAlpha(0.45)
    .setTint(0x9ad7ff);
  scene.tweens.add({
    targets: img,
    alpha: 0,
    duration: 180,
    onComplete: () => img.destroy(),
  });
}
