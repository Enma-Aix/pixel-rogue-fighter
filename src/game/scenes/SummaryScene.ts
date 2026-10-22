import Phaser from "phaser";
import { audio } from "../audio";
import { STAGE_LOOK } from "../constants";
import { publish } from "../live";
import { beginRun, getRun, settleRun } from "../run";
import { UPGRADES } from "../upgrades";
import type { EndMode } from "../types";
import { FONT, GameButton, justDown, label } from "../ui";

const TITLE: Record<EndMode, string> = {
  win: "阵破",
  dead: "力竭",
  quit: "暂歇",
};

const BLURB: Record<EndMode, string> = {
  win: "残城已破。这一路收下的金币，已经进了行囊。",
  dead: "你倒在征途上。金币已经入账，可以再走一遭。",
  quit: "这一程先停在这里。已经拿到的金币还在。",
};

export class SummaryScene extends Phaser.Scene {
  private mode: EndMode = "dead";
  private index = 0;
  private buttons: GameButton[] = [];
  private busy = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super("summary");
  }

  init(data: { mode?: EndMode }): void {
    this.mode = data?.mode ?? "dead";
  }

  create(): void {
    const run = getRun();
    if (!run) {
      this.scene.start("menu");
      return;
    }
    settleRun(this.mode);
    audio.stopMusic();
    if (this.mode === "win") audio.play("win");
    this.busy = false;
    this.index = 0;
    this.cameras.main.fadeIn(220, 7, 6, 12);
    const stage = Math.min(3, Math.max(1, run.stage)) as 1 | 2 | 3;
    this.add.image(0, 0, `sky-${stage}`).setOrigin(0);
    this.add.tileSprite(0, 0, 960, 540, `far-${stage}`).setOrigin(0).setAlpha(0.85);
    const look = STAGE_LOOK[stage];
    this.add
      .text(480, 78, TITLE[this.mode], {
        fontFamily: FONT,
        fontSize: "72px",
        color: this.mode === "win" ? "#ffe08a" : "#f6edd4",
        stroke: "#2a160e",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    label(this, 480, 140, BLURB[this.mode], 18, "#f0d7a4");
    const names = run.upgrades.length ? run.upgrades.map((id) => UPGRADES[id].name).join("、") : "无";
    const where = this.mode === "win" ? "破阵" : `${look.label} · ${look.name}`;
    const cause = run.cause ? `\n倒下前  ${run.cause} ${run.downHits} 次` : "";
    const body = `抵达  ${where}\n击败  ${run.kills}\n存入金币  ${run.gold}\n强化  ${names}${cause}`;
    this.add
      .text(480, 250, body, {
        fontFamily: FONT,
        fontSize: "22px",
        color: "#f6edd8",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5);
    this.buttons = [
      new GameButton(this, 480, 360, 260, 48, "再走一遭", () => this.again(), () => this.select(0)),
      new GameButton(this, 480, 420, 260, 48, "永久强化", () => this.shop(), () => this.select(1)),
      new GameButton(this, 480, 480, 260, 48, "返回标题", () => this.menu(), () => this.select(2)),
    ];
    this.select(0);
    this.keys = this.input.keyboard!.addKeys("W,S,UP,DOWN,ENTER,J,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    publish("summary", {
      victory: this.mode === "win",
      mode: this.mode,
      stage: run.stage,
      kills: run.kills,
      gold: run.goldEarned,
    });
  }

  update(): void {
    if (!this.keys || this.busy) return;
    if (justDown(this.keys.W) || justDown(this.keys.UP)) this.select((this.index + 2) % 3);
    if (justDown(this.keys.S) || justDown(this.keys.DOWN)) this.select((this.index + 1) % 3);
    if (justDown(this.keys.ENTER) || justDown(this.keys.J) || justDown(this.keys.SPACE)) this.buttons[this.index].press();
  }

  private select(index: number): void {
    this.index = index;
    this.buttons.forEach((button, i) => button.setSelected(i === index));
  }

  private again(): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    beginRun();
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("game"));
  }

  private shop(): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    this.cameras.main.fadeOut(150, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("shop", { back: "summary", mode: this.mode });
    });
  }

  private menu(): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    this.cameras.main.fadeOut(150, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("menu"));
  }
}
