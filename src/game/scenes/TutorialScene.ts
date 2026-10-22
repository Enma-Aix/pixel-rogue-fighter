import Phaser from "phaser";
import { audio } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, rectsOverlap } from "../constants";
import { Enemy } from "../entities/enemy";
import { Player } from "../entities/player";
import { floatText, spawnAfterimage, spawnDust, spawnSlash, spawnSpark } from "../fx";
import { bindCombatKeys, gatherCombat, keyLabel, type CombatKeys } from "../keys";
import { publish } from "../live";
import { beginRun } from "../run";
import { loadSave, markTutorialDone, screenShakeEnabled, type Keybinds } from "../storage";
import { TouchControls } from "../touch";
import type { InputState, ShotSpec, Solid, WorldApi } from "../types";
import { defaultMods } from "../upgrades";
import { GameButton, justDown, label } from "../ui";

interface Lesson {
  title: string;
  body: string;
}

interface LiveShot extends ShotSpec {
  image: Phaser.GameObjects.Image;
  alive: boolean;
  seen: boolean;
}

function lesson(keys: Keybinds): Lesson[] {
  const light = keyLabel(keys.light);
  const heavy = keyLabel(keys.heavy);
  return [
    { title: "向右走", body: `按 ${keyLabel(keys.right)} 或 →，也可以按「右」` },
    { title: "轻击", body: `靠近木人，按 ${light}，或点击木人` },
    { title: "连招", body: `站在地上，连续按 ${light}、${light}、${heavy}` },
    { title: "闪避", body: `按 ${keyLabel(keys.dodge)} 或 Shift，也可以按「闪」` },
    { title: "奥义", body: `按 ${keyLabel(keys.special)} 或「奥」` },
  ];
}

export class TutorialScene extends Phaser.Scene implements WorldApi {
  readonly focus = { x: 0, y: 0 };
  readonly groundY = GROUND_Y;
  private readonly floor: Solid[] = [{ x: 0, w: GAME_WIDTH, top: GROUND_Y }];
  private then: "map" | "menu" = "map";
  private player!: Player;
  private dummy!: Enemy;
  private keys!: CombatKeys;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private touch!: TouchControls;
  private inputState: InputState = { left: false, right: false, jumpHeld: false, buffer: null, bufferT: 0 };
  private shots: LiveShot[] = [];
  private steps: Lesson[] = [];
  private step = 0;
  private seenHits = 0;
  private chain: string[] = [];
  private chainT = 0;
  private celebrate = 0;
  private freeze = 0;
  private leaving = false;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private cardTitle!: Phaser.GameObjects.Text;
  private cardBody!: Phaser.GameObjects.Text;
  private cardStep!: Phaser.GameObjects.Text;
  private nameTag!: Phaser.GameObjects.Text;
  private timeOn = 0;

  constructor() {
    super("tutorial");
  }

  init(data: { then?: "map" | "menu" }): void {
    this.then = data?.then === "menu" ? "menu" : "map";
  }

  get solids(): Solid[] {
    return this.floor;
  }

  footing(x: number): boolean {
    return x >= 0 && x <= GAME_WIDTH;
  }

  create(): void {
    this.leaving = false;
    this.step = 0;
    this.seenHits = 0;
    this.chain = [];
    this.chainT = 0;
    this.celebrate = 0;
    this.freeze = 0;
    this.timeOn = 0;
    this.shots = [];
    this.inputState = { left: false, right: false, jumpHeld: false, buffer: null, bufferT: 0 };
    this.steps = lesson(loadSave().keys);
    if (this.physics.world.isPaused) this.physics.world.resume();
    audio.startMusic(1);
    this.cameras.main.fadeIn(180, 7, 6, 12);
    this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.physics.world.setBounds(36, -400, GAME_WIDTH - 72, 1100);

    this.add.image(0, 0, "sky-1").setOrigin(0);
    this.far = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "far-1").setOrigin(0);
    this.mid = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "mid-1").setOrigin(0);
    this.add.tileSprite(480, GROUND_Y + 64, GAME_WIDTH, 160, "ground-fill-1");
    this.add.tileSprite(480, GROUND_Y + 9, GAME_WIDTH, 18, "ground-top-1");
    this.add.sprite(90, GROUND_Y, "lantern", 0).setOrigin(0.5, 1);
    this.add.sprite(870, GROUND_Y, "lantern", 0).setOrigin(0.5, 1);

    const solids = this.physics.add.staticGroup();
    const ground = solids.create(480, GROUND_Y + 20, "px") as Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
    ground.setVisible(false).setDisplaySize(GAME_WIDTH, 40).refreshBody();
    const catcher = solids.create(480, GROUND_Y + 120, "px") as Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
    catcher.setVisible(false).setDisplaySize(GAME_WIDTH + 80, 80).refreshBody();

    this.player = new Player(this, 160, GROUND_Y - 8, 100, 100, defaultMods(), this);
    this.dummy = new Enemy(this, 640, GROUND_Y - 6, "grunt", 1, this, undefined, false, true);
    for (const body of [this.player.body, this.dummy.body]) {
      (body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    }
    this.physics.add.collider(this.player, solids);
    this.physics.add.collider(this.dummy, solids);
    this.nameTag = label(this, this.dummy.x, this.dummy.y - 150, "木人", 18, "#f0d7a4").setDepth(30);

    const card = this.add.graphics().setScrollFactor(0).setDepth(240);
    card.fillStyle(0x120e16, 0.9);
    card.fillRect(250, 18, 460, 92);
    card.lineStyle(2, 0xe2c27a, 1);
    card.strokeRect(250, 18, 460, 92);
    this.cardStep = label(this, 480, 36, "", 14, "#e2c27a").setDepth(241).setScrollFactor(0);
    this.cardTitle = label(this, 480, 62, "", 26, "#f6edd4").setDepth(241).setScrollFactor(0);
    this.cardBody = label(this, 480, 90, "", 16, "#f3e6cc").setDepth(241).setScrollFactor(0);
    new GameButton(this, 868, 40, 140, 42, "跳过", () => this.finish());
    label(this, 868, 74, "Esc", 14, "#cbbfa6").setDepth(30);

    this.touch = new TouchControls(this, (name) => {
      if (!this.leaving) this.setBuffer(name);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.leaving || this.player.dead || pointer.y < 120 || pointer.y > 400) return;
      this.player.facing = pointer.worldX >= this.player.x ? 1 : -1;
      this.setBuffer("light");
    });
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = bindCombatKeys(this);
    this.refreshCard();
  }

  update(_time: number, delta: number): void {
    if (!this.player || this.leaving) return;
    const dt = Math.min(0.05, delta / 1000);
    if (justDown(this.keys.esc)) {
      this.finish();
      return;
    }
    if (this.player.dead) {
      this.scene.restart({ then: this.then });
      return;
    }
    if (this.freeze > 0) {
      this.freeze -= dt;
      this.physics.world.pause();
      if (this.freeze > 0) {
        this.publishState();
        return;
      }
    }
    if (this.physics.world.isPaused) this.physics.world.resume();
    this.timeOn += dt;
    this.far.tilePositionX = this.timeOn * 12;
    this.mid.tilePositionX = this.timeOn * 26;
    gatherCombat(this.keys, this.cursors, this.touch, this.inputState, dt);
    this.focus.x = this.player.x;
    this.focus.y = this.player.y;
    this.player.update(dt, this.inputState);
    if (this.dummy.active) this.dummy.update(dt);
    this.resolve();
    this.updateShots(dt);
    this.nameTag.setPosition(this.dummy.x, this.dummy.y - 148);
    if (this.celebrate > 0) {
      this.celebrate -= dt;
      if (this.celebrate <= 0) this.finish();
    } else {
      this.watch(dt);
    }
    this.refreshCard();
    this.publishState();
  }

  fire(shot: ShotSpec): void {
    const image = this.add.image(shot.x, shot.y, shot.tex).setDepth(15).setFlipX(shot.dir < 0);
    this.shots.push({ ...shot, image, alive: true, seen: false });
  }

  slash(x: number, y: number, dir: number, heavy: boolean): void {
    spawnSlash(this, x, y, dir, heavy);
  }

  dust(x: number, y: number): void {
    spawnDust(this, x, y);
  }

  spark(x: number, y: number, color: number, count = 6): void {
    spawnSpark(this, x, y, color, count);
  }

  float(x: number, y: number, text: string, color: string): void {
    floatText(this, x, y, text, color);
  }

  shake(ms: number, intensity: number): void {
    if (!screenShakeEnabled()) return;
    this.cameras.main.shake(ms, intensity);
  }

  hitStop(ms: number): void {
    this.freeze = Math.max(this.freeze, ms / 1000);
  }

  banner(title: string, sub: string): void {
    this.float(this.player.x, this.player.y - 120, title || sub, "#f6edd4");
  }

  sfx(name: Parameters<typeof audio.play>[0]): void {
    audio.play(name);
  }

  onKill(): void {}

  blame(): void {}

  chipNear(): void {}

  splash(x: number, y: number): void {
    this.spark(x, y, 0xff7a3a, 8);
  }

  spawnMinion(): void {}

  afterimage(x: number, y: number, frame: string | number, flip: boolean): void {
    spawnAfterimage(this, x, y, frame, flip);
  }

  private watch(dt: number): void {
    if (this.chainT > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) this.chain = [];
    }
    if (this.step === 0 && this.player.x >= 300) {
      this.advance();
      return;
    }
    if (this.dummy.hits !== this.seenHits) {
      const tag = this.dummy.lastTag;
      this.seenHits = this.dummy.hits;
      if (this.step === 1 && tag === "light") this.advance();
      else if (this.step === 2) {
        this.chain.push(tag);
        this.chainT = 1.8;
        if (this.chain.slice(-3).join(",") === "light,light,heavy") this.advance();
      }
    }
    if (this.step === 3 && this.player.action === "dodge") this.advance();
    if (this.step === 4 && this.player.action === "special") this.advance();
  }

  private advance(): void {
    if (this.step >= this.steps.length || this.celebrate > 0) return;
    this.step += 1;
    this.chain = [];
    audio.play("ui");
    if (this.step >= this.steps.length) this.celebrate = 0.85;
  }

  private refreshCard(): void {
    const done = this.step >= this.steps.length;
    const current = this.steps[Math.min(this.step, this.steps.length - 1)];
    this.cardStep.setText(done ? "教学完成" : `教学  ${this.step + 1} / ${this.steps.length}`);
    this.cardTitle.setText(done ? "可以上路了" : current.title);
    this.cardBody.setText(done ? "这一局的岔路就在前面" : current.body);
  }

  private resolve(): void {
    const swing = this.player.swing;
    if (!swing || !this.dummy.active || this.dummy.dead || swing.seen.has(this.dummy.eid)) return;
    if (!rectsOverlap(swing.rect, this.dummy.hurtbox())) return;
    swing.seen.add(this.dummy.eid);
    const landed = this.dummy.receive(swing.damage, swing.kb, swing.stun, swing.dir, false, swing.kind === "heavy" ? "heavy" : "light");
    if (!landed) return;
    this.hitStop(swing.kind === "heavy" ? 48 : 28);
    this.shake(swing.kind === "heavy" ? 90 : 50, swing.kind === "heavy" ? 0.006 : 0.003);
  }

  private updateShots(dt: number): void {
    for (const shot of this.shots) {
      if (!shot.alive) continue;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      shot.image.setPosition(shot.x, shot.y);
      if (shot.life <= 0 || shot.x < -40 || shot.x > GAME_WIDTH + 40) {
        shot.alive = false;
        continue;
      }
      if (!shot.seen && this.dummy.active && !this.dummy.dead && rectsOverlap(shot, this.dummy.hurtbox())) {
        shot.seen = true;
        shot.alive = false;
        this.dummy.receive(shot.damage, shot.kb, shot.stun, shot.dir, false, "special");
        this.spark(shot.x, shot.y, 0xbfefff, 8);
      }
    }
    this.shots = this.shots.filter((shot) => {
      if (shot.alive) return true;
      shot.image.destroy();
      return false;
    });
  }

  private setBuffer(name: InputState["buffer"]): void {
    if (!name) return;
    this.inputState.buffer = name;
    this.inputState.bufferT = 0.15;
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    markTutorialDone();
    audio.play("ui");
    if (this.then === "map") beginRun();
    this.cameras.main.fadeOut(160, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(this.then === "map" ? "map" : "menu");
    });
  }

  private publishState(): void {
    const current = this.steps[Math.min(this.step, this.steps.length - 1)];
    publish("tutorial", {
      step: this.step,
      title: this.step >= this.steps.length ? "可以上路了" : current.title,
      x: Math.round(this.player.x),
      action: this.player.action,
      hits: this.dummy.hits,
      done: this.step >= this.steps.length,
      touch: this.touch.left || this.touch.right,
    });
  }
}
