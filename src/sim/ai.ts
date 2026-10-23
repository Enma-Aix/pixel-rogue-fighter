import { TILE, GRAVITY, MAX_FALL } from '../core/constants';
import { clamp } from '../core/math';
import { t } from '../data/strings';
import { enemyDef, type AttackDef, type EnemyDef } from '../data/enemies';
import type { Enemy, EnemyAttack, Run } from './model';
import { moveBody } from './collision';
import { currentRoom } from './world';

export function makeEnemy(run: Run, kind: string, x: number, y: number, cursed: boolean): Enemy {
  const def = enemyDef(kind);
  const floor = run.floorIndex;
  const hpScale = (kind === 'dummy' ? 1 : 1 + floor * 0.2) * (cursed && kind !== 'dummy' ? 1.22 : 1);
  const dmgScale = (kind === 'dummy' ? 1 : 1 + floor * 0.08) * (cursed && kind !== 'dummy' ? 1.15 : 1);
  return {
    eid: run.nextEid++,
    kind,
    name: def.name,
    x,
    y,
    vx: 0,
    vy: 0,
    w: def.w,
    h: def.h,
    facing: x < run.player.x ? 1 : -1,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    poise: def.poise,
    poiseMax: def.poise,
    poiseRecover: 0,
    grounded: !def.fly,
    alive: true,
    fly: !!def.fly,
    elite: !!def.elite,
    boss: !!def.boss,
    flinch: def.flinch,
    stun: 0,
    flash: 0,
    invuln: 0,
    juggle: 0,
    cd: 20 + (run.nextEid % 15),
    atkCd: {},
    attack: null,
    contact: def.contact,
    contactCd: 10,
    dmgScale,
    phase: 1,
    didP2: false,
    didP3: false,
    summoned: false,
    frame: 0,
    anim: 'idle',
    animFrame: 0,
    deadTimer: 0,
    homeY: y,
    gold: def.gold,
    behavior: def.behavior,
    speed: def.speed,
    hitByPlayer: false,
  };
}

function syncEnemyAnim(e: Enemy): void {
  if (!e.alive) {
    e.anim = 'dead';
    e.animFrame = Math.min(5, Math.floor(e.deadTimer / 4));
    return;
  }
  if (e.stun > 0) {
    e.anim = 'hurt';
    e.animFrame = Math.min(2, e.stun % 3);
    return;
  }
  if (e.attack) {
    const tele = e.attack.def.telegraph;
    e.anim = e.attack.frame < tele ? 'telegraph' : 'attack';
    e.animFrame = e.attack.frame < tele ? Math.min(3, Math.floor((e.attack.frame / Math.max(1, tele)) * 4)) : Math.min(5, Math.floor((e.attack.frame - tele) / 2));
    return;
  }
  if (e.fly || Math.abs(e.vx) > 0.2) {
    e.anim = e.fly ? 'walk' : 'walk';
    e.animFrame = Math.floor(e.frame / 5) % 8;
    return;
  }
  e.anim = 'idle';
  e.animFrame = Math.floor(e.frame / 8) % 6;
}

/** Jump onto a ledge the player is camping. Flat chases stay on the ground. */
function chaseHop(e: Enemy, playerY: number, playerGrounded: boolean, dir: 1 | -1, dist: number): boolean {
  if (!e.boss || e.fly || !e.grounded || !playerGrounded) return false;
  const rise = e.y - playerY;
  if (rise < 36 || dist > 128) return false;
  e.vy = -6.5;
  e.vx = dir * Math.max(1.55, e.speed * 1.35);
  e.grounded = false;
  return true;
}

function pickAttack(run: Run, e: Enemy, def: EnemyDef, dist: number): AttackDef | null {
  if (e.cd > 0) return null;
  const options = def.attacks.filter((a) => {
    if ((a.minPhase ?? 1) > e.phase) return false;
    if ((e.atkCd[a.id] ?? 0) > 0) return false;
    if (dist < a.rangeMin || dist > a.rangeMax) return false;
    return true;
  });
  if (!options.length) return null;
  const total = options.reduce((s, a) => s + a.weight, 0);
  let roll = ((run.time + e.eid * 17) % 1000) / 1000 * total;
  for (const a of options) {
    roll -= a.weight;
    if (roll <= 0) return a;
  }
  return options[0] ?? null;
}

function startAttack(run: Run, e: Enemy, def: AttackDef): void {
  const p = run.player;
  const room = currentRoom(run);
  const facing: 1 | -1 = p.x >= e.x ? 1 : -1;
  e.facing = facing;
  let destX = clamp(p.x, 36, room.w * TILE - 36);
  let destY = p.y;
  if (def.teleport) {
    destX = clamp(p.x + (p.x >= e.x ? -8 : 8), 40, room.w * TILE - 40);
  }
  const attack: EnemyAttack = {
    id: def.id,
    frame: 0,
    def,
    hitPlayer: false,
    facing,
    destX,
    destY,
    serial: ++run.serial,
    parried: false,
    dodged: false,
  };
  e.attack = attack;
  e.cd = 8;
  const life = def.telegraph;
  if (def.leap || def.shockwave) {
    run.telegraphs.push({
      x: destX - def.reach * 0.5,
      y: (room.h - 1) * TILE - 18,
      w: def.reach,
      h: 16,
      life,
      max: life,
      kind: 'rect',
    });
  } else if (def.projectile && (def.projectile.pattern === 'aim' || def.projectile.pattern === 'fan' || def.projectile.pattern === 'both' || def.projectile.pattern === 'ground')) {
    const dist = Math.min(300, Math.max(96, Math.abs(p.x - e.x) + 36));
    const h = Math.max(10, def.h);
    const y = e.y + def.y;
    run.telegraphs.push({
      x: facing === 1 ? e.x : e.x - dist,
      y,
      w: dist,
      h,
      life,
      max: life,
      kind: 'rect',
    });
  } else if (def.teleport || def.projectile?.pattern === 'zone' || def.projectile?.pattern === 'ring') {
    const w = def.projectile?.pattern === 'zone' ? 36 : 28;
    run.telegraphs.push({
      x: (def.projectile?.pattern === 'zone' ? destX : e.x) - w / 2,
      y: (def.projectile?.pattern === 'zone' ? (room.h - 1) * TILE - 16 : e.y - e.h * 0.5) - w / 2,
      w,
      h: w,
      life,
      max: life,
      kind: def.projectile?.pattern === 'ring' || def.teleport ? 'circle' : 'rect',
    });
  } else {
    const w = def.reach;
    const x = facing === 1 ? e.x + (def.xOff ?? 4) : e.x - (def.xOff ?? 4) - w;
    run.telegraphs.push({ x, y: e.y + def.y, w, h: def.h, life, max: life, kind: 'rect' });
  }
  run.events.push({ t: 'sfx', id: e.boss ? 'teleBoss' : 'tele' });
}

function spawnProjectile(run: Run, e: Enemy, def: AttackDef): void {
  const spec = def.projectile;
  if (!spec) return;
  const room = currentRoom(run);
  const base = e.attack?.facing ?? e.facing;
  const dmg = Math.max(1, Math.round(spec.damage * e.dmgScale));
  const make = (vx: number, vy: number, x: number, y: number, kind = spec.kind) => {
    run.projectiles.push({
      id: run.nextPid++,
      kind,
      x,
      y,
      vx,
      vy,
      w: spec.w,
      h: spec.h,
      damage: dmg,
      team: 'enemy',
      life: spec.life,
      poise: 6,
      kbX: 1.6,
      kbY: -0.4,
      hitstop: 4,
      hit: [],
      tick: spec.tick ?? 0,
      tickCd: 0,
      gravity: spec.gravity ?? 0,
      ground: spec.pattern === 'ground' || spec.pattern === 'both' || spec.pattern === 'zone',
      owner: e.eid,
    });
  };
  if (spec.pattern === 'aim') {
    make(base * spec.speed, 0, e.x + base * 12, e.y - e.h * 0.65);
  } else if (spec.pattern === 'fan') {
    const n = spec.count;
    for (let i = 0; i < n; i++) {
      const ang = -spec.spread / 2 + (spec.spread * i) / Math.max(1, n - 1);
      const vx = Math.cos(ang) * spec.speed * base;
      const vy = Math.sin(ang) * spec.speed;
      make(vx, vy, e.x + base * 10, e.y - e.h * 0.6);
    }
  } else if (spec.pattern === 'ring') {
    for (let i = 0; i < spec.count; i++) {
      const ang = (Math.PI * 2 * i) / spec.count;
      make(Math.cos(ang) * spec.speed, Math.sin(ang) * spec.speed, e.x, e.y - e.h * 0.45, spec.kind);
    }
    if (def.id === 'nova') {
      for (let i = 0; i < spec.count; i++) {
        const ang = (Math.PI * 2 * i) / spec.count + 0.2;
        make(Math.cos(ang) * (spec.speed * 0.55), Math.sin(ang) * (spec.speed * 0.55), e.x, e.y - e.h * 0.45, spec.kind);
      }
    }
  } else if (spec.pattern === 'both' || spec.pattern === 'ground') {
    const dirs = spec.pattern === 'both' ? [1, -1] : [base];
    for (const d of dirs) make(d * spec.speed, 0, e.x + d * 18, (room.h - 1) * TILE - 10);
  } else if (spec.pattern === 'zone') {
    const spots = spec.count;
    for (let i = 0; i < spots; i++) {
      const spread = (i - (spots - 1) / 2) * 70;
      const x = clamp((e.attack?.destX ?? run.player.x) + spread, 30, room.w * TILE - 30);
      make(0, 0, x, (room.h - 1) * TILE - 10, 'zone');
    }
  }
}

function summon(run: Run, e: Enemy, kind: string): void {
  const alive = run.enemies.filter((n) => n.alive).length;
  if (alive >= 4) return;
  const room = currentRoom(run);
  const x = clamp(e.x + e.facing * 48, 40, room.w * TILE - 40);
  const y = (room.h - 1) * TILE - 0.01;
  const add = makeEnemy(run, kind, x, y, false);
  add.hp = Math.round(add.hp * 0.85);
  add.maxHp = add.hp;
  run.enemies.push(add);
  run.events.push({ t: 'float', text: t('summon'), x: e.x, y: e.y - e.h, color: '#ffb089' });
}

function shiftPhase(run: Run, e: Enemy, phase: number): void {
  e.phase = phase;
  e.attack = null;
  e.stun = 52;
  e.invuln = 52;
  e.vx = 0;
  run.hitstop = Math.max(run.hitstop, 10);
  run.shake = Math.min(8, run.shake + 5);
  run.events.push({ t: 'sfx', id: 'roar' });
  run.events.push({ t: 'phase', id: String(phase), x: e.x, y: e.y - e.h });
  run.events.push({
    t: 'float',
    text: phase >= 3 ? t('phase3') : t('phase2'),
    x: e.x,
    y: e.y - e.h - 10,
    color: '#ffd29a',
  });
  if (e.kind === 'boss2' && phase === 2 && !e.summoned) {
    e.summoned = true;
    const room = currentRoom(run);
    const y = 7 * TILE;
    run.enemies.push(makeEnemy(run, 'flea', clamp(e.x - 50, 30, room.w * TILE - 30), y, false));
    run.enemies.push(makeEnemy(run, 'flea', clamp(e.x + 50, 30, room.w * TILE - 30), y, false));
  }
}

function checkPhase(run: Run, e: Enemy): void {
  if (!e.boss || !e.alive) return;
  const ratio = e.hp / e.maxHp;
  if (e.kind === 'boss3') {
    if (!e.didP2 && ratio <= 0.66) {
      e.didP2 = true;
      shiftPhase(run, e, 2);
    } else if (!e.didP3 && ratio <= 0.33) {
      e.didP3 = true;
      shiftPhase(run, e, 3);
    }
  } else if (!e.didP2 && ratio <= (e.kind === 'boss2' ? 0.55 : 0.5)) {
    e.didP2 = true;
    shiftPhase(run, e, 2);
  }
}

function physicsEnemy(run: Run, e: Enemy): void {
  const room = currentRoom(run);
  if (e.fly && !e.attack) {
    e.vy += Math.sin((e.frame + e.eid) * 0.08) * 0.05;
    e.y += e.vy;
    e.x += e.vx;
    e.vx *= 0.9;
    e.y = clamp(e.y, e.h + 8, (room.h - 4) * TILE);
  } else {
    if (!e.fly || e.attack) {
      if (!e.grounded) e.vy = Math.min(MAX_FALL, e.vy + GRAVITY);
      else if (e.vy > 0) e.vy = 0;
    }
    // A launched trash enemy on a high ledge would soft-lock the room. Drop back down.
    const stranded = !e.fly && !e.boss && e.y < run.player.y - 80;
    if (stranded && e.grounded) {
      e.vy = 2.2;
      e.grounded = false;
    }
    const res = moveBody(e, room.grid, 'enemy', stranded);
    e.grounded = res.grounded;
    if (e.grounded) e.juggle = 0;
  }
  const minX = 18;
  const maxX = room.w * TILE - 18;
  if (e.x < minX) {
    e.x = minX;
    e.vx = 0;
  }
  if (e.x > maxX) {
    e.x = maxX;
    e.vx = 0;
  }
  if (e.y - e.h < 4) {
    e.y = e.h + 4;
    e.vy = 0;
  }
  if (e.y > room.h * TILE) {
    e.y = (room.h - 1) * TILE - 0.01;
    e.vy = 0;
    e.x = clamp(e.x, minX, maxX);
  }
}

function think(run: Run, e: Enemy, def: EnemyDef): void {
  const p = run.player;
  const dx = p.x - e.x;
  const dist = Math.abs(dx);
  const dir: 1 | -1 = dx >= 0 ? 1 : -1;
  if (e.behavior === 'dummy') {
    e.vx = 0;
    if (run.tutorial && run.tutStep === 4 && e.cd <= 0 && !e.attack) {
      const swipe = def.attacks[0];
      if (swipe) startAttack(run, e, swipe);
    }
    return;
  }
  e.facing = dir;
  if (chaseHop(e, p.y, p.grounded, dir, dist)) return;
  const chosen = pickAttack(run, e, def, dist);
  if (chosen) {
    startAttack(run, e, chosen);
    return;
  }
  const speed = e.speed * (e.boss && e.phase > 1 ? 1.12 : 1);
  if (e.fly) {
    let want = dist < 90 ? -dir : dir;
    const room = currentRoom(run);
    if (e.x < 64) want = 1;
    else if (e.x > room.w * TILE - 64) want = -1;
    if (e.y < p.y - 90) e.vy += 0.16;
    else if (e.y > p.y - 12) e.vy -= 0.08;
    e.vy = clamp(e.vy, -1.2, 1.4);
    e.vx += want * 0.08;
    e.vx = clamp(e.vx, -speed, speed);
    return;
  }
  if (e.behavior === 'ranged' || e.behavior === 'mage') {
    if (dist < 88) e.vx = -dir * speed;
    else if (dist > 200) e.vx = dir * speed;
    else e.vx *= 0.8;
    return;
  }
  if (dist > 36) e.vx = dir * speed;
  else e.vx *= 0.7;
}

function stepAttack(run: Run, e: Enemy): void {
  const a = e.attack;
  if (!a) return;
  a.frame++;
  const d = a.def;
  if (a.frame === d.telegraph) {
    if (d.leap) {
      e.vx = a.facing * d.leap.vx;
      e.vy = d.leap.vy;
      e.grounded = false;
      if (d.id === 'dive' || e.fly) {
        e.x += a.facing * 4;
      }
    }
    if (d.teleport) {
      e.x = a.destX;
      e.facing = run.player.x >= e.x ? 1 : -1;
      a.facing = e.facing;
      run.events.push({ t: 'fx', kind: 'blink', x: e.x, y: e.y - e.h * 0.5, facing: e.facing });
    }
    if (d.projectile) spawnProjectile(run, e, d);
    if (d.summon) summon(run, e, d.summon);
    if (d.shockwave) {
      const room = currentRoom(run);
      for (const dir of [1, -1] as const) {
        run.projectiles.push({
          id: run.nextPid++,
          kind: 'wave',
          x: e.x + dir * 20,
          y: (room.h - 1) * TILE - 10,
          vx: dir * 2.8,
          vy: 0,
          w: e.boss ? 26 : 18,
          h: 14,
          damage: Math.max(1, Math.round(d.damage * 0.7 * e.dmgScale)),
          team: 'enemy',
          life: 36,
          poise: 8,
          kbX: 2,
          kbY: -0.8,
          hitstop: 5,
          hit: [],
          tick: 0,
          tickCd: 0,
          gravity: 0,
          ground: true,
          owner: e.eid,
        });
      }
      run.events.push({ t: 'sfx', id: 'boom' });
      run.shake = Math.min(8, run.shake + (e.boss ? 4 : 2));
    }
  }
  if (a.frame >= d.telegraph && a.frame < d.telegraph + d.active && d.selfMove) {
    e.vx = a.facing * d.selfMove;
  }
  if (a.frame >= d.telegraph + d.active + d.recovery) {
    e.atkCd[d.id] = d.cooldown;
    e.cd = Math.max(e.cd, 10);
    e.attack = null;
  }
}

export function stepEnemies(run: Run): void {
  for (const e of run.enemies) {
    if (e.flash > 0) e.flash--;
    if (!e.alive) {
      e.deadTimer++;
      syncEnemyAnim(e);
      continue;
    }
    e.frame++;
    if (e.invuln > 0) e.invuln--;
    if (e.cd > 0) e.cd--;
    for (const id of Object.keys(e.atkCd)) {
      if ((e.atkCd[id] ?? 0) > 0) e.atkCd[id] = (e.atkCd[id] ?? 0) - 1;
    }
    checkPhase(run, e);
    if (e.stun > 0) {
      e.stun--;
      e.vx *= 0.86;
      physicsEnemy(run, e);
      syncEnemyAnim(e);
      continue;
    }
    const def = enemyDef(e.kind);
    if (e.attack) stepAttack(run, e);
    else think(run, e, def);
    physicsEnemy(run, e);
    syncEnemyAnim(e);
  }
  const alive = run.enemies.filter((e) => e.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i]!;
      const b = alive[j]!;
      if (Math.abs(a.x - b.x) < (a.w + b.w) * 0.45 && Math.abs(a.y - b.y) < 20) {
        const push = a.x <= b.x ? -0.35 : 0.35;
        a.x += push;
        b.x -= push;
      }
    }
  }
}

export function stepProjectiles(run: Run): void {
  const room = currentRoom(run);
  for (const p of run.projectiles) {
    if (p.tickCd > 0) p.tickCd--;
    p.life--;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    if (p.ground) {
      const fy = (room.h - 1) * TILE - 6;
      if (p.y > fy) {
        p.y = fy;
        p.vy = 0;
      }
    }
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor((p.y - 2) / TILE);
    const ch = room.grid[ty]?.[tx];
    if ((ch === '#' || ch === '+' || ch === 'x') && p.kind !== 'zone' && p.kind !== 'flame') p.life = 0;
    if (p.x < -8 || p.x > room.w * TILE + 8 || p.y > room.h * TILE + 20) p.life = 0;
  }
  run.projectiles = run.projectiles.filter((p) => p.life > 0);
}

export function stepTelegraphs(run: Run): void {
  for (const tele of run.telegraphs) tele.life--;
  run.telegraphs = run.telegraphs.filter((tele) => tele.life > 0);
}
