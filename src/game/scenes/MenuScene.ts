import Phaser from "phaser";
import { audio } from "../audio";
import { GROUND_Y, STAGE_LOOK } from "../constants";
import { loopFrame } from "../art";
import { controlsText } from "../keys";
import { publish } from "../live";
import { beginRun } from "../run";
import { loadSave, type Save } from "../storage";
import { FONT, GameButton, justDown, label, paintPanel } from "../ui";

function recordLine(save: Save): string {
  if (save.stats.wins > 0) return `已破阵 ${save.stats.wins} 次`;
  if (save.stats.bestStage <= 0) return "尚无战绩";
  const look = STAGE_LOOK[save.stats.bestStage as 1 | 2 | 3];
  return `最远抵达 ${look.label} · ${look.name}`;
}

function helpCopy(): string {
  return `${controlsText()}

一局是一张岔路。灯魂、竹客、残将出手前会亮招式名。
强化分灼血、迅刃、反手、奥流。同路拿得越多，越会咬合。
这一局的金币能在路摊花掉，剩下的结算时存进永久强化。
音乐、震动、触屏和重置在「设置」里。`;
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
  private helpText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
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
      .text(480, 78, "烬途", {
        fontFamily: FONT,
        fontSize: "76px",
        color: "#f6edd4",
        stroke: "#2a160e",
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    label(this, 480, 136, "横版像素肉鸽格斗", 20, "#f0d7a4");
    label(this, 480, 166, `金币 ${save.gold}    ${recordLine(save)}`, 16, "#d9cbb0");

    const go = (fn: () => void) => () => {
      if (this.busy || this.helpOpen) return;
      fn();
    };
    this.buttons = [
      new GameButton(this, 480, 220, 280, 48, "开始征途", go(() => this.startRun()), () => this.select(0)),
      new GameButton(this, 480, 276, 280, 48, "永久强化", go(() => this.go("shop")), () => this.select(1)),
      new GameButton(this, 480, 332, 280, 48, "设置", go(() => this.go("settings")), () => this.select(2)),
      new GameButton(this, 480, 388, 280, 48, "操作说明", go(() => this.openHelp()), () => this.select(3)),
    ];
    this.select(0);
    label(this, 480, 448, "↑↓ 选择    Enter 确认", 16, "#cbbfa6");
    this.toast = label(this, 480, 492, "", 16, "#b7ab96");

    const panel = this.add.graphics();
    paintPanel(panel, 150, 36, 660, 460);
    this.helpText = this.add
      .text(186, 64, helpCopy(), {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#f6edd8",
        lineSpacing: 6,
        wordWrap: { width: 590 },
      })
      .setOrigin(0, 0);
    const close = new GameButton(this, 480, 448, 200, 44, "关闭", () => this.closeHelp());
    this.help = this.add.container(0, 0, [panel, this.helpText, close.node]);
    this.help.setVisible(false).setDepth(20);

    this.keys = this.input.keyboard!.addKeys("W,S,UP,DOWN,ENTER,J,ESC,M,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["UP", "DOWN", "SPACE"]);
    publish("menu", { gold: save.gold, tutorial: !save.tutorialDone, help: false, index: 0 });
  }

  update(_time: number, delta: number): void {
    this.timeOn += delta / 1000;
    this.far.tilePositionX = this.timeOn * 12;
    this.mid.tilePositionX = this.timeOn * 22;
    this.hero.setFrame(loopFrame("player", "idle", this.timeOn, 6));
    this.foe.setFrame(loopFrame("grunt", "idle", this.timeOn, 5));
    this.lantern.setFrame(Math.floor(this.timeOn * 6) % 2);
    if (justDown(this.keys.M)) {
      audio.cycleSfx();
      this.toast.setText(`音效 ${audio.sfxName()}`);
      this.toast.setAlpha(1);
      this.tweens.killTweensOf(this.toast);
      this.tweens.add({ targets: this.toast, alpha: 0, delay: 700, duration: 400 });
    }
    if (this.helpOpen) {
      if (justDown(this.keys.ESC) || justDown(this.keys.ENTER) || justDown(this.keys.J)) this.closeHelp();
      publish("menu", { help: true, index: this.index });
      return;
    }
    const n = this.buttons.length;
    if (justDown(this.keys.W) || justDown(this.keys.UP)) this.select((this.index + n - 1) % n);
    if (justDown(this.keys.S) || justDown(this.keys.DOWN)) this.select((this.index + 1) % n);
    if (justDown(this.keys.ENTER) || justDown(this.keys.J) || justDown(this.keys.SPACE)) this.buttons[this.index].press();
    publish("menu", { help: false, index: this.index, tutorial: !loadSave().tutorialDone });
  }

  private select(index: number): void {
    this.index = index;
    this.buttons.forEach((button, i) => button.setSelected(i === index));
  }

  private startRun(): void {
    if (!loadSave().tutorialDone) this.go("tutorial", { then: "map" });
    else {
      beginRun();
      this.go("map");
    }
  }

  private openHelp(): void {
    audio.play("ui");
    this.helpText.setText(helpCopy());
    this.helpOpen = true;
    this.help.setVisible(true);
  }

  private closeHelp(): void {
    this.helpOpen = false;
    this.help.setVisible(false);
  }

  private go(key: string, data?: object): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(key, data);
    });
  }
}
