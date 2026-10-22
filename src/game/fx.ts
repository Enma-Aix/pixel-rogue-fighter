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
    .setDepth(60);
  scene.tweens.add({
    targets: node,
    y: y - 38,
    alpha: 0,
    duration: 680,
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
    y: y - 10,
    alpha: 0,
    duration: 260,
    onUpdate: () => {
      if (img.active) img.setFrame(Math.min(2, Math.floor(((1 - img.alpha) * 3) as number)));
    },
    onComplete: () => img.destroy(),
  });
}

export function spawnSpark(scene: Phaser.Scene, x: number, y: number, color: number): void {
  for (let i = 0; i < 5; i += 1) {
    const bit = scene.add.image(x, y, "px").setDepth(26).setTint(color).setScale(0.7);
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 22;
    scene.tweens.add({
      targets: bit,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: 160 + Math.random() * 90,
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
