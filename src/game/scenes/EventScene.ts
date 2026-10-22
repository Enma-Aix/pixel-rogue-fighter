import Phaser from "phaser";
import { audio } from "../audio";
import { publish } from "../live";
import { applyUpgrade, completeNode, currentNode, getRun, type RunState } from "../run";
import { rollChoices, UPGRADES } from "../upgrades";
import { Rng } from "../rng";
import { FONT, justDown, label } from "../ui";

interface Choice {
  label: string;
  run: (run: RunState, rng: Rng) => string;
}

export class EventScene extends Phaser.Scene {
  private index = 0;
  private busy = false;
  private note = "";
  private choices: Choice[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private buttons: Phaser.GameObjects.Text[] = [];
  private result!: Phaser.GameObjects.Text;

  constructor() {
    super("event");
  }

  create(): void {
    const run = getRun();
    const node = currentNode();
    if (!run || !node) {
      this.scene.start("menu");
      return;
    }
    this.busy = false;
    this.index = 0;
    this.note = "";
    const rng = new Rng((run.seed + node.row * 13 + node.slot) >>> 0);
    const events = this.pool();
    const event = events[rng.int(events.length)];
    this.choices = event.choices;
    this.cameras.main.fadeIn(180, 7, 6, 12);
    this.add.image(0, 0, `sky-${run.stage}`).setOrigin(0);
    this.add.rectangle(480, 270, 680, 420, 0x120e16, 0.9);
    label(this, 480, 90, event.title, 36, "#f6edd4");
    label(this, 480, 150, event.text, 20, "#f0d7a4");
    this.buttons = this.choices.map((choice, index) => {
      const y = 250 + index * 70;
      const zone = this.add.zone(480, y, 420, 52).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.pick(index));
      return this.add.text(480, y, choice.label, { fontFamily: FONT, fontSize: "22px", color: "#f6edd8" }).setOrigin(0.5);
    });
    this.result = this.add.text(480, 420, "", { fontFamily: FONT, fontSize: "20px", color: "#ffe08a" }).setOrigin(0.5);
    const leave = this.add.zone(480, 470, 220, 44).setInteractive({ useHandCursor: true });
    leave.on("pointerdown", () => this.leave());
    this.add.text(480, 470, "继续上路", { fontFamily: FONT, fontSize: "20px", color: "#d9cbb0" }).setOrigin(0.5);
    this.keys = this.input.keyboard!.addKeys("UP,DOWN,W,S,ENTER,SPACE,J") as Record<string, Phaser.Input.Keyboard.Key>;
    this.paint();
    publish("event", { title: event.title });
  }

  update(): void {
    if (!this.keys || this.busy) return;
    if (this.note) {
      if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE) || justDown(this.keys.J)) this.leave();
      return;
    }
    if (justDown(this.keys.UP) || justDown(this.keys.W)) this.index = (this.index + this.choices.length - 1) % this.choices.length;
    if (justDown(this.keys.DOWN) || justDown(this.keys.S)) this.index = (this.index + 1) % this.choices.length;
    this.paint();
    if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE) || justDown(this.keys.J)) this.pick(this.index);
  }

  private paint(): void {
    this.buttons.forEach((text, index) => text.setColor(index === this.index ? "#ffe08a" : "#f6edd8"));
    this.result.setText(this.note);
  }

  private pick(index: number): void {
    const run = getRun();
    if (!run || this.note) return;
    const rng = new Rng((run.seed + index * 99 + run.kills) >>> 0);
    this.note = this.choices[index].run(run, rng);
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

  private pool(): { title: string; text: string; choices: Choice[] }[] {
    return [
      {
        title: "未熄的火",
        text: "路边一堆炭还是热的。",
        choices: [
          {
            label: "烤一烤，回复 16 点生命",
            run: (run) => {
              const before = run.hp;
              run.hp = Math.min(run.maxHp, run.hp + 16);
              return `暖和了一些，回复 ${run.hp - before}。`;
            },
          },
          {
            label: "翻找余烬",
            run: (run, rng) => {
              if (rng.chance(0.5)) {
                const id = rollChoices(run, 3, false)[0];
                applyUpgrade(id);
                return `摸到一张「${UPGRADES[id].name}」。`;
              }
              run.hp = Math.max(1, run.hp - 10);
              return "炭星溅到手背，失去 10 点生命。";
            },
          },
        ],
      },
      {
        title: "散落的钱袋",
        text: "草里有一袋还没凉透的钱。",
        choices: [
          {
            label: "收下，金币 +22",
            run: (run) => {
              run.gold += 22;
              run.goldEarned += 22;
              return "袋子沉甸甸的。金币 +22。";
            },
          },
          {
            label: "只取一张符",
            run: (run) => {
              const id = rollChoices(run, 5, false).find((item) => UPGRADES[item].rarity === "common") ?? rollChoices(run, 5, false)[0];
              applyUpgrade(id);
              return `留下钱，带走「${UPGRADES[id].name}」。`;
            },
          },
        ],
      },
      {
        title: "路边赌桌",
        text: "一个人把两枚骰子推过来。",
        choices: [
          {
            label: "押上 14 金",
            run: (run, rng) => {
              if (run.gold < 14) return "口袋比骰子还轻，只好作罢。";
              run.gold -= 14;
              if (rng.chance(0.5)) {
                run.gold += 36;
                run.goldEarned += 22;
                return "骰子朝你。净得 22 金。";
              }
              return "骰子朝他。失去 14 金。";
            },
          },
          {
            label: "摇头走开，回复 8 点",
            run: (run) => {
              run.hp = Math.min(run.maxHp, run.hp + 8);
              return "少一事，回复 8 点生命。";
            },
          },
        ],
      },
    ];
  }
}
