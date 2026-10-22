import Phaser from "phaser";
import { audio } from "../audio";
import { publish } from "../live";
import { applyUpgrade, completeNode, getRun } from "../run";
import { rollChoices, UPGRADES } from "../upgrades";
import { FONT, justDown, label } from "../ui";

export class RestScene extends Phaser.Scene {
  private index = 0;
  private busy = false;
  private note = "";
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private rows: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("rest");
  }

  create(): void {
    const run = getRun();
    if (!run) {
      this.scene.start("menu");
      return;
    }
    this.busy = false;
    this.index = 0;
    this.note = "";
    this.cameras.main.fadeIn(180, 7, 6, 12);
    this.add.image(0, 0, `sky-${run.stage}`).setOrigin(0);
    this.add.rectangle(480, 270, 640, 380, 0x120e16, 0.9);
    label(this, 480, 110, "歇脚", 40, "#f6edd4");
    label(this, 480, 160, "火很小，够坐一会儿。", 20, "#f0d7a4");
    this.rows = [
      this.add.text(480, 240, "打坐，回复约三成生命", { fontFamily: FONT, fontSize: "24px", color: "#f6edd8" }).setOrigin(0.5),
      this.add.text(480, 310, "淬锋，花费 16 金换一张普通强化", { fontFamily: FONT, fontSize: "24px", color: "#f6edd8" }).setOrigin(0.5),
    ];
    [240, 310].forEach((y, index) => {
      const zone = this.add.zone(480, y, 460, 52).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.pick(index));
    });
    this.add.text(480, 390, "", { fontFamily: FONT, fontSize: "20px", color: "#ffe08a" }).setOrigin(0.5).setName("note");
    this.keys = this.input.keyboard!.addKeys("UP,DOWN,W,S,ENTER,SPACE,J") as Record<string, Phaser.Input.Keyboard.Key>;
    this.paint();
    publish("rest", { hp: run.hp });
  }

  update(): void {
    if (!this.keys || this.busy) return;
    if (this.note) {
      if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE) || justDown(this.keys.J)) this.leave();
      return;
    }
    if (justDown(this.keys.UP) || justDown(this.keys.W)) this.index = this.index === 0 ? 1 : 0;
    if (justDown(this.keys.DOWN) || justDown(this.keys.S)) this.index = this.index === 0 ? 1 : 0;
    this.paint();
    if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE) || justDown(this.keys.J)) this.pick(this.index);
  }

  private paint(): void {
    this.rows.forEach((text, index) => text.setColor(index === this.index ? "#ffe08a" : "#f6edd8"));
    (this.children.getByName("note") as Phaser.GameObjects.Text).setText(this.note);
  }

  private pick(index: number): void {
    const run = getRun();
    if (!run || this.note) return;
    if (index === 0) {
      const heal = Math.max(8, Math.round(run.maxHp * 0.32));
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + heal);
      this.note = `呼吸顺了些，回复 ${run.hp - before}。按 Enter 继续。`;
    } else if (run.gold < 16) {
      this.note = "金币不够。按 Enter 继续，这一间也算歇过了。";
    } else {
      run.gold -= 16;
      const id = rollChoices(run, 11, false).find((item) => UPGRADES[item].rarity === "common") ?? "dmg";
      applyUpgrade(id);
      this.note = `刃口亮了一点，得到「${UPGRADES[id].name}」。按 Enter 继续。`;
    }
    audio.play("ui");
    this.paint();
  }

  private leave(): void {
    if (this.busy || !this.note) return;
    this.busy = true;
    completeNode();
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("map"));
  }
}
