import Phaser from "phaser";
import { audio } from "../audio";
import { GROUND_Y, STAGE_LOOK } from "../constants";
import { loopFrame } from "../art";
import { publish } from "../live";
import { beginRun } from "../run";
import { loadSave, type Save } from "../storage";
import { FONT, GameButton, justDown, label } from "../ui";

function recordLine(save: Save): string {
  if (save.stats.wins > 0) return `已破阵 ${save.stats.wins} 次`;
  if (save.stats.bestStage <= 0) return "尚无战绩";
  const look = STAGE_LOOK[save.stats.bestStage as 1 | 2 | 3];
  return `最远抵达 ${look.label} · ${look.name}`;
}

export class MenuScene extends Phaser.Scene {
  private index = 0;
  private buttons: GameButton[] = [];
  private helpOpen = false;
  private busy = false;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private hero!: Phaser.GameObjects.Sprite;
  private foe!: Phaser.GameObjects.Sprite;
  private lantern!: Phaser.GameObjects.Sprite;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private help!: Phaser.GameObjects.Container;
  private muteText!: Phaser.GameObjects.Text;
  private timeOn = 0;

  constructor() {
    super("menu");
  }

  create(): void {
    this.busy = false;
    this.helpOpen = false;
    this.index = 0;
    this.timeOn = 0;
    const save = loadSave();
    audio.startMusic(0);
    this.cameras.main.fadeIn(200, 7, 6, 12);
    this.add.image(0, 0, "sky-1").setOrigin(0);
    this.far = this.add.tileSprite(0, 0, 960, 540, "far-1").setOrigin(0);
    this.mid = this.add.tileSprite(0, 0, 960, 540, "mid-1").setOrigin(0);
    this.add.tileSprite(480, GROUND_Y + 64, 960, 160, "ground-fill-1");
    this.add.tileSprite(480, GROUND_Y + 9, 960, 18, "ground-top-1");
    this.lantern = this.add.sprite(470, GROUND_Y, "lantern", 0).setOrigin(0.5, 1);
    this.hero = this.add.sprite(230, GROUND_Y, "ch-player", 0).setOrigin(0.5, 186 / 216);
    this.foe = this.add.sprite(730, GROUND_Y, "ch-grunt", 0).setOrigin(0.5, 186 / 216).setFlipX(true);

    this.add
      .text(480, 108, "烬途", {
        fontFamily: FONT,
        fontSize: "92px",
        color: "#f6edd4",
        stroke: "#2a160e",
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    label(this, 480, 176, "横版像素肉鸽格斗", 22, "#f0d7a4");
    label(this, 480, 208, `金币 ${save.gold}    ${recordLine(save)}`, 16, "#d9cbb0");

    const go = (fn: () => void) => () => {
      if (this.busy || this.helpOpen) return;
      fn();
    };
    this.buttons = [
      new GameButton(this, 480, 268, 280, 52, "开始征途", go(() => this.startRun()), () => this.select(0)),
      new GameButton(this, 480, 334, 280, 52, "永久强化", go(() => this.go("shop")), () => this.select(1)),
      new GameButton(this, 480, 400, 280, 52, "操作说明", go(() => this.openHelp()), () => this.select(2)),
    ];
    this.select(0);
    label(this, 480, 460, "↑↓ 选择    Enter 确认", 16, "#cbbfa6");
    this.muteText = label(this, 480, 500, "", 16, "#b7ab96");
    this.refreshVolume();

    const panel = this.add.graphics();
    panel.fillStyle(0x120e16, 0.94);
    panel.fillRoundedRect(180, 70, 600, 400, 12);
    panel.lineStyle(2, 0xe2c27a, 1);
    panel.strokeRoundedRect(180, 70, 600, 400, 12);
    const helpText = this.add
      .text(210, 100, HELP, {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#f6edd8",
        lineSpacing: 8,
      })
      .setOrigin(0, 0);
    const close = new GameButton(this, 480, 420, 200, 48, "关闭", () => this.closeHelp());
    this.help = this.add.container(0, 0, [panel, helpText, close.node]);
    this.help.setVisible(false);

    this.keys = this.input.keyboard!.addKeys("W,S,UP,DOWN,ENTER,J,ESC,M,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["UP", "DOWN", "SPACE"]);
    publish("menu", { gold: save.gold });
  }

  update(_time: number, delta: number): void {
    this.timeOn += delta / 1000;
    this.far.tilePositionX = this.timeOn * 12;
    this.mid.tilePositionX = this.timeOn * 22;
    this.hero.setFrame(loopFrame("player", "idle", this.timeOn, 6));
    this.foe.setFrame(loopFrame("grunt", "idle", this.timeOn, 5));
    this.lantern.setFrame(Math.floor(this.timeOn * 6) % 2);
    if (justDown(this.keys.M)) {
      audio.cycleVolume();
      this.refreshVolume();
    }
    if (this.helpOpen) {
      if (justDown(this.keys.ESC) || justDown(this.keys.ENTER) || justDown(this.keys.J)) this.closeHelp();
      publish("menu", { help: true });
      return;
    }
    if (justDown(this.keys.W) || justDown(this.keys.UP)) this.select((this.index + 2) % 3);
    if (justDown(this.keys.S) || justDown(this.keys.DOWN)) this.select((this.index + 1) % 3);
    if (justDown(this.keys.ENTER) || justDown(this.keys.J) || justDown(this.keys.SPACE)) this.buttons[this.index].press();
    publish("menu", { help: false, index: this.index });
  }

  private select(index: number): void {
    this.index = index;
    this.buttons.forEach((button, i) => button.setSelected(i === index));
  }

  private startRun(): void {
    beginRun();
    this.go("game");
  }

  private openHelp(): void {
    audio.play("ui");
    this.helpOpen = true;
    this.help.setVisible(true);
  }

  private closeHelp(): void {
    this.helpOpen = false;
    this.help.setVisible(false);
  }

  private refreshVolume(): void {
    this.muteText.setText(`M 音量：${audio.volumeName()}`);
  }

  private go(key: string): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(key);
    });
  }
}

const HELP = `移动      A / D  或  ← / →
跳跃      W、空格 或 ↑（点按矮，按住高）
轻击      J
重击      K
闪避      L 或 Shift（短暂无敌）
奥义      U（冷却后可用）
连招      J → J → K
暂停      Esc
音量      M（关 / 低 / 中 / 高）

一局三折。每折结束三选一强化。
金币会留下来，可在永久强化里花掉。
倒下则本局结束。触屏会显示虚拟按键。`;
