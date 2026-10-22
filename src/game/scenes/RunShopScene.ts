import Phaser from "phaser";
import { audio } from "../audio";
import { publish } from "../live";
import { applyUpgrade, completeNode, currentNode, getRun } from "../run";
import { healPrice, shopOffers, UPGRADES, type ShopOffer } from "../upgrades";
import { FONT, justDown, label } from "../ui";

export class RunShopScene extends Phaser.Scene {
  private offers: ShopOffer[] = [];
  private index = 0;
  private busy = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private goldText!: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("runshop");
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
    this.offers = shopOffers(run, node.row * 17 + node.slot);
    this.cameras.main.fadeIn(180, 7, 6, 12);
    this.add.image(0, 0, `sky-${run.stage}`).setOrigin(0);
    this.add.rectangle(480, 270, 640, 460, 0x120e16, 0.88);
    label(this, 480, 70, "路摊", 36, "#f6edd4");
    this.goldText = label(this, 480, 112, "", 18, "#f0d7a4");
    this.rows = this.offers.map((_, index) => {
      const y = 180 + index * 64;
      const zone = this.add.zone(480, y, 460, 52).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => this.buy(index));
      zone.on("pointerover", () => {
        this.index = index;
      });
      return this.add.text(480, y, "", { fontFamily: FONT, fontSize: "20px", color: "#f6edd8" }).setOrigin(0.5);
    });
    const healY = 180 + this.offers.length * 64;
    const heal = this.add.zone(480, healY, 460, 52).setInteractive({ useHandCursor: true });
    heal.on("pointerdown", () => this.heal());
    this.rows.push(this.add.text(480, healY, "", { fontFamily: FONT, fontSize: "20px", color: "#9dffb0" }).setOrigin(0.5));
    const leaveY = healY + 58;
    const leave = this.add.zone(480, leaveY, 460, 52).setInteractive({ useHandCursor: true });
    leave.on("pointerdown", () => this.leave());
    this.rows.push(this.add.text(480, leaveY, "离开", { fontFamily: FONT, fontSize: "20px", color: "#f6edd8" }).setOrigin(0.5));
    label(this, 480, 500, "↑↓ 选择    Enter 确认", 16, "#cbbfa6");
    this.keys = this.input.keyboard!.addKeys("UP,DOWN,W,S,ENTER,SPACE,J") as Record<string, Phaser.Input.Keyboard.Key>;
    this.redraw();
    publish("runshop", { gold: run.gold });
  }

  update(): void {
    if (this.busy || !this.keys) return;
    const total = this.rows.length;
    if (justDown(this.keys.UP) || justDown(this.keys.W)) this.index = (this.index + total - 1) % total;
    if (justDown(this.keys.DOWN) || justDown(this.keys.S)) this.index = (this.index + 1) % total;
    this.redraw();
    if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE) || justDown(this.keys.J)) {
      if (this.index < this.offers.length) this.buy(this.index);
      else if (this.index === this.offers.length) this.heal();
      else this.leave();
    }
  }

  private redraw(): void {
    const run = getRun();
    if (!run) return;
    this.goldText.setText(`持有金币 ${run.gold}    生命 ${Math.ceil(run.hp)}/${run.maxHp}`);
    this.offers.forEach((offer, index) => {
      const def = UPGRADES[offer.id];
      const mark = offer.sold ? "已售" : `${offer.price} 金`;
      this.rows[index].setText(`${def.name}  ·  ${def.desc}    ${mark}`);
      this.rows[index].setColor(index === this.index ? "#ffe08a" : "#f6edd8");
    });
    const heal = healPrice(run.stage);
    this.rows[this.offers.length].setText(`疗伤    回复约三成生命    ${heal} 金`);
    this.rows[this.offers.length].setColor(this.index === this.offers.length ? "#ffe08a" : "#9dffb0");
    this.rows[this.offers.length + 1].setColor(this.index === this.offers.length + 1 ? "#ffe08a" : "#f6edd8");
  }

  private buy(index: number): void {
    const run = getRun();
    const offer = this.offers[index];
    if (!run || !offer || offer.sold || run.gold < offer.price) {
      audio.play("ui");
      return;
    }
    run.gold -= offer.price;
    offer.sold = true;
    applyUpgrade(offer.id);
    audio.play("coin");
    this.redraw();
  }

  private heal(): void {
    const run = getRun();
    if (!run) return;
    const price = healPrice(run.stage);
    if (run.gold < price || run.hp >= run.maxHp) {
      audio.play("ui");
      return;
    }
    run.gold -= price;
    run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.3));
    audio.play("coin");
    this.redraw();
  }

  private leave(): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    completeNode();
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("map"));
  }
}
