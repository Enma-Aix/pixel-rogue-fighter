import Phaser from "phaser";

export const FONT = '"ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif';

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size: number,
  color = "#f4ecd8",
  align: "left" | "center" | "right" = "center",
): Phaser.GameObjects.Text {
  const originX = align === "left" ? 0 : align === "right" ? 1 : 0.5;
  return scene.add
    .text(x, y, content, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      align,
    })
    .setOrigin(originX, 0.5);
}

export class GameButton {
  readonly node: Phaser.GameObjects.Container;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly caption: Phaser.GameObjects.Text;
  private selected = false;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    public x: number,
    public y: number,
    public w: number,
    public h: number,
    text: string,
    private readonly onPress: () => void,
    private readonly onHover?: () => void,
  ) {
    this.gfx = scene.add.graphics();
    this.caption = scene.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: "26px",
        color: "#f6edd8",
      })
      .setOrigin(0.5);
    const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => this.onHover?.());
    zone.on("pointerdown", () => this.press());
    this.node = scene.add.container(x, y, [this.gfx, this.caption, zone]);
    this.draw();
  }

  setText(text: string): void {
    this.caption.setText(text);
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.draw();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.draw();
  }

  press(): void {
    if (!this.enabled) return;
    this.onPress();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    const fill = !this.enabled ? 0x2a2430 : this.selected ? 0x6a4a28 : 0x241c28;
    const stroke = !this.enabled ? 0x5c5348 : 0xe2c27a;
    paintPanel(g, -this.w / 2, -this.h / 2, this.w, this.h, fill, stroke, this.selected && this.enabled);
    this.caption.setColor(this.enabled ? "#f6edd8" : "#8d8478");
  }
}

export function paintPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = 0x120e16,
  stroke = 0xe2c27a,
  selected = false,
): void {
  g.fillStyle(fill, 0.94);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x3a2c1c, 0.9);
  g.fillRect(x + 3, y + 3, w - 6, 3);
  g.lineStyle(2, stroke, 1);
  g.strokeRect(x, y, w, h);
  g.lineStyle(3, selected ? 0xffe08a : stroke, 1);
  const n = Math.min(10, Math.floor(Math.min(w, h) / 4));
  g.beginPath();
  g.moveTo(x, y + n);
  g.lineTo(x, y);
  g.lineTo(x + n, y);
  g.moveTo(x + w - n, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w, y + n);
  g.moveTo(x, y + h - n);
  g.lineTo(x, y + h);
  g.lineTo(x + n, y + h);
  g.moveTo(x + w - n, y + h);
  g.lineTo(x + w, y + h);
  g.lineTo(x + w, y + h - n);
  g.strokePath();
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  paintPanel(g, x, y, w, h);
  return g;
}

export function justDown(key?: Phaser.Input.Keyboard.Key): boolean {
  return !!key && Phaser.Input.Keyboard.JustDown(key);
}
