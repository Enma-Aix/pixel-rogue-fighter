import Phaser from "phaser";
import { createArt } from "../art";
import { publish } from "../live";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    try {
      createArt(this);
      publish("boot", {});
      this.scene.start("menu");
    } catch (err) {
      console.error(err);
      this.add.text(20, 20, `画面生成失败\n${String(err)}`, {
        color: "#fff4e8",
        fontSize: "18px",
        wordWrap: { width: 900 },
      });
    }
  }
}
