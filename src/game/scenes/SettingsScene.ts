import Phaser from "phaser";
import { audio } from "../audio";
import { GROUND_Y } from "../constants";
import { bindFromEvent, defaultKeybinds, keyLabel } from "../keys";
import { publish } from "../live";
import {
  loadSave,
  resetProgress,
  setShakeEnabled,
  setTouchPref,
  writeSave,
  type Keybinds,
  type TouchPref,
} from "../storage";
import { cycleTouchPref, touchPrefLabel } from "../touch";
import { FONT, justDown, label, paintPanel } from "../ui";

const ACTIONS: { id: keyof Keybinds; title: string }[] = [
  { id: "left", title: "左移" },
  { id: "right", title: "右移" },
  { id: "jump", title: "跳跃" },
  { id: "light", title: "轻击" },
  { id: "heavy", title: "重击" },
  { id: "dodge", title: "闪避" },
  { id: "special", title: "奥义" },
];

const MAIN = ["music", "sfx", "shake", "touch", "keys", "reset", "tutorial", "back"] as const;
const TOUCH_ORDER: TouchPref[] = ["auto", "on", "off"];

type Mode = "main" | "keys" | "reset";

export class SettingsScene extends Phaser.Scene {
  private mode: Mode = "main";
  private index = 0;
  private busy = false;
  private armed = false;
  private eat = false;
  private note = "";
  private binds: Keybinds = defaultKeybinds();
  private rows: Phaser.GameObjects.Text[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private bar!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super("settings");
  }

  create(): void {
    this.mode = "main";
    this.index = 0;
    this.busy = false;
    this.armed = false;
    this.eat = false;
    this.note = "";
    this.binds = { ...loadSave().keys };
    audio.startMusic(0);
    this.cameras.main.fadeIn(160, 7, 6, 12);
    this.add.image(0, 0, "sky-1").setOrigin(0);
    this.add.tileSprite(0, 0, 960, 540, "far-1").setOrigin(0);
    this.add.tileSprite(480, GROUND_Y + 64, 960, 160, "ground-fill-1");
    this.add.tileSprite(480, GROUND_Y + 9, 960, 18, "ground-top-1");
    this.add.rectangle(480, 270, 960, 540, 0x07060c, 0.45);

    const panel = this.add.graphics();
    paintPanel(panel, 160, 58, 640, 450);
    this.bar = this.add.graphics();
    this.title = this.add
      .text(480, 92, "设置", { fontFamily: FONT, fontSize: "36px", color: "#f6edd4" })
      .setOrigin(0.5);
    this.sub = label(this, 480, 132, "", 16, "#d9cbb0");
    this.rows = Array.from({ length: 9 }, (_, i) =>
      this.add
        .text(480, 168 + i * 36, "", { fontFamily: FONT, fontSize: "22px", color: "#f6edd8" })
        .setOrigin(0.5),
    );
    this.zones = this.rows.map((text, i) => {
      const zone = this.add.zone(480, text.y, 520, 34).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", () => {
        if (this.busy || i >= this.lineCount()) return;
        this.index = i;
        this.activate();
      });
      return zone;
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,S,A,D,ENTER,J,ESC,SPACE,M") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["UP", "DOWN", "LEFT", "RIGHT", "SPACE"]);
    window.addEventListener("keydown", this.onDomKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener("keydown", this.onDomKey));
    this.refresh();
  }

  update(): void {
    if (this.busy) return;
    if (this.eat) {
      this.eat = false;
      this.refresh();
      return;
    }
    const n = this.lineCount();
    if (justDown(this.cursors.up) || justDown(this.keys.W)) this.index = (this.index + n - 1) % n;
    if (justDown(this.cursors.down) || justDown(this.keys.S)) this.index = (this.index + 1) % n;
    if (this.mode === "main" && (justDown(this.cursors.left) || justDown(this.keys.A))) this.nudge(-1);
    if (this.mode === "main" && (justDown(this.cursors.right) || justDown(this.keys.D))) this.nudge(1);
    if (justDown(this.keys.M) && this.mode === "main") audio.cycleSfx();
    if (justDown(this.keys.ESC)) this.onEsc();
    else if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE) || justDown(this.keys.J)) this.activate();
    this.refresh();
  }

  private onDomKey = (event: KeyboardEvent): void => {
    if (this.mode !== "keys" || !this.armed || this.busy) return;
    this.eat = true;
    event.preventDefault();
    if (event.code === "Escape") {
      this.armed = false;
      this.note = "已取消";
      return;
    }
    const name = bindFromEvent(event);
    const action = ACTIONS[this.index];
    if (!name || !action) {
      this.note = event.code === "KeyM" ? "M 留作音效切换" : "这个键不能用";
      return;
    }
    const taken = (Object.keys(this.binds) as (keyof Keybinds)[]).some((id) => id !== action.id && this.binds[id] === name);
    if (taken) {
      this.note = "这个键已经绑过了";
      return;
    }
    this.binds[action.id] = name;
    const save = loadSave();
    save.keys = { ...this.binds };
    writeSave(save);
    this.armed = false;
    this.note = `${action.title} 改为 ${keyLabel(name)}`;
  };

  private lineCount(): number {
    if (this.mode === "reset") return 2;
    if (this.mode === "keys") return ACTIONS.length + 2;
    return MAIN.length;
  }

  private lines(): string[] {
    if (this.mode === "reset") return ["确认清空", "取消"];
    if (this.mode === "keys") {
      return [
        ...ACTIONS.map((action, i) => {
          const value = this.armed && i === this.index ? "按下新键…" : keyLabel(this.binds[action.id]);
          return `${action.title}    ${value}`;
        }),
        "恢复默认",
        "返回",
      ];
    }
    const save = loadSave();
    return [
      `音乐    ${audio.musicName()}`,
      `音效    ${audio.sfxName()}`,
      `屏幕震动    ${save.shake ? "开" : "关"}`,
      `触屏按键    ${touchPrefLabel()}`,
      "按键设置",
      "重置存档",
      "再看教学",
      "返回标题",
    ];
  }

  private refresh(): void {
    const lines = this.lines();
    const titles: Record<Mode, string> = { main: "设置", keys: "按键", reset: "重置存档" };
    this.title.setText(titles[this.mode]);
    const save = loadSave();
    const fallback =
      this.mode === "reset"
        ? "清空金币、强化、战绩和教学进度。音量和按键会留下。"
        : this.mode === "keys"
          ? "选中一项后按 Enter，再按下新键。Esc 返回。"
          : `行囊 ${save.gold} 金    左右调整，Enter 确认`;
    this.sub.setText(this.note || fallback);
    this.bar.clear();
    if (this.index < lines.length) {
      this.bar.fillStyle(0x6a4a28, 0.95);
      this.bar.fillRect(210, 168 + this.index * 36 - 16, 540, 32);
    }
    this.rows.forEach((text, i) => {
      const line = lines[i];
      text.setVisible(!!line);
      this.zones[i].setVisible(!!line);
      if (!line) return;
      text.setText(line);
      text.setColor(i === this.index ? "#ffe08a" : "#f6edd8");
    });
    publish("settings", {
      mode: this.mode,
      index: this.index,
      music: save.music,
      sfx: save.sfx,
      shake: save.shake,
      touch: save.touch,
      tutorialDone: save.tutorialDone,
      gold: save.gold,
      keys: { ...save.keys },
      armed: this.armed,
    });
  }

  private nudge(dir: number): void {
    if (this.mode !== "main") return;
    const row = MAIN[this.index];
    const save = loadSave();
    if (row === "music") audio.setMusic((save.music + dir + 4) % 4);
    else if (row === "sfx") audio.setSfx((save.sfx + dir + 4) % 4);
    else if (row === "shake") {
      setShakeEnabled(dir > 0);
      audio.play("ui");
    } else if (row === "touch") {
      const at = TOUCH_ORDER.indexOf(save.touch);
      setTouchPref(TOUCH_ORDER[(at + dir + TOUCH_ORDER.length) % TOUCH_ORDER.length] ?? "auto");
      audio.play("ui");
    }
  }

  private activate(): void {
    if (this.mode === "reset") {
      if (this.index === 0) {
        resetProgress();
        audio.play("ui");
        this.note = "存档已清空";
      } else this.note = "";
      this.mode = "main";
      this.index = 5;
      return;
    }
    if (this.mode === "keys") {
      if (this.index < ACTIONS.length) {
        this.armed = true;
        this.note = "按下要绑定的键，Esc 取消";
      } else if (this.index === ACTIONS.length) {
        this.binds = defaultKeybinds();
        const save = loadSave();
        save.keys = { ...this.binds };
        writeSave(save);
        this.armed = false;
        this.note = "已恢复默认按键";
      } else {
        this.mode = "main";
        this.index = 4;
        this.note = "";
      }
      return;
    }
    const row = MAIN[this.index];
    const save = loadSave();
    if (row === "music") audio.setMusic((save.music + 1) % 4);
    else if (row === "sfx") audio.setSfx((save.sfx + 1) % 4);
    else if (row === "shake") {
      setShakeEnabled(!save.shake);
      audio.play("ui");
    } else if (row === "touch") {
      cycleTouchPref();
      audio.play("ui");
    }
    else if (row === "keys") {
      this.mode = "keys";
      this.index = 0;
      this.armed = false;
      this.binds = { ...loadSave().keys };
      this.note = "";
    } else if (row === "reset") {
      this.mode = "reset";
      this.index = 0;
      this.note = "";
    } else if (row === "tutorial") this.go("tutorial", { then: "menu" });
    else this.go("menu");
  }

  private onEsc(): void {
    if (this.mode === "keys") {
      this.armed = false;
      this.mode = "main";
      this.index = 4;
      this.note = "";
      return;
    }
    if (this.mode === "reset") {
      this.mode = "main";
      this.index = 5;
      this.note = "";
      return;
    }
    this.go("menu");
  }

  private go(target: string, data?: object): void {
    if (this.busy) return;
    this.busy = true;
    audio.play("ui");
    this.cameras.main.fadeOut(150, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target, data);
    });
  }
}
