import Phaser from "phaser";
import type { BufferName } from "./types";
import { FONT } from "./ui";

type Hold = "left" | "right" | "jump";

const LAYOUT: { id: Hold | BufferName; label: string; x: number; y: number }[] = [
  { id: "left", label: "左", x: 58, y: 500 },
  { id: "right", label: "右", x: 124, y: 500 },
  { id: "jump", label: "跳", x: 190, y: 500 },
  { id: "light", label: "轻", x: 770, y: 500 },
  { id: "heavy", label: "重", x: 836, y: 500 },
  { id: "dodge", label: "闪", x: 902, y: 500 },
  { id: "special", label: "奥", x: 902, y: 436 },
];

let touchForce: boolean | null = null;

export function touchOn(): boolean {
  if (touchForce !== null) return touchForce;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

export function toggleTouch(): boolean {
  touchForce = !touchOn();
  return touchForce;
}

export class TouchControls {
  left = false;
  right = false;
  jump = false;
  private readonly nodes: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Zone> = [];

  constructor(
    scene: Phaser.Scene,
    private readonly press: (name: BufferName) => void,
  ) {
    scene.input.addPointer(4);
    for (const item of LAYOUT) {
      const gfx = scene.add.graphics().setScrollFactor(0).setDepth(260);
      const text = scene.add
        .text(item.x, item.y, item.label, { fontFamily: FONT, fontSize: "22px", color: "#f6edd8" })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(261);
      const zone = scene.add.zone(item.x, item.y, 56, 48).setScrollFactor(0).setDepth(262).setInteractive();
      const paint = (hot: boolean) => {
        gfx.clear();
        gfx.fillStyle(hot ? 0x6a4a28 : 0x161018, 0.78);
        gfx.fillRoundedRect(item.x - 28, item.y - 24, 56, 48, 8);
        gfx.lineStyle(2, 0xe2c27a, 0.9);
        gfx.strokeRoundedRect(item.x - 28, item.y - 24, 56, 48, 8);
      };
      paint(false);
      const down = () => {
        paint(true);
        if (item.id === "left") this.left = true;
        else if (item.id === "right") this.right = true;
        else if (item.id === "jump") {
          this.jump = true;
          this.press("jump");
        } else this.press(item.id);
      };
      const up = () => {
        paint(false);
        if (item.id === "left") this.left = false;
        else if (item.id === "right") this.right = false;
        else if (item.id === "jump") this.jump = false;
      };
      zone.on("pointerdown", down);
      zone.on("pointerup", up);
      zone.on("pointerout", up);
      zone.on("pointerupoutside", up);
      this.nodes.push(gfx, text, zone);
    }
    this.setVisible(touchOn());
  }

  setVisible(on: boolean): void {
    for (const node of this.nodes) {
      node.setVisible(on);
      if (node instanceof Phaser.GameObjects.Zone) {
        if (on) node.setInteractive();
        else node.disableInteractive();
      }
    }
  }
}
