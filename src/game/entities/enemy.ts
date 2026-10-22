import Phaser from "phaser";
import { loopFrame, playFrame } from "../art";
import { BOSS_CARD, isBossKind, type BossCard } from "../bosses";
import { ART, TUNING } from "../constants";
import { stickToSurface, tryStep } from "../step";
import { enemyStats } from "../upgrades";
import type { EliteMod, EnemyKind, Mods, Swing, WorldApi } from "../types";
import { FONT } from "../ui";

interface SwingSpec {
  damage: number;
  kb: number;
  stun: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
}

interface Step {
  op: "wind" | "hold" | "hit" | "shot" | "slam" | "lob" | "dart" | "blink";
  dur: number;
  visual: string;
  vx?: number;
  spec?: SwingSpec;
  chase?: boolean;
}

let seq = 1;

const BODY: Record<EnemyKind, { w: number; h: number }> = {
  grunt: { w: 36, h: 84 },
  archer: { w: 34, h: 80 },
  brute: { w: 58, h: 108 },
  boss: { w: 56, h: 118 },
  shield: { w: 42, h: 90 },
  bomber: { w: 34, h: 80 },
  leaper: { w: 32, h: 78 },
  wisp: { w: 40, h: 92 },
  shade: { w: 34, h: 86 },
};

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly eid: string;
  readonly kind: EnemyKind;
  readonly name: string;
  hp: number;
  maxHp: number;
  facing = -1;
  dead = false;
  swing: Swing | null = null;
  mode: "move" | "wind" | "active" | "recover" | "hurt" = "move";
  private dmg: number;
  private speed: number;
  private timer = 0;
  private cd = 0.4;
  private hurtT = 0;
  private hopCd = 0;
  private animT = 0;
  private flash = 0;
  private awake: number;
  private visual = "idle";
  private visualT = 0;
  private clearSwing = false;
  private didShot = false;
  private script: Step[] = [];
  private step = 0;
  private stepT = 0;
  private announced2 = false;
  private callout = "!";
  private enraged = false;
  private deadT = 0;
  private deathDust = false;
  private guard = 0;
  private leaping = false;
  private leapT = 0;
  private bleed = 0;
  private burn = 0;
  private bleedHit = 2;
  private dotT = 0.4;
  private kindle = false;
  private grace = 0;
  readonly elite: EliteMod | undefined;
  readonly minion: boolean;
  gold: number;
  private armor = 1;
  private liveSpec: SwingSpec | null = null;
  private readonly poise: boolean;
  private readonly markH: number;
  private readonly marker: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: EnemyKind,
    stage: number,
    private world: WorldApi,
    elite?: EliteMod,
    minion = false,
  ) {
    super(scene, x, y, `ch-${kind}`, 0);
    this.kind = kind;
    this.eid = `e${seq++}`;
    const stats = enemyStats(kind, stage);
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.dmg = stats.dmg;
    this.speed = stats.speed;
    this.name = stats.name;
    this.gold = stats.gold;
    this.elite = elite;
    this.minion = minion;
    if (minion) {
      this.hp = 14;
      this.maxHp = 14;
      this.dmg = 5;
      this.speed = 100;
      this.gold = 2;
      this.name = "残片";
      this.grace = 0.45;
    } else if (elite === "armored") {
      this.hp = Math.round(this.hp * 1.55);
      this.maxHp = this.hp;
      this.gold = Math.round(this.gold * 2.1);
      this.armor = 0.72;
      this.name = `甲·${this.name}`;
    } else if (elite === "enraged") {
      this.hp = Math.round(this.hp * 1.15);
      this.maxHp = this.hp;
      this.dmg = Math.round(this.dmg * 1.3);
      this.speed *= 1.35;
      this.gold = Math.round(this.gold * 1.7);
      this.name = `怒·${this.name}`;
    } else if (elite === "split") {
      this.gold = Math.round(this.gold * 1.8);
      this.name = `裂·${this.name}`;
    }
    if (kind === "shield") this.guard = 3;
    this.poise = isBossKind(kind);
    this.awake = isBossKind(kind) ? 1.55 : 0.28;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, ART.footSrc / ART.texH);
    const size = BODY[kind];
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(size.w, size.h);
    body.setOffset((ART.texW - size.w) / 2, ART.footSrc - size.h);
    body.setMaxVelocity(720, 860);
    this.markH = size.h + (isBossKind(kind) ? 52 : 28);
    this.marker = scene.add
      .text(x, y - this.markH, "!", {
        fontFamily: FONT,
        fontSize: isBossKind(kind) ? "32px" : "28px",
        color: "#ffe0e0",
        stroke: "#4a1010",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(40)
      .setVisible(false);
    this.setDepth(10);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 180 });
  }

  get telegraph(): boolean {
    return !this.dead && this.mode === "wind";
  }

  get raging(): boolean {
    return this.enraged;
  }

  get card(): BossCard | null {
    return isBossKind(this.kind) ? BOSS_CARD[this.kind] : null;
  }

  hurtbox(): { x: number; y: number; w: number; h: number } {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return { x: body.center.x, y: body.center.y, w: body.width, h: body.height };
  }

  receive(amount: number, kb: number, stun: number, dir: number, crit: boolean, tag?: "light" | "heavy" | "special"): boolean {
    if (this.dead) return false;
    if (this.hp <= 0) {
      this.finish(dir);
      return true;
    }
    if (this.grace > 0) return false;
    const front = dir === -this.facing;
    if (this.guard > 0 && front && tag !== "heavy" && tag !== "special") {
      this.guard -= 1;
      this.world.float(this.x, this.y - this.markH, this.guard > 0 ? "格挡" : "破盾", "#cfe6ff");
      this.world.sfx("hit");
      this.flash = 0.08;
      return false;
    }
    if (this.guard > 0 && (tag === "heavy" || tag === "special")) {
      this.guard = 0;
      this.world.float(this.x, this.y - this.markH, "破盾", "#ffe08a");
    }
    const dmg = Math.max(1, Math.round(amount * this.armor));
    this.hp -= dmg;
    this.world.float(this.x, this.y - this.markH, crit ? `${dmg}!` : `${dmg}`, crit ? "#ffe08a" : "#fff6ea");
    this.world.spark(this.x + dir * 8, this.y - 58, crit ? 0xffe08a : 0xff8a32, crit ? 12 : 8);
    this.world.sfx(crit ? "slam" : "hit");
    this.flash = crit ? 0.16 : 0.1;
    if (this.hp <= 0) {
      this.finish(dir);
      return true;
    }
    if (this.poise) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      this.setVelocityX(body.velocity.x * 0.35 + dir * kb * 0.12);
      return true;
    }
    this.hurtT = stun;
    this.mode = "hurt";
    this.visual = "hit";
    this.swing = null;
    this.clearSwing = false;
    this.setVelocity(dir * kb, -160);
    return true;
  }

  private finish(dir: number): void {
    if (this.dead) return;
    this.hp = 0;
    this.dead = true;
    this.swing = null;
    this.mode = "hurt";
    this.visual = "dead";
    this.setVelocity(dir * 140, -180);
    this.deadT = 0;
    this.world.sfx("ko");
    const boss = isBossKind(this.kind);
    this.world.spark(this.x, this.y - 48, 0xffb45a, boss ? 18 : 12);
    this.world.dust(this.x - 16, this.y);
    this.world.dust(this.x + 16, this.y);
    this.world.shake(boss ? 220 : 90, boss ? 0.016 : 0.007);
    this.world.hitStop(boss ? 110 : 42);
    if (this.kindle && (this.bleed > 0 || this.burn > 0)) this.world.splash(this.x, this.y - 40, 8 + this.bleed * 3);
    if (this.elite === "split" && !this.minion) {
      this.world.spawnMinion(this.x - 36, this.y);
      this.world.spawnMinion(this.x + 36, this.y);
    }
    this.world.onKill(this.kind, this.x, this.y, this.gold);
  }

  suffer(mods: Mods): void {
    if (this.dead) return;
    if (mods.bleed > 0) {
      this.bleed = Math.min(8, this.bleed + mods.bleed);
      this.bleedHit = 2 + mods.bleedDmg;
    }
    if (mods.burn > 0 && Math.random() < mods.burn) this.burn = Math.min(6, this.burn + 2);
    if (mods.kindle) this.kindle = true;
  }

  chip(amount: number, color = "#ffb0b0"): void {
    if (this.dead || this.hp <= 0 || amount <= 0) return;
    this.hp -= amount;
    this.world.float(this.x, this.y - this.markH, `${Math.round(amount)}`, color);
    if (this.hp <= 0) this.receive(1, 40, 0.1, 1, false);
  }

  update(dt: number): void {
    if (this.clearSwing) {
      this.swing = null;
      this.clearSwing = false;
    }
    this.animT += dt;
    this.hopCd -= dt;
    if (this.grace > 0) this.grace -= dt;
    this.paint();
    this.tickDots(dt);
    if (this.y > 690 && !this.dead) {
      this.receive(9999, 0, 0, this.facing, false, "heavy");
    }
    if (this.dead) {
      this.swing = null;
      this.mode = "hurt";
      this.visual = "dead";
      this.visualT = 1;
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (body.blocked.down) {
        this.setVelocity(0, 0);
        if (!this.deathDust) {
          this.deathDust = true;
          this.world.dust(this.x, this.y);
          this.world.spark(this.x, this.y - 12, 0xd8c4a4, 6);
        }
      }
      this.deadT += dt;
      if (this.deadT > 1.45) {
        this.destroy();
        return;
      }
      this.setAlpha(this.deadT > 1.05 ? Math.max(0, 1 - (this.deadT - 1.05) * 2.5) : 1);
      this.pose();
      return;
    }
    if (this.awake > 0) {
      this.awake -= dt;
      this.setVelocityX(0);
      this.visual = "idle";
      this.pose();
      return;
    }
    if (this.hurtT > 0 && !this.poise) {
      this.hurtT -= dt;
      this.mode = "hurt";
      this.visual = "hit";
      this.visualT = 0;
      this.swing = null;
      this.pose();
      return;
    }
    this.cd -= dt;
    if (isBossKind(this.kind)) this.updateBoss(dt);
    else if (this.kind === "archer") this.updateArcher(dt);
    else if (this.kind === "brute") this.updateBrute(dt);
    else if (this.kind === "bomber") this.updateBomber(dt);
    else if (this.kind === "leaper") this.updateLeaper(dt);
    else this.updateGrunt(dt);
    this.maybeHop();
    if (this.mode === "move") tryStep(this, this.facing, this.world.solids);
    stickToSurface(this, this.world.solids);
    this.pose();
  }

  private updateGrunt(dt: number): void {
    if (this.tickMelee(dt, "attack", 0.12, 0.34, 0.85, {
      damage: this.dmg,
      kb: 150,
      stun: 0.22,
      w: 70,
      h: 44,
      ox: 58,
      oy: -64,
    })) {
      return;
    }
    const dist = this.chase(this.speed, 56);
    this.visual = Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x) > 8 ? "run" : "idle";
    if (dist < 70 && this.cd <= 0 && this.grounded()) this.beginWind(0.28, "attack");
  }

  private updateArcher(dt: number): void {
    if (this.mode === "wind") {
      this.setVelocityX(0);
      this.timer -= dt;
      this.visual = "attack";
      this.visualT = 0.25;
      if (this.timer <= 0) {
        this.mode = "active";
        this.timer = 0.12;
        this.didShot = false;
      }
      return;
    }
    if (this.mode === "active") {
      this.visual = "attack";
      this.visualT = 0.85;
      this.timer -= dt;
      if (!this.didShot) {
        this.didShot = true;
        const close = Math.abs(this.world.focus.x - this.x) < 52;
        if (close) {
          this.swing = this.makeSwing({
            damage: this.dmg,
            kb: 90,
            stun: 0.16,
            w: 50,
            h: 36,
            ox: 40,
            oy: -60,
          });
        } else {
          this.world.sfx("arrow");
          this.world.fire({
            x: this.x + this.facing * 28,
            y: this.y - 58,
            vx: this.facing * 300,
            vy: 0,
            w: 24,
            h: 10,
            life: 1.5,
            damage: this.dmg,
            kb: 90,
            stun: 0.16,
            dir: this.facing,
            fromPlayer: false,
            tex: "arrow",
            crit: 0,
            lifesteal: 0,
          });
        }
      } else if (this.swing && this.liveSpec) this.swing.rect = this.rectOf(this.liveSpec);
      if (this.timer <= 0) {
        this.mode = "recover";
        this.timer = 0.42;
        if (this.swing) this.clearSwing = true;
      }
      return;
    }
    if (this.mode === "recover") {
      this.setVelocityX(0);
      this.visual = "idle";
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = "move";
        this.cd = 2.4;
      }
      return;
    }
    const dx = this.world.focus.x - this.x;
    const dist = Math.abs(dx);
    this.facing = Math.sign(dx) || this.facing;
    if (dist < 130) this.setVelocityX(-this.facing * this.speed);
    else if (dist > 250) this.setVelocityX(this.facing * this.speed);
    else this.setVelocityX(0);
    this.visual = Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x) > 8 ? "run" : "idle";
    if (dist < 460 && dist > 48 && this.cd <= 0 && this.grounded()) this.beginWind(0.32, "attack");
    else if (dist <= 48 && this.cd <= 0 && this.grounded()) this.beginWind(0.16, "attack");
  }

  private updateBrute(dt: number): void {
    if (this.mode === "wind") {
      this.setVelocityX(0);
      this.timer -= dt;
      this.visualT = 0.15;
      if (this.timer <= 0) {
        this.mode = "active";
        this.timer = this.visual === "charge" ? 0.38 : 0.16;
        this.swing = this.makeSwing(
          this.visual === "charge"
            ? { damage: this.dmg + 2, kb: 260, stun: 0.3, w: 78, h: 56, ox: 62, oy: -66 }
            : { damage: this.dmg + 1, kb: 200, stun: 0.28, w: 110, h: 48, ox: 48, oy: -48 },
        );
      }
      return;
    }
    if (this.mode === "active") {
      this.visualT = 0.8;
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (this.visual === "charge") this.setVelocityX(this.facing * 330);
      else this.setVelocityX(this.facing * 20);
      if (this.swing && this.liveSpec) this.swing.rect = this.rectOf(this.liveSpec);
      this.timer -= dt;
      if (this.timer <= 0 || (this.visual === "charge" && (body.blocked.left || body.blocked.right))) {
        this.mode = "recover";
        this.timer = 0.55;
        if (this.swing) this.clearSwing = true;
      }
      return;
    }
    if (this.mode === "recover") {
      this.setVelocityX(0);
      this.visual = "idle";
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = "move";
        this.cd = 1.55;
      }
      return;
    }
    const dist = this.chase(this.speed, 72);
    this.visual = Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x) > 8 ? "run" : "idle";
    if (this.cd <= 0 && this.grounded()) {
      if (dist < 210 && dist > 78) this.beginWind(0.48, "charge");
      else if (dist <= 86) this.beginWind(0.4, "slam");
    }
  }

  private updateBoss(dt: number): void {
    const phase2 = this.hp <= this.maxHp * 0.5;
    if (phase2 && !this.announced2) {
      this.announced2 = true;
      this.enraged = true;
      this.script = [];
      this.swing = null;
      const card = this.card;
      this.world.banner(card?.phase ?? "狂怒", card?.phaseSub ?? "");
      this.world.sfx("boss");
      this.world.shake(180, 0.012);
      this.world.hitStop(70);
    }
    if (this.script.length === 0) {
      this.swing = null;
      this.choosePattern(phase2);
    }
    const step = this.script[this.step];
    if (!step) return;
    this.stepT += dt;
    this.visual = step.visual;
    if (step.op === "wind") this.visualT = Math.min(0.32, this.stepT / Math.max(0.01, step.dur));
    else if (step.op === "hit" || step.op === "slam") this.visualT = 0.72;
    else this.visualT = Math.min(0.99, this.stepT / step.dur);
    if (step.op === "wind") {
      this.mode = "wind";
      this.setVelocityX(0);
      this.facing = Math.sign(this.world.focus.x - this.x) || this.facing;
    } else if (step.op === "hold") {
      this.mode = "move";
      this.swing = null;
      if (step.chase) {
        const dx = this.world.focus.x - this.x;
        this.facing = Math.sign(dx) || this.facing;
        const speed = this.speed * (phase2 ? 1.2 : 1);
        this.setVelocityX(Math.abs(dx) > 90 ? this.facing * speed : 0);
        this.visual = Math.abs(dx) > 90 ? "run" : "idle";
      } else {
        this.setVelocityX(0);
      }
    } else if (step.op === "hit" && step.spec) {
      this.mode = "active";
      this.setVelocityX(this.facing * (step.vx ?? 0));
      if (!this.swing) this.swing = this.makeSwing(step.spec);
      else this.swing.rect = this.rectOf(step.spec);
    } else if (step.op === "shot" || step.op === "lob" || step.op === "dart") {
      this.mode = step.op === "shot" ? "wind" : "active";
      this.setVelocityX(0);
      if (!this.didShot) {
        this.didShot = true;
        this.fireBossShot(step.op, phase2);
      }
    } else if (step.op === "blink") {
      this.mode = "wind";
      this.setVelocity(0, 0);
      if (!this.didShot) {
        this.didShot = true;
        this.blinkAside();
      }
    } else if (step.op === "slam") {
      this.mode = "active";
      this.setVelocityX(0);
      if (!this.didShot) {
        this.didShot = true;
        this.bossSlam(step.vx ?? (this.kind === "boss" ? 240 : 150));
      } else if (this.liveSpec && this.swing) {
        this.swing.rect = this.rectOf(this.liveSpec);
      }
    }
    if (this.stepT >= step.dur) {
      this.step += 1;
      this.stepT = 0;
      this.didShot = false;
      if (this.step >= this.script.length) this.script = [];
    }
  }

  private fireBossShot(op: "shot" | "lob" | "dart", phase2: boolean): void {
    this.world.sfx(op === "dart" ? "arrow" : "special");
    if (op === "lob") {
      this.world.fire({
        x: this.x + this.facing * 24,
        y: this.y - 86,
        vx: this.facing * 180,
        vy: -300,
        w: 26,
        h: 26,
        life: 2.2,
        damage: this.dmg + 1,
        kb: 160,
        stun: 0.2,
        dir: this.facing,
        fromPlayer: false,
        tex: "lanternshot",
        crit: 0,
        lifesteal: 0,
        gravity: 640,
        bomb: true,
        label: "灯火",
      });
      return;
    }
    if (op === "dart") {
      this.world.fire({
        x: this.x + this.facing * 28,
        y: this.y - 68,
        vx: this.facing * 280,
        vy: 0,
        w: 26,
        h: 12,
        life: 1.15,
        damage: this.dmg,
        kb: 110,
        stun: 0.14,
        dir: this.facing,
        fromPlayer: false,
        tex: "dart",
        crit: 0,
        lifesteal: 0,
        label: "竹镖",
      });
      return;
    }
    this.world.fire({
      x: this.x + this.facing * 36,
      y: this.y - 72,
      vx: this.facing * 250,
      vy: 0,
      w: 40,
      h: 28,
      life: 1.35,
      damage: this.dmg + (phase2 ? 3 : 1),
      kb: 150,
      stun: 0.2,
      dir: this.facing,
      fromPlayer: false,
      tex: "crescent",
      crit: 0,
      lifesteal: 0,
      label: "弧月",
    });
  }

  private bossSlam(speed: number): void {
    const heavy = this.kind === "boss";
    this.world.shake(heavy ? 140 : 90, heavy ? 0.012 : 0.007);
    this.world.sfx("slam");
    this.world.hitStop(heavy ? 50 : 36);
    this.swing = this.makeSwing({
      damage: this.dmg + (heavy ? 3 : 1),
      kb: heavy ? 240 : 160,
      stun: 0.28,
      w: heavy ? 110 : 64,
      h: 46,
      ox: heavy ? 28 : 18,
      oy: -40,
    });
    for (const dir of [-1, 1] as const) {
      this.world.fire({
        x: this.x + dir * 40,
        y: this.y - 18,
        vx: dir * speed,
        vy: 0,
        w: 46,
        h: 22,
        life: heavy ? 0.55 : 0.85,
        damage: Math.max(6, this.dmg - 2),
        kb: 160,
        stun: 0.2,
        dir,
        fromPlayer: false,
        tex: heavy ? "shock" : "lanternshot",
        crit: 0,
        lifesteal: 0,
        ignoreSolid: true,
        label: heavy ? "震地" : "鬼火",
      });
    }
  }

  private blinkAside(): void {
    const focus = this.world.focus.x;
    const side = this.x >= focus ? -1 : 1;
    const dest = Math.max(150, Math.min(900, focus + side * 150));
    this.world.dust(this.x, this.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.reset(dest, this.y);
    this.facing = Math.sign(focus - dest) || -side;
    this.world.dust(dest, this.y);
    this.world.sfx("dash");
  }

  private choosePattern(phase2: boolean): void {
    const dist = Math.abs(this.world.focus.x - this.x);
    const fast = phase2 ? 0.84 : 1;
    const d = this.dmg + (phase2 ? 2 : 0);
    const approach: Step[] = dist > 200 ? [{ op: "hold", dur: 0.26, visual: "run", chase: true }] : [];
    const punish = (dur: number): Step => ({ op: "hold", dur: dur * fast, visual: "idle" });
    const melee = (extra: boolean): Step[] => [
      { op: "wind", dur: 0.5 * fast, visual: "slash" },
      { op: "hit", dur: 0.14, visual: "slash", vx: 70, spec: { damage: d + 1, kb: 170, stun: 0.22, w: 90, h: 58, ox: 74, oy: -76 } },
      { op: "hold", dur: 0.16 * fast, visual: "slash" },
      { op: "hit", dur: 0.14, visual: "slash", vx: 50, spec: { damage: d + 2, kb: 190, stun: 0.24, w: 98, h: 60, ox: 78, oy: -72 } },
      ...(extra
        ? ([
            { op: "wind", dur: 0.28 * fast, visual: "slash" },
            { op: "hit", dur: 0.15, visual: "slash", vx: 40, spec: { damage: d + 3, kb: 210, stun: 0.26, w: 104, h: 64, ox: 80, oy: -70 } },
          ] as Step[])
        : []),
      punish(0.58),
    ];
    let name = "横斩";
    let steps: Step[] = melee(false);
    if (this.kind === "wisp") {
      const bag = ["掷灯", "扑击", "鬼火"];
      if (dist > 220) bag.push("掷灯", "鬼火");
      if (dist < 140) bag.push("扑击");
      if (phase2) bag.push("双灯");
      name = bag[Math.floor(Math.random() * bag.length)];
      if (name === "扑击") {
        steps = [
          ...approach,
          { op: "wind", dur: 0.58 * fast, visual: "dash" },
          { op: "hit", dur: 0.26, visual: "dash", vx: 340, spec: { damage: d + 2, kb: 220, stun: 0.26, w: 78, h: 52, ox: 58, oy: -64 } },
          punish(0.64),
        ];
      } else if (name === "鬼火") {
        steps = [
          { op: "wind", dur: 0.72 * fast, visual: "slam" },
          { op: "slam", dur: 0.28, visual: "slam", vx: 150 },
          punish(0.62),
        ];
      } else if (name === "双灯") {
        steps = [
          { op: "wind", dur: 0.5 * fast, visual: "cast" },
          { op: "lob", dur: 0.18, visual: "cast" },
          { op: "hold", dur: 0.28, visual: "cast" },
          { op: "lob", dur: 0.18, visual: "cast" },
          punish(0.6),
        ];
      } else {
        steps = [
          { op: "wind", dur: 0.62 * fast, visual: "cast" },
          { op: "lob", dur: 0.2, visual: "cast" },
          punish(0.58),
        ];
      }
    } else if (this.kind === "shade") {
      const bag = ["影刺", "连镖", "旋斩"];
      if (dist > 200) bag.push("连镖", "影刺");
      if (dist < 120) bag.push("旋斩");
      if (phase2) bag.push("瞬步");
      name = bag[Math.floor(Math.random() * bag.length)];
      if (name === "影刺") {
        steps = [
          ...approach,
          { op: "wind", dur: 0.5 * fast, visual: "dash" },
          { op: "hit", dur: 0.2, visual: "dash", vx: 420, spec: { damage: d + 2, kb: 240, stun: 0.24, w: 80, h: 50, ox: 60, oy: -62 } },
          punish(0.56),
        ];
      } else if (name === "连镖") {
        steps = [
          { op: "wind", dur: 0.52 * fast, visual: "cast" },
          { op: "dart", dur: 0.12, visual: "cast" },
          { op: "hold", dur: 0.2, visual: "cast" },
          { op: "dart", dur: 0.12, visual: "cast" },
          { op: "hold", dur: 0.2, visual: "cast" },
          { op: "dart", dur: 0.12, visual: "cast" },
          punish(0.55),
        ];
      } else if (name === "瞬步") {
        steps = [
          { op: "wind", dur: 0.42 * fast, visual: "cast" },
          { op: "blink", dur: 0.12, visual: "dash" },
          { op: "wind", dur: 0.46 * fast, visual: "slash" },
          { op: "hit", dur: 0.14, visual: "slash", vx: 80, spec: { damage: d + 3, kb: 200, stun: 0.24, w: 86, h: 54, ox: 64, oy: -66 } },
          punish(0.58),
        ];
      } else {
        steps = melee(false);
      }
    } else {
      const bag = ["横斩", "突进", "弧月"];
      if (dist > 220) bag.push("弧月", "突进");
      if (dist < 140) bag.push("横斩");
      if (phase2) bag.push("震地", "连斩");
      name = bag[Math.floor(Math.random() * bag.length)];
      if (name === "突进") {
        steps = [
          ...approach,
          { op: "wind", dur: 0.58 * fast, visual: "dash" },
          { op: "hit", dur: 0.3, visual: "dash", vx: 460, spec: { damage: d + 3, kb: 280, stun: 0.3, w: 88, h: 62, ox: 66, oy: -70 } },
          punish(0.62),
        ];
      } else if (name === "弧月") {
        steps = [
          { op: "wind", dur: 0.55 * fast, visual: "cast" },
          { op: "shot", dur: 0.2, visual: "cast" },
          punish(0.56),
        ];
      } else if (name === "震地") {
        steps = [
          { op: "wind", dur: 0.7 * fast, visual: "slam" },
          { op: "slam", dur: 0.24, visual: "slam", vx: 220 },
          punish(0.66),
        ];
      } else if (name === "连斩") {
        steps = melee(true);
      } else {
        steps = melee(false);
      }
    }
    this.callout = name;
    this.script = steps;
    this.step = 0;
    this.stepT = 0;
    this.didShot = false;
    this.facing = Math.sign(this.world.focus.x - this.x) || this.facing;
  }

  private tickMelee(dt: number, visual: string, active: number, recover: number, cd: number, spec: SwingSpec): boolean {
    if (this.mode === "wind") {
      this.setVelocityX(0);
      this.visual = visual;
      this.visualT = 0.2;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = "active";
        this.timer = active;
        this.swing = this.makeSwing(spec);
      }
      return true;
    }
    if (this.mode === "active") {
      this.visual = visual;
      this.visualT = 0.62;
      this.setVelocityX(this.facing * 36);
      this.timer -= dt;
      if (this.swing) this.swing.rect = this.rectOf(spec);
      if (this.timer <= 0) {
        this.mode = "recover";
        this.timer = recover;
        if (this.swing) this.clearSwing = true;
      }
      return true;
    }
    if (this.mode === "recover") {
      this.setVelocityX(0);
      this.visual = "idle";
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = "move";
        this.cd = cd;
      }
      return true;
    }
    return false;
  }

  private tickDots(dt: number): void {
    if (this.dead || (this.bleed <= 0 && this.burn <= 0)) return;
    this.dotT -= dt;
    if (this.dotT > 0) return;
    this.dotT = 0.55;
    const amount = Math.max(1, Math.round(this.bleed * this.bleedHit + this.burn * 2));
    const color = this.burn > 0 ? "#ff8a3a" : "#ff6a7a";
    if (this.bleed > 0) this.bleed -= 1;
    if (this.burn > 0) this.burn -= 1;
    this.chip(amount, color);
  }

  private updateBomber(dt: number): void {
    if (this.mode === "wind") {
      this.setVelocityX(0);
      this.timer -= dt;
      this.visual = "attack";
      this.visualT = 0.4;
      if (this.timer <= 0) {
        this.mode = "recover";
        this.timer = 0.35;
        this.world.sfx("arrow");
        this.world.fire({
          x: this.x + this.facing * 20,
          y: this.y - 78,
          vx: this.facing * 170,
          vy: -360,
          w: 22,
          h: 22,
          life: 2.4,
          damage: this.dmg,
          kb: 150,
          stun: 0.2,
          dir: this.facing,
          fromPlayer: false,
          tex: "bomb",
          crit: 0,
          lifesteal: 0,
          gravity: 760,
          bomb: true,
        });
      }
      return;
    }
    if (this.mode === "recover") {
      this.setVelocityX(0);
      this.visual = "idle";
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = "move";
        this.cd = 1.7;
      }
      return;
    }
    const dx = this.world.focus.x - this.x;
    const dist = Math.abs(dx);
    this.facing = Math.sign(dx) || this.facing;
    if (dist < 150) this.setVelocityX(-this.facing * this.speed);
    else if (dist > 280) this.setVelocityX(this.facing * this.speed * 0.8);
    else this.setVelocityX(0);
    this.visual = Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x) > 8 ? "run" : "idle";
    if (this.cd <= 0 && this.grounded() && dist < 460) this.beginWind(0.55, "attack");
  }

  private updateLeaper(dt: number): void {
    if (this.leaping) {
      this.leapT += dt;
      this.visual = "attack";
      this.visualT = 0.55;
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (this.leapT > 0.18 && body.blocked.down) {
        this.leaping = false;
        this.mode = "active";
        this.timer = 0.14;
        this.swing = this.makeSwing({ damage: this.dmg + 2, kb: 230, stun: 0.26, w: 84, h: 50, ox: 52, oy: -48 });
        this.world.dust(this.x, this.y);
        this.world.shake(50, 0.004);
      }
      return;
    }
    if (this.mode === "wind") {
      this.setVelocityX(0);
      this.timer -= dt;
      this.visual = "attack";
      this.visualT = 0.2;
      if (this.timer <= 0) {
        const dir = Math.sign(this.world.focus.x - this.x) || this.facing;
        this.facing = dir;
        this.leaping = true;
        this.leapT = 0;
        this.mode = "active";
        this.setVelocity(dir * 430, -480);
        this.world.sfx("dash");
      }
      return;
    }
    if (this.mode === "active") {
      this.visualT = 0.8;
      this.timer -= dt;
      if (this.swing && this.liveSpec) this.swing.rect = this.rectOf(this.liveSpec);
      if (this.timer <= 0) {
        this.mode = "recover";
        this.timer = 0.32;
        if (this.swing) this.clearSwing = true;
      }
      return;
    }
    if (this.mode === "recover") {
      this.setVelocityX(0);
      this.visual = "idle";
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = "move";
        this.cd = 1.15;
      }
      return;
    }
    const dist = this.chase(this.speed, 64);
    this.visual = Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x) > 8 ? "run" : "idle";
    if (this.cd <= 0 && this.grounded() && dist < 360) this.beginWind(dist < 110 ? 0.16 : 0.28, "attack");
  }

  private beginWind(dur: number, visual: string): void {
    this.mode = "wind";
    this.timer = dur;
    this.visual = visual;
    this.visualT = 0;
    this.swing = null;
    this.facing = Math.sign(this.world.focus.x - this.x) || this.facing;
    this.setVelocityX(0);
  }

  private chase(speed: number, stopDist: number): number {
    const dx = this.world.focus.x - this.x;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || this.facing;
    this.facing = dir;
    const probe = this.x + dir * 24;
    if (!this.world.footing(probe)) {
      this.setVelocityX(0);
      if (this.grounded() && dist < 200 && this.hopCd <= 0) {
        this.setVelocityY(TUNING.jumpV * 0.94);
        this.setVelocityX(dir * speed);
        this.hopCd = 0.7;
      }
    } else if (dist > stopDist) this.setVelocityX(dir * speed);
    else this.setVelocityX(0);
    return dist;
  }

  private maybeHop(): void {
    if (isBossKind(this.kind) && this.mode !== "move") return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if ((body.blocked.left || body.blocked.right) && body.blocked.down && this.hopCd <= 0 && this.mode === "move") {
      this.setVelocityY(TUNING.jumpV * 0.9);
      this.hopCd = 0.55;
    }
  }

  private grounded(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  private makeSwing(spec: SwingSpec): Swing {
    this.liveSpec = spec;
    return {
      rect: this.rectOf(spec),
      damage: spec.damage,
      kb: spec.kb,
      stun: spec.stun,
      dir: this.facing,
      crit: 0,
      lifesteal: 0,
      kind: "enemy",
      seen: new Set(),
    };
  }

  private rectOf(spec: SwingSpec): { x: number; y: number; w: number; h: number } {
    return { x: this.x + this.facing * spec.ox, y: this.y + spec.oy, w: spec.w, h: spec.h };
  }

  private paint(): void {
    if (this.flash > 0) {
      this.flash -= 1 / 60;
      this.setTintFill(0xffffff);
      return;
    }
    if (this.mode === "wind" && !this.dead) this.setTint(0xff9a9a);
    else if (this.enraged && this.kind === "wisp" && !this.dead) this.setTint(0xffc07a);
    else if (this.enraged && this.kind === "shade" && !this.dead) this.setTint(0xb0ffc8);
    else if (this.enraged && !this.dead) this.setTint(0xffb088);
    else if (this.elite === "armored" && !this.dead) this.setTint(0xb7d4ff);
    else if (this.elite === "enraged" && !this.dead) this.setTint(0xff8866);
    else if (this.elite === "split" && !this.dead) this.setTint(0xe0b0ff);
    else if (this.burn > 0 && !this.dead) this.setTint(0xffa060);
    else if (this.bleed > 0 && !this.dead) this.setTint(0xff8aa0);
    else this.clearTint();
  }

  private pose(): void {
    const looping = this.visual === "idle" || this.visual === "run";
    const frame = looping
      ? loopFrame(this.kind, this.visual, this.animT, this.visual === "run" ? 10 : 5)
      : playFrame(this.kind, this.visual, this.visualT);
    this.setFrame(frame);
    this.setFlipX(this.facing < 0);
    this.marker.setPosition(this.x, this.y - this.markH);
    const eliteMark = this.elite === "armored" ? "甲" : this.elite === "enraged" ? "怒" : this.elite === "split" ? "裂" : this.guard > 0 ? "盾" : "";
    if (isBossKind(this.kind)) this.marker.setText(this.callout);
    else if (this.mode === "wind") this.marker.setText("!");
    else this.marker.setText(eliteMark);
    const bossCall = isBossKind(this.kind) && this.callout !== "" && this.script.length > 0;
    this.marker.setVisible(!this.dead && (this.mode === "wind" || eliteMark !== "" || bossCall));
    this.marker.setColor(this.mode === "wind" ? "#ffd2d2" : "#f6edd8");
    this.setDepth(10 + this.y * 0.0001);
  }

  override destroy(fromScene?: boolean): void {
    if (this.marker.active) this.marker.destroy();
    super.destroy(fromScene);
  }
}
