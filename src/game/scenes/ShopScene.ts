import Phaser from "phaser";
import { audio } from "../audio";
import { publish } from "../live";
import { loadSave, type Save } from "../storage";
import type { EndMode, MetaId } from "../types";
import { META, META_ORDER, metaCost, tryBuy } from "../upgrades";
import { FONT, justDown, label } from "../ui";

export class ShopScene extends Phaser.Scene {
  private back: "menu" | "summary" = "menu";
  private mode: EndMode = "dead";
  private index = 0;
  private busy = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private gfx!: Phaser.GameObjects.Graphics;
  private lines: Phaser.GameObjects.Text[] = [];
  private goldText!: Phaser.GameObjects.Text;

  constructor() {
    super("shop");
  }

  init(data: { back?: "menu" | "summary"; mode?: EndMode }): void {
    this.back = data?.back ?? "menu";
    this.mode = data?.mode ?? "dead";
  }

  create(): void {
    this.busy = false;
    this.index = 0;
    this.cameras.main.fadeIn(160, 7, 6, 12);
    this.add.rectangle(480, 270, 960, 540, 0x100e16, 1);
    label(this, 480, 48, "永久强化", 40, "#f6edd4");
    this.goldText = label(this, 480, 92, "", 18, "#f0d7a4");
    this.gfx = this.add.graphics();
    this.lines = META_ORDER.map((id, index) => {
      const y = 160 + index * 62;
      const zone = this.add.zone(480, y, 760, 54).setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => {
        this.index = index;
        this.redraw();
      });
      zone.on("pointerdown", () => this.buy(id));
      return this.add.text(140, y, "", { fontFamily: FONT, fontSize: "20px", color: "#f6edd8" }).setOrigin(0, 0.5);
    });
    const back = this.add.zone(480, 490, 220, 48).setInteractive({ useHandCursor: true });
    back.on("pointerover", () => {
      this.index = META_ORDER.length;
      this.redraw();
    });
    back.on("pointerdown", () => this.leave());
    this.add.text(480, 490, "返回", { fontFamily: FONT, fontSize: "24px", color: "#f6edd8" }).setOrigin(0.5);
    label(this, 480, 524, "↑↓ 选择    Enter 购买    Esc 返回", 15, "#cbbfa6");
    this.keys = this.input.keyboard!.addKeys("W,S,UP,DOWN,ENTER,J,SPACE,ESC") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["UP", "DOWN", "SPACE"]);
    this.redraw();
  }

  update(): void {
    if (!this.keys || this.busy) return;
    const max = META_ORDER.length;
    if (justDown(this.keys.W) || justDown(this.keys.UP)) {
      this.index = (this.index + max) % (max + 1);
      this.redraw();
    }
    if (justDown(this.keys.S) || justDown(this.keys.DOWN)) {
      this.index = (this.index + 1) % (max + 1);
      this.redraw();
    }
    if (justDown(this.keys.ENTER) || justDown(this.keys.J) || justDown(this.keys.SPACE)) {
      if (this.index === max) this.leave();
      else this.buy(META_ORDER[this.index]);
    }
    if (justDown(this.keys.ESC)) this.leave();
    publish("shop", { gold: loadSave().gold, index: this.index });
  }

  private buy(id: MetaId): void {
    if (tryBuy(id)) audio.play("coin");
    else audio.play("ui");
    this.redraw();
  }

  private redraw(): void {
    const save = loadSave();
    this.goldText.setText(`行囊 ${save.gold} 金    ${this.preview(save)}`);
    this.gfx.clear();
    META_ORDER.forEach((id, index) => {
      const y = 160 + index * 62;
      const selected = index === this.index;
      this.gfx.fillStyle(selected ? 0x5a3e22 : 0x1b1520, 0.95);
      this.gfx.fillRoundedRect(110, y - 26, 740, 52, 8);
      this.gfx.lineStyle(2, selected ? 0xffe08a : 0x8a7044, 1);
      this.gfx.strokeRoundedRect(110, y - 26, 740, 52, 8);
      const def = META[id];
      const level = save.levels[id];
      const maxed = level >= def.max;
      const cost = maxed ? "已满" : `${metaCost(id, level)} 金`;
      this.lines[index].setText(`${def.name}  Lv ${level}/${def.max}    ${def.desc}    ${def.detail(level)}    ${cost}`);
    });
    this.gfx.lineStyle(2, this.index === META_ORDER.length ? 0xffe08a : 0x8a7044, 1);
    this.gfx.strokeRoundedRect(370, 466, 220, 48, 8);
    publish("shop", {
      gold: save.gold,
      levels: save.levels,
      index: this.index,
    });
  }

  private preview(save: Save): string {
    const hp = 100 + save.levels.hp * 14;
    const atk = Math.round((1 + save.levels.atk * 0.08) * 100);
    return `生命 ${hp}  攻击 ${atk}%`;
  }

  private leave(): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    this.cameras.main.fadeOut(150, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (this.back === "summary") this.scene.start("summary", { mode: this.mode });
      else this.scene.start("menu");
    });
  }
}
