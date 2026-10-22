import "./style.css";
import fontUrl from "./assets/ZCOOLKuaiLe-Regular.woff2?url";
import Phaser from "phaser";
import { audio } from "./game/audio";
import { hydrateSettings } from "./game/storage";
import { GAME_HEIGHT, GAME_WIDTH, GRAVITY } from "./game/constants";
import { live } from "./game/live";
import { BootScene } from "./game/scenes/BootScene";
import { EventScene } from "./game/scenes/EventScene";
import { GameScene } from "./game/scenes/GameScene";
import { MapScene } from "./game/scenes/MapScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { RestScene } from "./game/scenes/RestScene";
import { SettingsScene } from "./game/scenes/SettingsScene";
import { RunShopScene } from "./game/scenes/RunShopScene";
import { ShopScene } from "./game/scenes/ShopScene";
import { SummaryScene } from "./game/scenes/SummaryScene";
import { TutorialScene } from "./game/scenes/TutorialScene";
import { UpgradeScene } from "./game/scenes/UpgradeScene";

async function loadFont(): Promise<void> {
  try {
    const face = new FontFace("ZCOOL KuaiLe", `url(${fontUrl})`);
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    console.warn("字体加载失败，改用系统字体", err);
  }
}

async function main(): Promise<void> {
  hydrateSettings();
  await loadFont();
  const unlock = () => audio.unlock();
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#07060c",
    pixelArt: true,
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: GRAVITY }, debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    input: { keyboard: true },
    scene: [BootScene, MenuScene, SettingsScene, TutorialScene, ShopScene, MapScene, GameScene, UpgradeScene, RunShopScene, EventScene, RestScene, SummaryScene],
  });
  window.__jintu = { get: () => live, game };
}

void main();
