import Phaser from "phaser";
import { loopFrame, playFrame } from "../art";
import { ART, GROUND_Y, TUNING, clamp } from "../constants";
import { stickToSurface, tryStep } from "../step";
import type { InputState, Mods, Swing, WorldApi } from "../types";

type Action = "idle" | "run" | "jump" | "fall" | "attack" | "dodge" | "special" | "hit" | "dead";

interface Atk {
  id: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  knockback: number;
  stun: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
  lunge: number;
  kind: "light" | "heavy" | "special";
  cancelLight?: string;
  cancelHeavy?: string;
}

const ATTACKS: Record<string, Atk> = {
  l1: {
    id: "l1",
    startup: 0.07,
    active: 0.1,
    recovery: 0.16,
    damage: 10,
    knockback: 100,
    stun: 0.2,
    ox: 78,
    oy: -68,
    w: 150,
    h: 64,
    lunge: 110,
    kind: "light",
    cancelLight: "l2",
  },
  l2: {
    id: "l2",
    startup: 0.06,
    active: 0.1,
    recovery: 0.16,
    damage: 12,
    knockback: 120,
    stun: 0.22,
    ox: 62,
    oy: -66,
    w: 116,
    h: 58,
    lunge: 80,
    kind: "light",
    cancelLight: "l1",
    cancelHeavy: "finisher",
  },
  finisher: {
    id: "finisher",
    startup: 0.11,
    active: 0.12,
    recovery: 0.32,
    damage: 24,
    knockback: 280,
    stun: 0.36,
    ox: 84,
    oy: -78,
    w: 96,
    h: 72,
    lunge: 50,
    kind: "heavy",
  },
  heavy: {
    id: "heavy",
    startup: 0.18,
    active: 0.12,
    recovery: 0.34,
    damage: 20,
    knockback: 240,
    stun: 0.32,
    ox: 82,
    oy: -82,
    w: 94,
    h: 74,
    lunge: 36,
    kind: "heavy",
  },
  air: {
    id: "air",
    startup: 0.07,
    active: 0.12,
    recovery: 0.16,
    damage: 11,
    knockback: 130,
    stun: 0.2,
    ox: 70,
    oy: -62,
    w: 76,
    h: 50,
    lunge: 40,
    kind: "light",
  },
  special: {
    id: "special",
    startup: 0.14,
    active: 0.06,
    recovery: 0.2,
    damage: 0,
    knockback: 0,
    stun: 0,
    ox: 0,
    oy: 0,
    w: 0,
    h: 0,
    lunge: 20,
    kind: "special",
  },
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  facing = 1;
  action: Action = "idle";
  dead = false;
  swing: Swing | null = null;
  iFrame = 0;
  charges: number;
  readonly maxCharges: number;
  chargeT = 0;
  readonly dodgeCd: number;
  specialT = 0;
  readonly specialMax: number;
  private attackId = "l1";
  private attackT = 0;
  private fired = false;
  private stateT = 0;
  private coyote = 0;
  private airUsed = false;
  private animT = 0;
  private flash = 0;
  private wasGround = false;
  private risingCut = false;
  private clearSwing = false;
  readonly mods: Mods;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    maxHp: number,
    mods: Mods,
    private world: WorldApi,
  ) {
    super(scene, x, y, "ch-player", 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, ART.footSrc / ART.texH);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 86);
    body.setOffset((ART.texW - 36) / 2, ART.footSrc - 86);
    body.setMaxVelocity(980, 840);
    this.setDepth(10);
    this.hp = hp;
    this.maxHp = maxHp;
    this.iFrame = 0.9;
    this.mods = mods;
    this.maxCharges = mods.dashCharges;
    this.charges = this.maxCharges;
    this.dodgeCd = TUNING.dodgeCd * mods.dodgeCd;
    this.specialMax = TUNING.specialCd * mods.specialCd;
  }

  get grounded(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.down || body.touching.down;
  }

  get blockedX(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return body.blocked.left || body.blocked.right;
  }

  hurtbox(): { x: number; y: number; w: number; h: number } {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return { x: body.center.x, y: body.center.y, w: body.width, h: body.height };
  }

  specialReady(): number {
    return clamp(1 - this.specialT / this.specialMax, 0, 1);
  }

  chargeRatio(): number {
    if (this.charges >= this.maxCharges || this.dodgeCd <= 0) return 1;
    return clamp(1 - this.chargeT / this.dodgeCd, 0, 1);
  }

  heal(amount: number): void {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const got = Math.round(this.hp - before);
    if (got > 0) this.world.float(this.x, this.y - 100, `+${got}`, "#9dffb0");
  }

  hurt(raw: number, kb: number, stun: number, sourceX: number, cause = "受击"): boolean {
    if (this.dead || this.iFrame > 0) return false;
    this.world.blame(cause);
    const dmg = Math.max(1, Math.round(raw * this.mods.taken));
    this.hp = Math.max(0, this.hp - dmg);
    this.world.float(this.x, this.y - 102, `${dmg}`, "#ff6d6d");
    this.world.spark(this.x, this.y - 64, 0xff6a62);
    this.world.shake(90, 0.006);
    this.world.sfx("hurt");
    this.iFrame = TUNING.hitIFrame;
    this.flash = 0.08;
    this.swing = null;
    this.clearSwing = false;
    const push = this.x >= sourceX ? 1 : -1;
    this.facing = -push;
    this.setVelocity(push * Math.max(80, kb), -200);
    if (this.hp <= 0) {
      this.dead = true;
      this.action = "dead";
      this.world.sfx("death");
      return true;
    }
    this.action = "hit";
    this.stateT = Math.max(0.14, stun * 0.65);
    return true;
  }

  update(dt: number, input: InputState): void {
    if (this.clearSwing) {
      this.swing = null;
      this.clearSwing = false;
    }
    this.animT += dt;
    if (this.iFrame > 0) this.iFrame -= dt;
    if (this.specialT > 0) this.specialT -= dt;
    this.recharge(dt);
    this.paintFlash();

    const body = this.body as Phaser.Physics.Arcade.Body;
    const grounded = this.grounded;
    if (grounded) this.coyote = TUNING.coyote;
    else this.coyote -= dt;

    if (this.y > TUNING.fallY) {
      const safeX = clamp(this.x - this.facing * 120, 120, 900);
      body.reset(safeX, GROUND_Y - 30);
      this.hurt(TUNING.fallDamage, 40, 0.2, this.x + 40, "坠落");
      this.wasGround = false;
      return;
    }
    stickToSurface(this, this.world.solids);

    if (this.dead) {
      if (grounded) this.setVelocityX(0);
      this.pose(1);
      this.wasGround = grounded;
      return;
    }

    if (this.action === "hit") {
      this.stateT -= dt;
      this.swing = null;
      if (this.stateT <= 0) this.action = grounded ? "idle" : "fall";
      this.pose(0);
      this.wasGround = grounded;
      return;
    }

    if (this.action === "dodge") {
      this.stateT -= dt;
      this.setVelocityX(this.facing * TUNING.dodgeSpeed);
      if (body.velocity.y > 30) this.setVelocityY(30);
      if (this.stateT <= 0) this.action = grounded ? "idle" : "fall";
      this.pose(1 - this.stateT / TUNING.dodgeTime);
      this.wasGround = grounded;
      return;
    }

    if (this.action === "attack" || this.action === "special") {
      this.advanceAttack(dt, input, grounded);
      this.wasGround = grounded;
      return;
    }

    if (input.left) this.facing = -1;
    else if (input.right) this.facing = 1;
    const speed = TUNING.move * this.mods.move;
    if (grounded) {
      if (input.left) this.setVelocityX(-speed);
      else if (input.right) this.setVelocityX(speed);
      else this.setVelocityX(0);
      this.action = input.left || input.right ? "run" : "idle";
    } else {
      const accel = 1200 * dt;
      if (input.left) this.setVelocityX(clamp(body.velocity.x - accel, -speed, speed));
      else if (input.right) this.setVelocityX(clamp(body.velocity.x + accel, -speed, speed));
      this.action = body.velocity.y < 0 ? "jump" : "fall";
    }

    let jumped = false;
    if (this.take(input, "jump") && (grounded || this.coyote > 0)) {
      this.launch();
      jumped = true;
    } else if (this.take(input, "dodge") && this.charges > 0) {
      this.startDodge();
    } else if (this.take(input, "special") && this.specialT <= 0 && grounded) {
      this.startAttack("special");
    } else if (this.take(input, "light")) {
      if (grounded) this.startAttack("l1");
      else if (!this.airUsed) this.startAttack("air");
    } else if (this.take(input, "heavy") && grounded) {
      this.startAttack("heavy");
    }

    if (!jumped && !input.jumpHeld && !this.risingCut && body.velocity.y < -430) {
      this.setVelocityY(-430);
      this.risingCut = true;
    }
    if (grounded && !this.wasGround) this.world.dust(this.x, this.y);
    const dir = input.left ? -1 : input.right ? 1 : 0;
    if (dir) tryStep(this, dir, this.world.solids);
    this.pose(0);
    this.wasGround = grounded;
  }

  private recharge(dt: number): void {
    if (this.charges >= this.maxCharges) return;
    this.chargeT -= dt;
    if (this.chargeT <= 0) {
      this.charges += 1;
      this.chargeT = this.charges >= this.maxCharges ? 0 : this.dodgeCd;
    }
  }

  private paintFlash(): void {
    if (this.flash > 0) {
      this.flash -= 1 / 60;
      this.setTintFill(0xffffff);
      this.setAlpha(1);
      return;
    }
    this.clearTint();
    if (this.iFrame > 0 && this.action !== "dodge" && !this.dead) {
      this.setAlpha(Math.sin(this.animT * 42) > 0 ? 0.45 : 1);
    } else {
      this.setAlpha(1);
    }
  }

  private take(input: InputState, name: InputState["buffer"]): boolean {
    if (input.buffer === name && input.bufferT > 0) {
      input.buffer = null;
      input.bufferT = 0;
      return true;
    }
    return false;
  }

  private launch(): void {
    this.setVelocityY(TUNING.jumpV);
    this.coyote = 0;
    this.risingCut = false;
    this.airUsed = false;
    this.action = "jump";
    this.world.sfx("jump");
  }

  private startDodge(): void {
    this.charges -= 1;
    if (this.chargeT <= 0) this.chargeT = this.dodgeCd;
    this.action = "dodge";
    this.stateT = TUNING.dodgeTime;
    this.iFrame = TUNING.dodgeIFrame;
    this.swing = null;
    this.clearSwing = false;
    this.setVelocityY(0);
    this.setVelocityX(this.facing * TUNING.dodgeSpeed);
    this.world.sfx("dash");
    this.world.dust(this.x, this.y);
    this.world.afterimage(this.x, this.y, this.frame.name, this.facing < 0);
  }

  private startAttack(id: string): void {
    const atk = ATTACKS[id];
    if (!atk) return;
    this.attackId = id;
    this.attackT = 0;
    this.fired = false;
    this.swing = null;
    this.clearSwing = false;
    this.action = id === "special" ? "special" : "attack";
    if (id === "air") this.airUsed = true;
    this.world.sfx(id === "special" ? "special" : "swing");
  }

  private span(atk: Atk): { startup: number; active: number; recovery: number; total: number } {
    const light = atk.kind === "light" ? this.mods.lightRecovery : 1;
    const startup = atk.startup * (atk.kind === "light" ? Math.max(0.72, light) : 1);
    const recovery = atk.recovery * light;
    return { startup, active: atk.active, recovery, total: startup + atk.active + recovery };
  }

  private advanceAttack(dt: number, input: InputState, grounded: boolean): void {
    const atk = ATTACKS[this.attackId];
    const span = this.span(atk);
    this.attackT += dt;
    const t = this.attackT;
    if (t < span.startup) this.setVelocityX(this.facing * 28);
    else if (t < span.startup + span.active) this.setVelocityX(this.facing * atk.lunge);
    else if (grounded) this.setVelocityX(this.facing * 12);

    const active = atk.w > 0 && t >= span.startup && t < span.startup + span.active;
    if (active) {
      if (!this.swing) {
        this.swing = {
          rect: this.hitRect(atk),
          damage: this.scaled(atk),
          kb: atk.kind === "heavy" ? atk.knockback * this.mods.heavyKb : atk.knockback,
          stun: atk.stun,
          dir: this.facing,
          crit: this.mods.crit,
          lifesteal: this.mods.lifesteal,
          kind: atk.kind,
          seen: new Set(),
        };
        this.world.slash(this.x + this.facing * 50, this.y - 68, this.facing, atk.kind === "heavy");
      } else {
        this.swing.rect = this.hitRect(atk);
        this.swing.dir = this.facing;
      }
    } else if (this.swing) {
      this.clearSwing = true;
    }

    if (this.attackId === "special" && !this.fired && t >= span.startup) this.castSpecial();

    const cancel = t >= span.startup + span.active && t < span.total;
    if (cancel && this.take(input, "dodge") && this.charges > 0) {
      this.startDodge();
      this.pose(0);
      return;
    }
    if (cancel && atk.cancelLight && this.take(input, "light")) {
      this.startAttack(atk.cancelLight);
      this.pose(0);
      return;
    }
    if (cancel && atk.cancelHeavy && this.take(input, "heavy")) {
      this.startAttack(atk.cancelHeavy);
      this.pose(0);
      return;
    }
    if (cancel && (atk.id === "l1" || atk.id === "l2") && this.take(input, "jump") && grounded) {
      this.swing = null;
      this.launch();
      this.pose(0);
      return;
    }
    if (t >= span.total) {
      this.action = grounded ? "idle" : "fall";
      if (this.swing) this.clearSwing = true;
    }
    const dir = input.left ? -1 : input.right ? 1 : this.facing;
    tryStep(this, dir, this.world.solids);
    this.pose(clamp(t / span.total, 0, 0.999));
  }

  private castSpecial(): void {
    this.fired = true;
    this.specialT = this.specialMax;
    const damage = 18 * this.mods.atk * this.mods.specialDmg;
    this.world.fire({
      x: this.x + this.facing * 46,
      y: this.y - 64,
      vx: this.facing * 580,
      vy: 0,
      w: 42,
      h: 24,
      life: 0.48,
      damage,
      kb: 200,
      stun: 0.24,
      dir: this.facing,
      fromPlayer: true,
      tex: "energy",
      crit: this.mods.crit,
      lifesteal: this.mods.lifesteal,
    });
    if (this.mods.shockwave) {
      for (const dir of [-1, 1] as const) {
        this.world.fire({
          x: this.x + dir * 30,
          y: this.y - 18,
          vx: dir * 270,
          vy: 0,
          w: 46,
          h: 26,
          life: 0.45,
          damage: damage * 0.55,
          kb: 170,
          stun: 0.2,
          dir,
          fromPlayer: true,
          tex: "shock",
          crit: this.mods.crit,
          lifesteal: this.mods.lifesteal,
          ignoreSolid: true,
        });
      }
    }
    this.world.shake(80, 0.005);
  }

  private scaled(atk: Atk): number {
    let damage = atk.damage * this.mods.atk;
    if (atk.kind === "heavy") damage *= this.mods.heavyMul;
    if (atk.id === "l2" || atk.id === "finisher") damage *= this.mods.comboMul;
    return damage;
  }

  private hitRect(atk: Atk): { x: number; y: number; w: number; h: number } {
    return { x: this.x + this.facing * atk.ox, y: this.y + atk.oy, w: atk.w, h: atk.h };
  }

  private pose(progress: number): void {
    let anim = "idle";
    let loop = true;
    if (this.action === "dead") {
      anim = "dead";
      loop = false;
    } else if (this.action === "hit") {
      anim = "hit";
      loop = false;
    } else if (this.action === "dodge") {
      anim = "dodge";
      loop = false;
    } else if (this.action === "attack" || this.action === "special") {
      anim = this.attackId === "special" ? "special" : this.attackId;
      loop = false;
    } else if (this.action === "jump") anim = "jump";
    else if (this.action === "fall") anim = "fall";
    else if (this.action === "run") anim = "run";
    const frame = loop
      ? loopFrame("player", anim, this.animT, anim === "run" ? 10 : 6)
      : playFrame("player", anim, this.action === "dead" ? 1 : progress);
    this.setFrame(frame);
    this.setFlipX(this.facing < 0);
    this.setDepth(10 + this.y * 0.0001);
  }
}
