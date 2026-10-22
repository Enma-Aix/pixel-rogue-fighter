import Phaser from "phaser";
import { GAME_WIDTH, clamp } from "./constants";
import { FONT } from "./ui";

export interface HudModel {
  hp: number;
  maxHp: number;
  gold: number;
  stageLabel: string;
  stageName: string;
  special: number;
  charges: number;
  maxCharges: number;
  charge: number;
  objective: string;
  hint: string;
  combo: number;
  upgrades: string;
  boss?: { hp: number; max: number };
}

export class Hud {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly meta: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly combo: Phaser.GameObjects.Text;
  private readonly perks: Phaser.GameObjects.Text;
  private readonly boss: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const depth = 220;
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    const style = (size: number, color: string) => ({
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
    });
    this.hpText = scene.add.text(24, 50, "", style(16, "#f6edd8")).setScrollFactor(0).setDepth(depth + 1);
    this.meta = scene.add.text(GAME_WIDTH - 24, 22, "", style(18, "#f3e2b0")).setOrigin(1, 0).setScrollFactor(0).setDepth(depth + 1);
    this.objective = scene.add.text(GAME_WIDTH - 24, 78, "", style(16, "#d7c7a4")).setOrigin(1, 0).setScrollFactor(0).setDepth(depth + 1);
    this.perks = scene.add.text(24, 104, "", style(15, "#d9c7a4")).setScrollFactor(0).setDepth(depth + 1);
    this.hint = scene.add.text(GAME_WIDTH / 2, 392, "", style(16, "#f0e2c4")).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.combo = scene.add.text(GAME_WIDTH / 2, 128, "", style(28, "#ffe08a")).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.boss = scene.add.text(GAME_WIDTH / 2, 16, "", style(16, "#f0d0c8")).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth + 1);
  }

  update(model: HudModel): void {
    const g = this.gfx;
    g.clear();
    const ratio = model.maxHp > 0 ? model.hp / model.maxHp : 0;
    this.bar(24, 24, 280, 18, ratio, ratio < 0.3 ? 0xff4466 : 0xd4534a, 0x241018);
    this.hpText.setText(`行者  ${Math.ceil(model.hp)}/${model.maxHp}`);
    this.meta.setText(`${model.stageLabel} · ${model.stageName}\n金币 ${model.gold}`);
    this.objective.setText(model.objective);
    this.perks.setText(model.upgrades);
    this.hint.setText(model.hint);
    this.combo.setText(model.combo >= 2 ? `${model.combo} 连击` : "");

    for (let i = 0; i < model.maxCharges; i += 1) {
      const fill = i < model.charges ? 1 : i === model.charges ? model.charge : 0;
      this.bar(24 + i * 28, 76, 22, 10, fill, 0x7ec8ff, 0x1a2430);
    }
    this.bar(24 + model.maxCharges * 28 + 8, 74, 130, 12, model.special, model.special >= 1 ? 0xf0c14a : 0x8a6a32, 0x241c12);

    if (model.boss) {
      this.boss.setText("残将 · 玄甲");
      const bossRatio = model.boss.max > 0 ? model.boss.hp / model.boss.max : 0;
      this.bar(GAME_WIDTH / 2 - 160, 38, 320, 16, bossRatio, 0xa24ad0, 0x1a1020);
    } else {
      this.boss.setText("");
    }
  }

  private bar(x: number, y: number, w: number, h: number, ratio: number, fill: number, bg: number): void {
    const g = this.gfx;
    g.fillStyle(bg, 0.9);
    g.fillRect(x, y, w, h);
    g.fillStyle(fill, 1);
    g.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp(ratio, 0, 1)), h - 4);
    g.lineStyle(2, 0xe6d2a8, 0.9);
    g.strokeRect(x, y, w, h);
  }
}
