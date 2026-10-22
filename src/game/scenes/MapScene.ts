import Phaser from "phaser";
import { audio } from "../audio";
import { BOSS_CARD, bossForAct } from "../bosses";
import { STAGE_LOOK } from "../constants";
import { publish } from "../live";
import { enterNode, getRun, reachableAhead, type MapNode } from "../run";
import { synergyLine } from "../upgrades";
import type { RoomKind } from "../types";
import { FONT, justDown, label } from "../ui";

const NAME: Record<RoomKind, string> = {
  combat: "战斗",
  elite: "精锐",
  shop: "商店",
  event: "际遇",
  rest: "歇脚",
  boss: "首领",
};

const BLURB: Record<RoomKind, string> = {
  combat: "清掉屋里的敌人，然后三选一。",
  elite: "更难的敌人，金币更多，打完能喘口气。",
  shop: "用这一局的金币买强化，或买一次治疗。",
  event: "路上的岔事，结果不一定讨喜。",
  rest: "坐下回复，或者花一点金币换一张普通强化。",
  boss: "这一折的首领。看清招式名再动手。",
};

const MARK: Record<RoomKind, string> = {
  combat: "战",
  elite: "精",
  shop: "店",
  event: "机",
  rest: "息",
  boss: "将",
};

const COLOR: Record<RoomKind, number> = {
  combat: 0xc4554a,
  elite: 0xd4a017,
  shop: 0xe6c36a,
  event: 0x6eb7e6,
  rest: 0x7ecb96,
  boss: 0xb06ad4,
};

function nodeCopy(node: MapNode): { mark: string; color: number; name: string; blurb: string } {
  if (node.kind === "boss") {
    const card = BOSS_CARD[bossForAct(node.act)];
    const mark = node.act === 1 ? "灯" : node.act === 2 ? "竹" : "将";
    return { mark, color: card.bar, name: card.name, blurb: `${card.intro} · ${card.introSub}。出手前会亮出招式名，打空了再还手。` };
  }
  return { mark: MARK[node.kind], color: COLOR[node.kind], name: NAME[node.kind], blurb: BLURB[node.kind] };
}

function spot(node: MapNode, nodes: MapNode[]): { x: number; y: number } {
  const siblings = nodes.filter((item) => item.row === node.row);
  const y = 78 + node.row * 46;
  const x = siblings.length < 2 ? 470 : node.slot === 0 ? 330 : 610;
  return { x, y };
}

export class MapScene extends Phaser.Scene {
  private index = 0;
  private busy = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private detail!: Phaser.GameObjects.Text;
  private choice: MapNode[] = [];

  constructor() {
    super("map");
  }

  create(): void {
    const run = getRun();
    if (!run) {
      this.scene.start("menu");
      return;
    }
    this.busy = false;
    this.index = 0;
    audio.startMusic(run.stage);
    this.cameras.main.fadeIn(180, 7, 6, 12);
    const look = STAGE_LOOK[run.stage];
    this.add.image(0, 0, `sky-${run.stage}`).setOrigin(0);
    this.add.tileSprite(0, 0, 960, 540, `far-${run.stage}`).setOrigin(0).setAlpha(0.85);
    label(this, 480, 28, "征途", 32, "#f6edd4");
    const line = synergyLine(run.upgrades);
    label(this, 480, 52, `生命 ${Math.ceil(run.hp)}/${run.maxHp}    金币 ${run.gold}${line ? `    ${line}` : ""}`, 16, "#f0d7a4");
    ([1, 2, 3] as const).forEach((act) => {
      const y = 78 + (act - 1) * 3 * 46;
      label(this, 78, y, STAGE_LOOK[act].label, 16, "#d9cbb0");
    });

    const gfx = this.add.graphics();
    const ahead = reachableAhead();
    for (const node of run.map) {
      const from = spot(node, run.map);
      for (const nextId of node.next) {
        const next = run.map.find((item) => item.id === nextId);
        if (!next) continue;
        const to = spot(next, run.map);
        gfx.lineStyle(2, 0xe2c27a, node.done && !node.skip ? 0.85 : 0.35);
        gfx.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
    this.choice = run.available.map((id) => run.map.find((node) => node.id === id)).filter((node): node is MapNode => !!node);
    for (const node of run.map) {
      const at = spot(node, run.map);
      const open = this.choice.some((item) => item.id === node.id);
      const future = ahead.has(node.id);
      const copy = nodeCopy(node);
      const size = open ? 36 : 30;
      const fill = node.skip ? 0x2a242c : node.done ? 0x3a3428 : open ? copy.color : future ? 0x3a4450 : 0x241c22;
      gfx.fillStyle(fill, 1);
      gfx.fillRect(at.x - size / 2, at.y - size / 2, size, size);
      gfx.lineStyle(2, open ? 0xffe08a : 0x8a7a68, open ? 1 : 0.75);
      gfx.strokeRect(at.x - size / 2, at.y - size / 2, size, size);
      if (open) {
        gfx.lineStyle(3, 0xffe08a, 1);
        gfx.strokeRect(at.x - size / 2 - 3, at.y - size / 2 - 3, 8, 3);
        gfx.strokeRect(at.x + size / 2 - 5, at.y - size / 2 - 3, 8, 3);
      }
      this.add
        .text(at.x, at.y, copy.mark, { fontFamily: FONT, fontSize: "16px", color: node.skip ? "#6a646c" : "#f6edd8" })
        .setOrigin(0.5);
      if (open) {
        const zone = this.add.zone(at.x, at.y, 48, 48).setInteractive({ useHandCursor: true });
        const index = this.choice.findIndex((item) => item.id === node.id);
        zone.on("pointerdown", () => this.go(index));
        zone.on("pointerover", () => {
          this.index = index;
          this.refresh();
        });
      }
    }
    this.detail = this.add
      .text(480, 508, "", {
        fontFamily: FONT,
        fontSize: "18px",
        color: "#f6edd8",
        align: "center",
      })
      .setOrigin(0.5);
    label(this, 860, 508, `${look.name}`, 16, "#d9cbb0");
    this.keys = this.input.keyboard!.addKeys("LEFT,RIGHT,A,D,ENTER,SPACE,J") as Record<string, Phaser.Input.Keyboard.Key>;
    this.refresh();
    publish("map", { available: run.available, gold: run.gold, hp: run.hp });
  }

  update(): void {
    if (this.busy || !this.keys) return;
    if (justDown(this.keys.LEFT) || justDown(this.keys.A)) this.shift(-1);
    if (justDown(this.keys.RIGHT) || justDown(this.keys.D)) this.shift(1);
    if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE) || justDown(this.keys.J)) this.go(this.index);
  }

  private shift(dir: number): void {
    if (this.choice.length === 0) return;
    this.index = (this.index + dir + this.choice.length) % this.choice.length;
    this.refresh();
  }

  private refresh(): void {
    const node = this.choice[this.index];
    if (!node) {
      this.detail.setText("这一程已经走完");
      return;
    }
    const copy = nodeCopy(node);
    this.detail.setText(`${copy.name}    ${copy.blurb}`);
  }

  private go(index: number): void {
    if (this.busy) return;
    const node = this.choice[index];
    if (!node) return;
    this.busy = true;
    audio.play("ui");
    enterNode(node.id);
    const target = node.kind === "shop" ? "runshop" : node.kind === "event" ? "event" : node.kind === "rest" ? "rest" : "game";
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target);
    });
  }
}
