import Phaser from "phaser";
import { audio } from "../audio";
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, STAGE_LOOK, TUNING, rectsOverlap } from "../constants";
import { Enemy } from "../entities/enemy";
import { Player } from "../entities/player";
import { spawnAfterimage, spawnDust, spawnSlash, spawnSpark, floatText } from "../fx";
import { Hud } from "../hud";
import { buildLevel } from "../levels";
import { publish } from "../live";
import { getRun, type RunState } from "../run";
import { defaultMods, enemyStats, grantGold, modsFrom, UPGRADES } from "../upgrades";
import { TouchControls } from "../touch";
import type { BufferName, EndMode, InputState, LevelData, ShotSpec, Solid, SpawnDef, WorldApi } from "../types";
import { FONT, justDown } from "../ui";

interface Keys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  light: Phaser.Input.Keyboard.Key;
  heavy: Phaser.Input.Keyboard.Key;
  dodge: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
  esc: Phaser.Input.Keyboard.Key;
  shift: Phaser.Input.Keyboard.Key;
  enter: Phaser.Input.Keyboard.Key;
  mute: Phaser.Input.Keyboard.Key;
}

interface Trigger {
  x: number;
  spawns: SpawnDef[];
  fired: boolean;
}

interface LiveShot extends ShotSpec {
  seen: Set<string>;
  image: Phaser.GameObjects.Image;
  alive: boolean;
}

export class GameScene extends Phaser.Scene implements WorldApi {
  readonly focus = { x: 0, y: 0 };
  readonly groundY = GROUND_Y;
  private run!: RunState;
  private level!: LevelData;
  private player!: Player;
  private enemies: Enemy[] = [];
  private shots: LiveShot[] = [];
  private triggers: Trigger[] = [];
  private solidsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private keys!: Keys;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private inputState: InputState = { left: false, right: false, jumpHeld: false, buffer: null, bufferT: 0 };
  private touch!: TouchControls;
  private hud!: Hud;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private shadows!: Phaser.GameObjects.Graphics;
  private vignette!: Phaser.GameObjects.Graphics;
  private portal!: Phaser.GameObjects.Sprite;
  private portalLabel!: Phaser.GameObjects.Text;
  private pauseLayer!: Phaser.GameObjects.Container;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseItems: Phaser.GameObjects.Text[] = [];
  private lanterns: Phaser.GameObjects.Sprite[] = [];
  private paused = false;
  private pauseIndex = 0;
  private leaving = false;
  private freeze = 0;
  private portalReady = false;
  private bossDown = false;
  private downT = 0;
  private winT = 0;
  private elapsed = 0;
  private combo = 0;
  private comboT = 0;
  private mods = defaultMods();
  private debugOn = false;
  private debugDom: HTMLDivElement | null = null;
  private volumeLabel!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  get solids(): Solid[] {
    return this.level.solids;
  }

  footing(x: number): boolean {
    return this.level.solids.some((solid) => x >= solid.x && x <= solid.x + solid.w);
  }

  create(): void {
    const run = getRun();
    if (!run) {
      this.scene.start("menu");
      return;
    }
    this.run = run;
    this.mods = modsFrom(run);
    this.level = buildLevel(run.stage, run.seed);
    this.enemies = [];
    this.shots = [];
    this.lanterns = [];
    this.paused = false;
    this.leaving = false;
    this.freeze = 0;
    this.bossDown = false;
    this.downT = 0;
    this.winT = 0;
    this.elapsed = 0;
    this.combo = 0;
    this.comboT = 0;
    this.portalReady = false;
    this.debugOn = new URLSearchParams(window.location.search).has("debug");
    audio.startMusic(run.stage);
    const look = STAGE_LOOK[run.stage];

    this.cameras.main.fadeIn(180, 7, 6, 12);
    this.cameras.main.setBounds(0, 0, this.level.width, GAME_HEIGHT);
    this.physics.world.setBounds(0, -500, this.level.width, 1400);
    this.add.image(0, 0, `sky-${run.stage}`).setOrigin(0).setScrollFactor(0).setDepth(0);
    this.far = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, `far-${run.stage}`).setOrigin(0).setScrollFactor(0).setDepth(1);
    this.mid = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, `mid-${run.stage}`).setOrigin(0).setScrollFactor(0).setDepth(2);
    this.shadows = this.add.graphics().setDepth(7);
    this.add.rectangle(this.level.width / 2, GROUND_Y + 8, this.level.width, 80, look.fog, 0.16).setDepth(6);

    this.solidsGroup = this.physics.add.staticGroup();
    for (const solid of this.level.solids) {
      const wall = solid.top < GROUND_Y - 100;
      const height = wall ? Math.max(24, 760 - solid.top) : 40;
      const cx = solid.x + solid.w / 2;
      const fill = this.add.tileSprite(cx, solid.top + (GAME_HEIGHT + 30 - solid.top) / 2, solid.w, GAME_HEIGHT + 30 - solid.top, `ground-fill-${run.stage}`).setDepth(4);
      const lip = this.add.tileSprite(cx, solid.top + 9, solid.w, 18, `ground-top-${run.stage}`).setDepth(5);
      if (solid.trench) {
        fill.setTint(0x8a7d72);
        lip.setTint(0xb3a292);
      }
      const block = this.solidsGroup.create(cx, solid.top + height / 2, "px") as Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
      block.setVisible(false);
      block.setDisplaySize(Math.max(4, solid.w), height);
      block.refreshBody();
    }
    const catchTop = GROUND_Y + 86;
    const catchBlock = this.solidsGroup.create(this.level.width / 2, catchTop + 40, "px") as Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
    catchBlock.setVisible(false);
    catchBlock.setDisplaySize(this.level.width + 120, 80);
    catchBlock.refreshBody();

    for (const decor of this.level.decors) {
      if (decor.kind === "lantern") {
        const lamp = this.add.sprite(decor.x, decor.y, "lantern", 0).setOrigin(0.5, 1).setDepth(6);
        this.lanterns.push(lamp);
      } else {
        this.add.image(decor.x, decor.y, decor.kind).setOrigin(0.5, 1).setDepth(6);
      }
    }

    this.portal = this.add.sprite(this.level.portalX, GROUND_Y, "portal", 0).setOrigin(0.5, 1).setDepth(8).setAlpha(0.35);
    this.portalLabel = this.add
      .text(this.level.portalX, GROUND_Y - 130, "出口", {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#f6edd8",
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setVisible(false);

    this.player = new Player(this, 150, GROUND_Y - 8, run.hp, run.maxHp, this.mods, this);
    this.physics.add.collider(this.player, this.solidsGroup);
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.triggers = this.level.triggers.map((trigger) => ({ ...trigger, spawns: trigger.spawns.map((spawn) => ({ ...spawn })), fired: false }));

    this.hud = new Hud(this);
    this.volumeLabel = this.add
      .text(GAME_WIDTH - 24, 112, "", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#f3e2b0",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(250)
      .setAlpha(0);
    this.vignette = this.add.graphics().setScrollFactor(0).setDepth(180);
    this.touch = new TouchControls(this, (name) => {
      if (!this.paused && !this.leaving) this.setBuffer(name);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.leaving || !this.player || this.player.dead || pointer.y > 400) return;
      this.player.facing = pointer.worldX >= this.player.x ? 1 : -1;
      this.setBuffer("light");
    });
    this.buildPause();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      light: Phaser.Input.Keyboard.KeyCodes.J,
      heavy: Phaser.Input.Keyboard.KeyCodes.K,
      dodge: Phaser.Input.Keyboard.KeyCodes.L,
      special: Phaser.Input.Keyboard.KeyCodes.U,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      mute: Phaser.Input.Keyboard.KeyCodes.M,
    }) as Keys;
    this.input.keyboard?.addCapture(["SPACE", "UP", "DOWN", "LEFT", "RIGHT"]);

    this.add
      .text(GAME_WIDTH / 2, 150, `${look.label}  ${look.name}`, {
        fontFamily: FONT,
        fontSize: "36px",
        color: "#f6edd4",
        stroke: "#1a1014",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(230)
      .setAlpha(0)
      .setName("banner");
    const banner = this.children.getByName("banner") as Phaser.GameObjects.Text;
    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 220,
      yoyo: true,
      hold: 880,
      onComplete: () => banner.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    if (!this.player) return;
    const real = Math.min(0.05, delta / 1000);
    if (justDown(this.keys.esc) && !this.leaving && !this.player.dead) this.paused = !this.paused;
    if (justDown(this.keys.mute)) this.cycleVolume();
    if (this.leaving) {
      this.publishState();
      return;
    }
    if (this.freeze > 0) {
      this.freeze -= real;
      this.physics.world.pause();
      if (this.freeze > 0) {
        this.publishState();
        return;
      }
    }
    if (this.paused) {
      this.physics.world.pause();
      this.pauseLayer.setVisible(true);
      this.handlePause();
      this.publishState();
      return;
    }
    this.pauseLayer.setVisible(false);
    if (this.physics.world.isPaused) this.physics.world.resume();

    const dt = real;
    this.elapsed += dt;
    this.gather(dt);
    this.focus.x = this.player.x;
    this.focus.y = this.player.y;
    this.player.update(dt, this.inputState);
    for (const enemy of [...this.enemies]) {
      if (enemy.active) enemy.update(dt);
    }
    this.separate(dt);
    this.enemies = this.enemies.filter((enemy) => enemy.active);
    this.resolve();
    this.updateShots(dt);
    this.fireTriggers();
    this.run.hp = Math.max(0, this.player.hp);
    this.dress();
    this.hud.update(this.hudModel());
    if (this.comboT > 0) this.comboT -= dt;
    else this.combo = 0;

    if (this.player.dead) {
      this.downT += dt;
      if (this.downT > 0.9) this.leave("summary", { mode: "dead" satisfies EndMode });
    } else if (this.bossDown) {
      this.winT += dt;
      if (this.winT > 1.15) this.leave("summary", { mode: "win" satisfies EndMode });
    } else if (
      this.portalReady &&
      Math.abs(this.player.x - this.level.portalX) < 46 &&
      this.player.y > GROUND_Y - 120
    ) {
      this.leave("upgrade");
    }
    this.publishState();
  }

  fire(shot: ShotSpec): void {
    const image = this.add.image(shot.x, shot.y, shot.tex).setDepth(15).setFlipX(shot.dir < 0);
    this.shots.push({ ...shot, seen: new Set(), image, alive: true });
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

  banner(title: string, sub: string): void {
    const titleText = this.add
      .text(GAME_WIDTH / 2, 168, title, {
        fontFamily: FONT,
        fontSize: "42px",
        color: "#f6edd4",
        stroke: "#1a1014",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(240)
      .setAlpha(0);
    const subText = this.add
      .text(GAME_WIDTH / 2, 214, sub, {
        fontFamily: FONT,
        fontSize: "20px",
        color: "#f0d0c8",
        stroke: "#1a1014",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(240)
      .setAlpha(0);
    this.tweens.add({
      targets: [titleText, subText],
      alpha: 1,
      duration: 180,
      yoyo: true,
      hold: 980,
      onComplete: () => {
        titleText.destroy();
        subText.destroy();
      },
    });
  }

  float(x: number, y: number, text: string, color: string): void {
    floatText(this, x, y, text, color);
  }

  shake(ms: number, intensity: number): void {
    this.cameras.main.shake(ms, intensity);
  }

  hitStop(ms: number): void {
    this.freeze = Math.max(this.freeze, ms / 1000);
  }

  sfx(name: Parameters<typeof audio.play>[0]): void {
    audio.play(name);
  }

  blame(cause: string): void {
    this.run.downHits += 1;
    this.run.cause = cause;
  }

  onKill(kind: SpawnDef["kind"], x: number, y: number): void {
    const stats = enemyStats(kind, this.run.stage);
    const gained = grantGold(stats.gold, this.mods.gold);
    this.run.goldEarned += gained;
    this.run.kills += 1;
    this.float(x, y - 78, `+${gained}`, "#ffd56a");
    audio.play("coin");
    if (kind === "boss") {
      this.bossDown = true;
      this.cameras.main.flash(200, 255, 236, 210);
      this.shake(150, 0.01);
    }
  }

  afterimage(x: number, y: number, frame: string | number, flip: boolean): void {
    spawnAfterimage(this, x, y, frame, flip);
  }

  private gather(dt: number): void {
    const keys = this.keys;
    this.inputState.left = keys.left.isDown || this.cursors.left.isDown || this.touch.left;
    this.inputState.right = keys.right.isDown || this.cursors.right.isDown || this.touch.right;
    this.inputState.jumpHeld = keys.up.isDown || keys.jump.isDown || this.cursors.up.isDown || this.touch.jump;
    if (justDown(keys.jump) || justDown(keys.up) || justDown(this.cursors.up)) this.setBuffer("jump");
    if (justDown(keys.light)) this.setBuffer("light");
    if (justDown(keys.heavy)) this.setBuffer("heavy");
    if (justDown(keys.dodge) || justDown(keys.shift)) this.setBuffer("dodge");
    if (justDown(keys.special)) this.setBuffer("special");
    if (this.inputState.buffer) {
      this.inputState.bufferT -= dt;
      if (this.inputState.bufferT <= 0) this.inputState.buffer = null;
    }
  }

  private setBuffer(name: BufferName): void {
    this.inputState.buffer = name;
    this.inputState.bufferT = TUNING.buffer;
  }

  private spawn(spawn: SpawnDef): void {
    if (this.leaving) return;
    const enemy = new Enemy(this, spawn.x, spawn.y - 6, spawn.kind, this.run.stage, this);
    this.physics.add.collider(enemy, this.solidsGroup);
    this.enemies.push(enemy);
    this.dust(spawn.x, spawn.y);
    if (spawn.kind === "boss") {
      this.banner("残将", "玄甲");
      audio.play("boss");
      this.shake(200, 0.007);
    }
  }

  private fireTriggers(): void {
    for (const trigger of this.triggers) {
      if (trigger.fired || this.player.x < trigger.x) continue;
      trigger.fired = true;
      for (const spawn of trigger.spawns) {
        this.time.delayedCall(spawn.delay * 1000, () => this.spawn(spawn));
      }
    }
  }

  private resolve(): void {
    const player = this.player;
    const swings: { enemy: Enemy }[] = [];
    if (player.swing && !player.dead) {
      for (const enemy of this.enemies) {
        if (!enemy.active || enemy.dead || player.swing.seen.has(enemy.eid)) continue;
        if (!rectsOverlap(player.swing.rect, enemy.hurtbox())) continue;
        player.swing.seen.add(enemy.eid);
        const crit = Math.random() < player.swing.crit;
        const damage = Math.max(1, Math.round(player.swing.damage * (crit ? 1.75 : 1)));
        const landed = enemy.receive(damage, player.swing.kb, player.swing.stun, player.swing.dir, crit);
        if (landed) {
          if (player.swing.lifesteal > 0) player.heal(damage * player.swing.lifesteal);
          const weight = (player.swing.kind === "heavy" ? 0.85 : player.swing.kind === "special" ? 0.7 : 0.38) + (crit ? 0.18 : 0);
          this.hitStop(Math.round(18 + weight * 64));
          this.shake(Math.round(48 + weight * 80), 0.0022 + weight * 0.006);
          this.noteCombo();
        }
      }
    }
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.dead || !enemy.swing || enemy.swing.seen.has("player") || player.dead) continue;
      if (!rectsOverlap(enemy.swing.rect, player.hurtbox())) continue;
      swings.push({ enemy });
    }
    for (const { enemy } of swings) {
      if (!enemy.swing) continue;
      enemy.swing.seen.add("player");
      player.hurt(enemy.swing.damage, enemy.swing.kb, enemy.swing.stun, enemy.x, "近战");
    }
  }

  private updateShots(dt: number): void {
    for (const shot of this.shots) {
      if (!shot.alive) continue;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      shot.image.setPosition(shot.x, shot.y);
      if (shot.life <= 0 || shot.x < -80 || shot.x > this.level.width + 80) {
        shot.alive = false;
        continue;
      }
      if (!shot.ignoreSolid && this.hitsSolid(shot.x, shot.y)) {
        shot.alive = false;
        continue;
      }
      if (shot.fromPlayer) {
        for (const enemy of this.enemies) {
          if (!enemy.active || enemy.dead || shot.seen.has(enemy.eid)) continue;
          if (!rectsOverlap(shot, enemy.hurtbox())) continue;
          shot.seen.add(enemy.eid);
          const crit = Math.random() < shot.crit;
          const damage = Math.max(1, Math.round(shot.damage * (crit ? 1.75 : 1)));
          const landed = enemy.receive(damage, shot.kb, shot.stun, shot.dir, crit);
          if (landed) {
            if (shot.lifesteal > 0) this.player.heal(damage * shot.lifesteal);
            this.hitStop(crit ? 36 : 20);
            this.shake(46, crit ? 0.0045 : 0.0028);
          }
          this.spark(shot.x, shot.y, 0xbfefff, crit ? 10 : 6);
          shot.alive = false;
          break;
        }
      } else if (!this.player.dead && !shot.seen.has("player") && rectsOverlap(shot, this.player.hurtbox())) {
        shot.seen.add("player");
        this.player.hurt(shot.damage, shot.kb, shot.stun, shot.x, "箭矢");
        shot.alive = false;
      }
    }
    this.shots = this.shots.filter((shot) => {
      if (shot.alive) return true;
      shot.image.destroy();
      return false;
    });
  }

  private hitsSolid(x: number, y: number): boolean {
    return this.level.solids.some((solid) => x >= solid.x && x <= solid.x + solid.w && y >= solid.top);
  }

  private separate(dt: number): void {
    for (let i = 0; i < this.enemies.length; i += 1) {
      for (let j = i + 1; j < this.enemies.length; j += 1) {
        const a = this.enemies[i];
        const b = this.enemies[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x;
        if (Math.abs(dx) < 34 && Math.abs(a.y - b.y) < 48) {
          const push = Math.sign(dx || 1) * 70 * dt;
          a.x -= push;
          b.x += push;
        }
      }
    }
  }

  private noteCombo(): void {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 1.15;
  }

  private dress(): void {
    const scroll = this.cameras.main.scrollX;
    this.far.tilePositionX = scroll * 0.22;
    this.mid.tilePositionX = scroll * 0.48;
    for (const lamp of this.lanterns) lamp.setFrame(Math.floor(this.elapsed * 6) % 2);
    this.portal.setFrame(Math.floor(this.elapsed * 7) % 4);
    const alive = this.enemies.some((enemy) => !enemy.dead);
    const waiting = this.triggers.some((trigger) => !trigger.fired);
    this.portalReady = !this.level.boss && !waiting && !alive;
    this.portal.setAlpha(this.portalReady ? 1 : 0.3);
    this.portalLabel.setVisible(this.portalReady);
    this.shadows.clear();
    this.shadows.fillStyle(0x000000, 0.28);
    const stamp = (x: number, y: number, w: number, grounded: boolean) => {
      if (grounded) this.shadows.fillEllipse(x, y + 2, w, 12);
    };
    stamp(this.player.x, this.player.y, 46, this.player.grounded);
    for (const enemy of this.enemies) {
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      stamp(enemy.x, enemy.y, enemy.kind === "brute" || enemy.kind === "boss" ? 70 : 42, body.blocked.down);
    }
    this.vignette.clear();
    if (this.player.hp / this.player.maxHp < 0.3 && !this.player.dead) {
      const alpha = 0.12 + Math.sin(this.elapsed * 6) * 0.05;
      this.vignette.fillStyle(0x6e1020, alpha);
      this.vignette.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    if (this.debugOn) {
      this.drawDebug();
      this.writeDebug();
    }
  }

  private writeDebug(): void {
    if (!this.debugDom) {
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;left:8px;top:8px;z-index:80;color:#fff;background:#000a;font:16px monospace;padding:6px;pointer-events:none";
      document.body.appendChild(el);
      this.debugDom = el;
    }
    const foe = this.enemies.find((enemy) => enemy.active && !enemy.dead);
    const gap = foe ? Math.round(foe.x - this.player.x) : 0;
    this.debugDom.textContent = `hp ${Math.round(this.player.hp)} ${this.player.action} face ${this.player.facing} foe ${foe ? `${foe.kind} ${Math.round(foe.hp)} gap ${gap}` : "-"} keys ${this.inputState.left ? "L" : ""}${this.inputState.right ? "R" : ""} buf ${this.inputState.buffer ?? "-"}`;
  }

  private drawDebug(): void {
    this.vignette.lineStyle(1, 0x66ff99, 0.9);
    const cam = this.cameras.main;
    const box = (rect: { x: number; y: number; w: number; h: number }) => {
      this.vignette.strokeRect(rect.x - rect.w / 2 - cam.scrollX, rect.y - rect.h / 2 - cam.scrollY, rect.w, rect.h);
    };
    box(this.player.hurtbox());
    if (this.player.swing) box(this.player.swing.rect);
    for (const enemy of this.enemies) {
      box(enemy.hurtbox());
      if (enemy.swing) box(enemy.swing.rect);
    }
  }

  private hudModel() {
    const look = STAGE_LOOK[this.run.stage];
    const boss = this.enemies.find((enemy) => enemy.kind === "boss" && !enemy.dead);
    const names = this.run.upgrades.slice(-4).map((id) => UPGRADES[id].name);
    let objective = "击败沿途敌人";
    if (boss) objective = "击败残将";
    else if (this.portalReady) objective = "前往出口";
    const hintWindow = 5.4;
    const hint = this.run.stage === 1 && this.elapsed < hintWindow ? "轻 J · 重 K · 闪 L · 奥 U" : "";
    const hintAlpha = this.elapsed < 2.4 ? 0.9 : Math.max(0, 0.9 * (1 - (this.elapsed - 2.4) / (hintWindow - 2.4)));
    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      gold: this.run.goldEarned,
      stageLabel: look.label,
      stageName: look.name,
      special: this.player.specialReady(),
      charges: this.player.charges,
      maxCharges: this.player.maxCharges,
      charge: this.player.chargeRatio(),
      objective,
      hint,
      hintAlpha,
      combo: this.comboT > 0 ? this.combo : 0,
      upgrades: names.join("  "),
      boss: boss ? { hp: boss.hp, max: boss.maxHp, rage: boss.raging } : undefined,
    };
  }

  private buildPause(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x0c0a10, 0.72);
    gfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    gfx.fillStyle(0x161018, 0.95);
    gfx.fillRoundedRect(330, 150, 300, 230, 12);
    gfx.lineStyle(2, 0xe2c27a, 1);
    gfx.strokeRoundedRect(330, 150, 300, 230, 12);
    this.pauseTitle = this.add
      .text(480, 190, "暂停", { fontFamily: FONT, fontSize: "36px", color: "#f6edd4" })
      .setOrigin(0.5);
    this.pauseItems = [
      this.add.text(480, 260, "继续", { fontFamily: FONT, fontSize: "26px", color: "#f6edd8" }).setOrigin(0.5),
      this.add.text(480, 320, "放弃征途", { fontFamily: FONT, fontSize: "26px", color: "#f6edd8" }).setOrigin(0.5),
    ];
    const zones = [260, 320].map((y, index) => {
      const zone = this.add.zone(480, y, 220, 44).setInteractive();
      zone.on("pointerdown", () => {
        this.pauseIndex = index;
        this.confirmPause();
      });
      return zone;
    });
    this.pauseLayer = this.add.container(0, 0, [gfx, this.pauseTitle, ...this.pauseItems, ...zones]).setScrollFactor(0).setDepth(400).setVisible(false);
  }

  private handlePause(): void {
    if (justDown(this.keys.up) || justDown(this.cursors.up)) this.pauseIndex = 0;
    if (justDown(this.keys.down) || justDown(this.cursors.down)) this.pauseIndex = 1;
    this.pauseItems.forEach((text, index) => text.setColor(index === this.pauseIndex ? "#ffe08a" : "#f6edd8"));
    if (justDown(this.keys.enter) || justDown(this.keys.light)) this.confirmPause();
  }

  private confirmPause(): void {
    if (this.pauseIndex === 0) this.paused = false;
    else this.leave("summary", { mode: "quit" satisfies EndMode });
  }

  private cycleVolume(): void {
    audio.cycleVolume();
    this.volumeLabel.setText(`音量 ${audio.volumeName()}`);
    this.volumeLabel.setAlpha(1);
    this.tweens.killTweensOf(this.volumeLabel);
    this.tweens.add({ targets: this.volumeLabel, alpha: 0, delay: 700, duration: 420 });
  }

  private leave(target: string, data?: object): void {
    if (this.leaving) return;
    this.leaving = true;
    this.debugDom?.remove();
    this.debugDom = null;
    this.run.hp = Math.max(0, this.player.hp);
    this.physics.world.pause();
    this.cameras.main.fadeOut(180, 7, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target, data);
    });
  }

  private publishState(): void {
    publish("game", {
      stage: this.run.stage,
      hp: Math.round(this.player.hp),
      maxHp: this.player.maxHp,
      gold: this.run.goldEarned,
      kills: this.run.kills,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facing: this.player.facing,
      action: this.player.action,
      vx: Math.round((this.player.body as Phaser.Physics.Arcade.Body).velocity.x),
      grounded: this.player.grounded,
      blocked: this.player.blockedX,
      left: this.inputState.left,
      right: this.inputState.right,
      width: this.level.width,
      nextTrigger: this.triggers.find((trigger) => !trigger.fired)?.x ?? null,
      portal: this.portalReady,
      paused: this.paused,
      specialReady: this.player.specialReady() >= 1,
      objective: this.portalReady ? "exit" : "fight",
      enemies: this.enemies
        .filter((enemy) => enemy.active)
        .map((enemy) => ({
          kind: enemy.kind,
          hp: Math.max(0, Math.round(enemy.hp)),
          x: Math.round(enemy.x),
          y: Math.round(enemy.y),
          telegraph: enemy.telegraph,
          dead: enemy.dead,
        })),
    });
  }
}
