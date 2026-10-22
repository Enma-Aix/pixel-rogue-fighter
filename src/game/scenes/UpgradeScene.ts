import Phaser from "phaser";
import { audio } from "../audio";
import { STAGE_LOOK } from "../constants";
import { publish } from "../live";
import { applyUpgrade, getRun, grantStageClear } from "../run";
import { modsFrom } from "../upgrades";
import { rollChoices, UPGRADES } from "../upgrades";
import type { UpgradeId } from "../types";
import { FONT, justDown, label } from "../ui";

export class UpgradeScene extends Phaser.Scene {
  private index = 0;
  private choices: UpgradeId[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private busy = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super("upgrade");
  }

  create(): void {
    const run = getRun();
    if (!run) {
      this.scene.start("menu");
      return;
    }
    this.busy = false;
    this.index = 0;
    grantStageClear(modsFrom(run).gold);
    if (!run.offer || run.offer.stage !== run.stage) {
      run.offer = { stage: run.stage, choices: rollChoices(run) };
    }
    this.choices = run.offer.choices;
    this.cameras.main.fadeIn(180, 7, 6, 12);
    this.add.image(0, 0, `sky-${run.stage}`).setOrigin(0);
    this.add.tileSprite(0, 0, 960, 540, `mid-${run.stage}`).setOrigin(0);
    const look = STAGE_LOOK[run.stage];
    label(this, 480, 58, `${look.label} · ${look.name} 已通过`, 32, "#f6edd4");
    label(this, 480, 100, "择一式，再上路", 22, "#f0d7a4");
    const heal = run.lastHeal > 0 ? `喘息回复 ${run.lastHeal}` : "生命已满";
    label(this, 480, 136, `过关金币 +${run.lastBonus}    ${heal}`, 16, "#d9cbb0");

    this.gfx = this.add.graphics();
    this.choices.forEach((id, index) => {
      const x = 180 + index * 250;
      const zone = this.add.zone(x, 340, 230, 280).setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => {
        this.index = index;
        this.redraw();
      });
      zone.on("pointerdown", () => this.pick(index));
      const def = UPGRADES[id];
      const stacks = run.upgrades.filter((owned) => owned === id).length;
      this.add
        .text(x, 250, def.name, { fontFamily: FONT, fontSize: "32px", color: "#f6edd4" })
        .setOrigin(0.5);
      this.add
        .text(x, 340, def.desc, {
          fontFamily: FONT,
          fontSize: "18px",
          color: "#f3e6d0",
          align: "center",
          wordWrap: { width: 190 },
        })
        .setOrigin(0.5);
      this.add
        .text(x, 430, stacks > 0 ? `已有 ${stacks} 层` : "新得", {
          fontFamily: FONT,
          fontSize: "16px",
          color: "#e2c27a",
        })
        .setOrigin(0.5);
    });
    label(this, 480, 510, "← → 或 1 / 2 / 3 选择    Enter 确认", 16, "#cbbfa6");
    this.keys = this.input.keyboard!.addKeys("LEFT,RIGHT,A,D,ONE,TWO,THREE,ENTER,J,SPACE") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.redraw();
    publish("upgrade", { stage: run.stage, choices: this.choices });
  }

  update(): void {
    if (!this.keys) return;
    if (justDown(this.keys.LEFT) || justDown(this.keys.A)) this.shift(-1);
    if (justDown(this.keys.RIGHT) || justDown(this.keys.D)) this.shift(1);
    if (justDown(this.keys.ONE)) this.pick(0);
    if (justDown(this.keys.TWO)) this.pick(1);
    if (justDown(this.keys.THREE)) this.pick(2);
    if (justDown(this.keys.ENTER) || justDown(this.keys.J) || justDown(this.keys.SPACE)) this.pick(this.index);
    publish("upgrade", { stage: getRun()?.stage ?? 0, choices: this.choices, index: this.index });
  }

  private shift(dir: number): void {
    this.index = (this.index + dir + this.choices.length) % this.choices.length;
    this.redraw();
  }

  private redraw(): void {
    this.gfx.clear();
    this.choices.forEach((_, index) => {
      const x = 180 + index * 250;
      const selected = index === this.index;
      this.gfx.fillStyle(selected ? 0x5a3e22 : 0x161018, 0.92);
      this.gfx.fillRoundedRect(x - 115, 200, 230, 280, 12);
      this.gfx.lineStyle(3, selected ? 0xffe08a : 0xe2c27a, 1);
      this.gfx.strokeRoundedRect(x - 115, 200, 230, 280, 12);
    });
  }

  private pick(index: number): void {
    if (this.busy || index < 0 || index >= this.choices.length) return;
    const run = getRun();
    if (!run) return;
    this.busy = true;
    audio.play("ui");
    applyUpgrade(this.choices[index]);
    if (run.stage < 3) run.stage = (run.stage + 1) as 2 | 3;
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("game");
    });
  }
}
