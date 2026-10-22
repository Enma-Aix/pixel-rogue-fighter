import Phaser from "phaser";
import { loopFrame, playFrame } from "../art";
import { ART, TUNING } from "../constants";
import { stickToSurface, tryStep } from "../step";
import { enemyStats } from "../upgrades";
import type { EnemyKind, Swing, WorldApi } from "../types";
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
  op: "wind" | "hold" | "hit" | "shot" | "slam";
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
  private announced3 = false;
  private deadT = 0;
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
    this.poise = kind === "boss";
    this.awake = 0.28;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, ART.footSrc / ART.texH);
    const size = BODY[kind];
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(size.w, size.h);
    body.setOffset((ART.texW - size.w) / 2, ART.footSrc - size.h);
    body.setMaxVelocity(720, 860);
    this.markH = size.h + 28;
    this.marker = scene.add
      .text(x, y - this.markH, "!", {
        fontFamily: FONT,
        fontSize: "28px",
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

  hurtbox(): { x: number; y: number; w: number; h: number } {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return { x: body.center.x, y: body.center.y, w: body.width, h: body.height };
  }

  receive(amount: number, kb: number, stun: number, dir: number, crit: boolean): boolean {
    if (this.dead || this.hp <= 0) return false;
    const dmg = Math.max(1, Math.round(amount));
    this.hp -= dmg;
    this.world.float(this.x, this.y - this.markH, crit ? `${dmg}` : `${dmg}`, crit ? "#ffe08a" : "#f7f1e6");
    this.world.spark(this.x, this.y - 60, crit ? 0xffd56a : 0xfff6ea);
    this.world.sfx("hit");
    this.flash = 0.07;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.swing = null;
      this.mode = "hurt";
      this.visual = "dead";
      this.setVelocity(dir * 90, -120);
      this.deadT = 0;
      this.world.onKill(this.kind, this.x, this.y);
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

  update(dt: number): void {
    if (this.clearSwing) {
      this.swing = null;
      this.clearSwing = false;
    }
    this.animT += dt;
    this.hopCd -= dt;
    this.paint();
    if (this.y > 690 && !this.dead) {
      this.receive(9999, 0, 0, 1, false);
    }
    if (this.dead) {
      this.swing = null;
      this.mode = "hurt";
      this.visual = "dead";
      this.visualT = 1;
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (body.blocked.down) this.setVelocity(0, 0);
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
    if (this.kind === "boss") this.updateBoss(dt);
    else if (this.kind === "archer") this.updateArcher(dt);
    else if (this.kind === "brute") this.updateBrute(dt);
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
        this.cd = 1.35;
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
    const phase = this.hp / this.maxHp <= 0.3 ? 3 : this.hp / this.maxHp <= 0.6 ? 2 : 1;
    if (phase >= 2 && !this.announced2) {
      this.announced2 = true;
      this.world.float(this.x, this.y - 130, "破绽", "#ffd27a");
      this.world.sfx("boss");
    }
    if (phase >= 3 && !this.announced3) {
      this.announced3 = true;
      this.world.float(this.x, this.y - 130, "狂怒", "#ff6a5a");
      this.world.sfx("boss");
    }
    if (this.script.length === 0) {
      this.swing = null;
      this.choosePattern(phase);
    }
    const step = this.script[this.step];
    if (!step) return;
    this.stepT += dt;
    this.visual = step.visual;
    this.visualT = Math.min(0.99, this.stepT / step.dur);
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
        const speed = this.speed * (phase === 3 ? 1.3 : 1);
        this.setVelocityX(Math.abs(dx) > 78 ? this.facing * speed : 0);
        this.visual = Math.abs(dx) > 78 ? "run" : "idle";
      } else {
        this.setVelocityX(0);
      }
    } else if (step.op === "hit" && step.spec) {
      this.mode = "active";
      this.setVelocityX(this.facing * (step.vx ?? 0));
      if (!this.swing) this.swing = this.makeSwing(step.spec);
      else this.swing.rect = this.rectOf(step.spec);
    } else if (step.op === "shot") {
      this.mode = "wind";
      this.setVelocityX(0);
      if (!this.didShot) {
        this.didShot = true;
        this.world.sfx("special");
        this.world.fire({
          x: this.x + this.facing * 36,
          y: this.y - 72,
          vx: this.facing * 320,
          vy: 0,
          w: 40,
          h: 28,
          life: 1.5,
          damage: this.dmg + phase,
          kb: 150,
          stun: 0.22,
          dir: this.facing,
          fromPlayer: false,
          tex: "crescent",
          crit: 0,
          lifesteal: 0,
        });
      }
    } else if (step.op === "slam") {
      this.mode = "active";
      this.setVelocityX(0);
      if (!this.didShot) {
        this.didShot = true;
        this.world.shake(140, 0.012);
        this.world.sfx("slam");
        this.world.hitStop(50);
        this.swing = this.makeSwing({
          damage: this.dmg + 4,
          kb: 260,
          stun: 0.32,
          w: 130,
          h: 52,
          ox: 36,
          oy: -42,
        });
        for (const dir of [-1, 1] as const) {
          this.world.fire({
            x: this.x + dir * 48,
            y: this.y - 20,
            vx: dir * 280,
            vy: 0,
            w: 52,
            h: 28,
            life: 0.6,
            damage: this.dmg,
            kb: 210,
            stun: 0.26,
            dir,
            fromPlayer: false,
            tex: "shock",
            crit: 0,
            lifesteal: 0,
            ignoreSolid: true,
          });
        }
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

  private choosePattern(phase: number): void {
    const dist = Math.abs(this.world.focus.x - this.x);
    const bag: string[] = [];
    if (dist < 130) {
      bag.push("slash", "slash");
      if (phase >= 2) bag.push("slam");
      if (phase >= 3) bag.push("flurry");
    } else if (dist < 280) {
      bag.push("dash", "slash", "wave");
      if (phase >= 2) bag.push("slam");
    } else {
      bag.push("wave", "dash", "wave");
    }
    const name = bag[Math.floor(Math.random() * bag.length)];
    const fast = phase === 3 ? 0.78 : phase === 2 ? 0.9 : 1;
    const d = this.dmg + (phase === 3 ? 3 : 0);
    const slash = (extra = false): Step[] => [
      { op: "wind", dur: 0.34 * fast, visual: "slash" },
      { op: "hit", dur: 0.13, visual: "slash", vx: 70, spec: { damage: d, kb: 170, stun: 0.22, w: 88, h: 58, ox: 76, oy: -78 } },
      { op: "hold", dur: 0.12 * fast, visual: "slash" },
      { op: "hit", dur: 0.13, visual: "slash", vx: 50, spec: { damage: d + 2, kb: 190, stun: 0.24, w: 96, h: 62, ox: 80, oy: -74 } },
      ...(extra
        ? ([
            { op: "hold", dur: 0.1, visual: "slash" },
            { op: "hit", dur: 0.14, visual: "slash", vx: 40, spec: { damage: d + 4, kb: 220, stun: 0.28, w: 104, h: 66, ox: 84, oy: -70 } },
          ] as Step[])
        : []),
      { op: "hold", dur: 0.42 * fast, visual: "idle", chase: true },
    ];
    if (name === "dash") {
      this.script = [
        { op: "wind", dur: 0.42 * fast, visual: "dash" },
        { op: "hit", dur: 0.36, visual: "dash", vx: 430, spec: { damage: d + 3, kb: 280, stun: 0.3, w: 86, h: 64, ox: 64, oy: -70 } },
        { op: "hold", dur: 0.48 * fast, visual: "idle" },
      ];
    } else if (name === "wave") {
      this.script = [
        { op: "wind", dur: 0.36 * fast, visual: "cast" },
        { op: "shot", dur: 0.2, visual: "cast" },
        { op: "hold", dur: 0.4 * fast, visual: "idle", chase: true },
      ];
    } else if (name === "slam") {
      this.script = [
        { op: "wind", dur: 0.5 * fast, visual: "slam" },
        { op: "slam", dur: 0.22, visual: "slam" },
        { op: "hold", dur: 0.55 * fast, visual: "idle" },
      ];
    } else if (name === "flurry") {
      this.script = slash(true);
    } else {
      this.script = slash(false);
    }
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
      this.visualT = 0.75;
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
    if (this.kind === "boss" && this.mode !== "move") return;
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
    if (this.mode === "wind" && !this.dead) this.setTint(0xffb4b4);
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
    this.marker.setVisible(this.mode === "wind" && !this.dead);
    this.setDepth(10 + this.y * 0.0001);
  }

  override destroy(fromScene?: boolean): void {
    if (this.marker.active) this.marker.destroy();
    super.destroy(fromScene);
  }
}
