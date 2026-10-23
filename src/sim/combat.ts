import { TILE } from '../core/constants';
import { overlap, type Rect } from '../core/math';
import { t } from '../data/strings';
import { getMove, isActiveFrame, type MoveDef } from '../data/weapons';
import { goldAmount, hasRelic } from './loot';
import type { Enemy, Player, Run } from './model';
import { currentRoom, hurtbox } from './world';

export function playerHurtbox(p: Player): Rect {
  return hurtbox(p.x, p.y, p.w, p.h);
}

export function enemyHurtbox(e: Enemy): Rect {
  return hurtbox(e.x, e.y, e.w, e.h);
}

export function moveHitbox(p: Player, move: MoveDef): Rect {
  const hb = move.hitbox;
  const x = p.facing === 1 ? p.x + hb.x : p.x - hb.x - hb.w;
  return { x, y: p.y + hb.y, w: hb.w, h: hb.h };
}

function enemyAttackBox(e: Enemy): Rect | null {
  const a = e.attack;
  if (!a || a.def.damage <= 0) return null;
  if (a.frame < a.def.telegraph || a.frame >= a.def.telegraph + a.def.active) return null;
  const w = a.def.reach;
  const off = a.def.xOff ?? 4;
  const x = a.facing === 1 ? e.x + off : e.x - off - w;
  return { x, y: e.y + a.def.y, w, h: a.def.h };
}

function pushFx(run: Run, kind: string, x: number, y: number, facing?: 1 | -1): void {
  run.events.push({ t: 'fx', kind, x, y, facing });
}

export function swingKind(weapon: string, move: { id: string; plunge?: boolean }): string {
  if (move.plunge || move.id === 'plunge') return 'plunge';
  if (move.id === 'l3' || move.id === 'l4' || move.id === 'airHeavy') return weapon === 'dagger' ? 'slashDagger' : 'slashUp';
  if (move.id === 'heavy' || move.id === 'heavyFull') return weapon === 'dagger' ? 'slashDagger' : weapon === 'hammer' ? 'slashHammer' : 'slashSword';
  if (weapon === 'hammer') return 'slashHammer';
  if (weapon === 'dagger') return 'slashDagger';
  return 'slashSword';
}

function impactId(weapon: string, move: { id: string; hitstop: number }): string {
  const heavy = move.hitstop >= 9 || move.id === 'heavy' || move.id === 'heavyFull' || move.id === 'plunge';
  if (weapon === 'hammer') return heavy ? 'hitHammer' : 'hitHammerLight';
  if (weapon === 'dagger') return 'hitDagger';
  return heavy ? 'hitSwordHeavy' : 'hitSword';
}

export function hurtPlayer(
  run: Run,
  raw: number,
  kbX: number,
  kbY: number,
  src: string,
  opts?: { pierceArmor?: boolean; contact?: boolean },
): boolean {
  const p = run.player;
  if (p.state === 'dead') return false;
  if (p.invuln > 0 || p.iFrame) return false;
  let amount = raw * (1 - run.charDr);
  if (hasRelic(run, 'glass')) amount *= 1.2;
  amount = Math.max(1, Math.round(amount));
  if (opts?.contact) {
    p.hp -= amount;
    p.invuln = Math.max(p.invuln, 48);
    if (!p.action && !p.charging) {
      p.stun = 8;
      p.state = 'hurt';
      p.vx = kbX;
      p.vy = Math.min(p.vy, -0.8);
      p.grounded = false;
    } else {
      p.vx += kbX * 0.25;
    }
    run.lastHit = src;
    run.hitstop = Math.max(run.hitstop, 3);
    run.shake = Math.min(4, run.shake + 1.1);
    run.events.push({ t: 'float', text: String(amount), x: p.x, y: p.y - p.h - 4, color: '#ffb0a0' });
    run.events.push({ t: 'sfx', id: 'hurt' });
    pushFx(run, 'hit', p.x, p.y - p.h * 0.55, kbX < 0 ? -1 : 1);
    if (p.hp <= 0) killOrStand(run, src);
    return true;
  }
  if (p.armor && !opts?.pierceArmor) {
    p.hp -= amount;
    p.invuln = Math.max(p.invuln, 8);
    run.events.push({ t: 'float', text: String(amount), x: p.x, y: p.y - p.h, color: '#ffb0a0' });
    run.events.push({ t: 'sfx', id: 'hurt' });
    run.lastHit = src;
    if (p.hp <= 0) killOrStand(run, src);
    return true;
  }
  p.hp -= amount;
  p.invuln = 30;
  p.stun = 14;
  p.action = null;
  p.charging = false;
  p.state = 'hurt';
  p.vx = kbX;
  p.vy = kbY < 0 ? kbY : -2.3;
  p.grounded = false;
  run.lastHit = src;
  run.hitstop = Math.max(run.hitstop, 6);
  run.shake = Math.min(7, run.shake + 3.2);
  run.events.push({ t: 'float', text: String(amount), x: p.x, y: p.y - p.h - 4, color: '#ff8070' });
  run.events.push({ t: 'sfx', id: 'hurt' });
  pushFx(run, 'hit', p.x, p.y - p.h * 0.6);
  if (hasRelic(run, 'thorns')) {
    const nearest = [...run.enemies].filter((e) => e.alive).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (nearest && Math.abs(nearest.x - p.x) < 70) chipEnemy(run, nearest, 5);
  }
  if (p.hp <= 0) killOrStand(run, src);
  return true;
}

function killOrStand(run: Run, src: string): void {
  const p = run.player;
  if (hasRelic(run, 'undying') && !run.lastStandUsed) {
    p.hp = 1;
    p.invuln = 72;
    p.stun = 0;
    p.state = 'idle';
    run.lastStandUsed = true;
    run.events.push({ t: 'float', text: t('lastStand'), x: p.x, y: p.y - 50, color: '#ffd29a' });
    run.events.push({ t: 'sfx', id: 'parry' });
    run.shake = Math.min(8, run.shake + 4);
    return;
  }
  p.hp = 0;
  p.state = 'dead';
  p.action = null;
  p.charging = false;
  p.stun = 0;
  p.vx = 0;
  run.mode = 'dying';
  run.deathTimer = 0;
  run.lastHit = src;
  run.events.push({ t: 'sfx', id: 'death' });
}

function chipEnemy(run: Run, e: Enemy, dmg: number): void {
  if (!e.alive || e.kind === 'dummy') return;
  e.hp -= dmg;
  e.flash = 2;
  if (e.hp <= 0) killEnemy(run, e);
}

export function killEnemy(run: Run, e: Enemy): void {
  if (!e.alive) return;
  if (e.kind === 'dummy') {
    e.hp = Math.max(1, e.hp);
    return;
  }
  e.alive = false;
  e.hp = 0;
  e.attack = null;
  e.stun = 0;
  e.deadTimer = 0;
  e.anim = 'dead';
  e.animFrame = 0;
  const gold = goldAmount(e.gold, run, `${run.roomId}:${e.eid}`);
  run.gold += gold;
  run.stats.kills += 1;
  if (e.boss) run.stats.bosses += 1;
  if (hasRelic(run, 'sip')) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 3);
  }
  run.events.push({ t: 'float', text: t('goldGet', { n: gold }), x: e.x, y: e.y - e.h - 8, color: '#f0c85c' });
  run.events.push({ t: 'sfx', id: e.boss ? 'bossDie' : 'die' });
  pushFx(run, 'burst', e.x, e.y - e.h * 0.5);
  run.shake = Math.min(8, run.shake + (e.boss ? 6 : e.elite ? 3 : 1.4));
}

function outgoing(run: Run, move: MoveDef, target: Enemy, riposte: boolean): number {
  let d = move.damage * run.charDmg * (1 + run.attackBonus);
  if (hasRelic(run, 'glass')) d *= 1.3;
  const finisher = move.id === 'l3' || move.id === 'l4';
  if (hasRelic(run, 'brand') && finisher) d *= 1.4;
  if (hasRelic(run, 'warrant') && (target.elite || target.boss)) d *= 1.2;
  if (riposte) d *= 1.35;
  if (move.id === 'heavy' || move.id === 'heavyFull') {
    if (hasRelic(run, 'shock')) d *= 1.1;
  }
  const decay = hasRelic(run, 'openSky') ? 0.93 : 0.84;
  if (target.juggle > 0) d *= Math.pow(decay, target.juggle);
  return Math.max(1, Math.round(d));
}

function applyPlayerHit(run: Run, e: Enemy, move: MoveDef, riposte: boolean): void {
  if (!e.alive) return;
  const p = run.player;
  const dmg = outgoing(run, move, e, riposte);
  let poiseDmg = move.poise;
  let stun = move.hitstun;
  if ((move.id === 'heavy' || move.id === 'heavyFull') && hasRelic(run, 'shock')) {
    poiseDmg += 10;
    stun += 8;
  }
  e.hp -= dmg;
  e.flash = 8;
  e.hitByPlayer = true;
  e.poise -= poiseDmg;
  e.poiseRecover = 90;
  const inTele = !!(e.attack && e.attack.frame < e.attack.def.telegraph && e.attack.def.interruptible);
  const inArmor = !!(e.attack && e.attack.frame >= e.attack.def.telegraph && e.attack.frame < e.attack.def.telegraph + e.attack.def.active && e.attack.def.armor);
  let flinched = false;
  if (e.kind !== 'dummy' && e.hp <= 0) {
    killEnemy(run, e);
  } else if (e.kind === 'dummy') {
    e.hp = Math.max(1, e.hp);
    flinched = true;
  } else if (inTele) {
    e.attack = null;
    e.stun = e.boss ? 10 : 16;
    flinched = true;
  } else if (!inArmor && (e.flinch === 'always' || e.poise <= 0)) {
    e.attack = null;
    e.stun = stun;
    e.poise = e.poiseMax;
    flinched = true;
  }
  if (flinched) {
    const launch = move.launch || move.kbY < -1;
    e.vx = move.kbX * p.facing;
    if (launch || !e.grounded) {
      const lift = move.kbY < 0 ? move.kbY : -3.2;
      e.vy = e.juggle > 0 ? Math.min(lift + e.juggle * 0.35, -1.4) : lift;
      e.grounded = false;
      e.juggle += 1;
    } else if (move.kbY < 0) {
      e.vy = move.kbY;
      e.grounded = false;
    }
  }
  run.combo += 1;
  run.comboTimer = 50;
  run.stats.maxCombo = Math.max(run.stats.maxCombo, run.combo);
  const gain = hasRelic(run, 'flow') ? Math.round(move.energy * 1.5) : move.energy;
  run.energy = Math.min(run.energyMax, run.energy + gain);
  p.hitCancel = 10;
  p.hitThisFrame = true;
  if (riposte) p.riposte = 0;
  run.hitstop = Math.max(run.hitstop, move.hitstop);
  run.shake = Math.min(8, run.shake + Math.min(5, move.hitstop * 0.45));
  const hx = (playerHurtbox(p).x + enemyHurtbox(e).x) / 2 + (p.facing === 1 ? 10 : -10);
  const hy = e.y - e.h * 0.65;
  run.events.push({ t: 'float', text: String(dmg), x: e.x, y: e.y - e.h - 6, color: move.launch ? '#ffd29a' : '#fff4e8' });
  run.events.push({ t: 'slash', x: hx, y: hy, facing: p.facing, kind: swingKind(run.weapon, move) });
  run.events.push({ t: 'sfx', id: impactId(run.weapon, move) });
  pushFx(run, swingKind(run.weapon, move), hx, hy, p.facing);
  pushFx(run, move.hitstop >= 9 ? 'burst' : 'hit', hx, hy - 4, p.facing);
  if ((move.id === 'l3' || move.id === 'l4') && hasRelic(run, 'brand') && hasRelic(run, 'openSky')) {
    run.followups.push({ delay: 7, damage: 8, x: e.x, y: e.y - 20, facing: p.facing, w: 36, h: 28 });
    run.events.push({ t: 'float', text: t('bonusSlash'), x: e.x, y: e.y - e.h - 22, color: '#ff9a4a' });
  }
  if (run.tutorial && (move.id === 'l3' || move.id === 'l4')) run.tutFlags.combo = true;
  if (run.tutorial && move.plunge) run.tutFlags.plunge = true;
  if (move.bounce && p.action?.id === move.id) {
    p.vy = move.bounce;
    p.grounded = false;
    p.jumpCut = false;
  }
}

function parrySuccess(run: Run, e: Enemy | null): void {
  const p = run.player;
  if (e && e.attack && !e.attack.parried) {
    e.attack.parried = true;
    e.attack = null;
    e.stun = e.boss ? 22 : 28;
    e.vx = -e.facing * 1.4;
  }
  p.riposte = 46;
  let energy = 18;
  if (hasRelic(run, 'parryEmber')) {
    energy += 15;
    p.hp = Math.min(p.maxHp, p.hp + 4);
  }
  run.energy = Math.min(run.energyMax, run.energy + energy);
  if (hasRelic(run, 'parryEmber') && hasRelic(run, 'flame')) {
    p.empowered = Math.max(1, p.empowered);
    run.events.push({ t: 'float', text: t('empowered'), x: p.x, y: p.y - 62, color: '#ffb15a' });
  }
  run.hitstop = Math.max(run.hitstop, 8);
  run.shake = Math.min(6, run.shake + 2);
  run.events.push({ t: 'sfx', id: 'parry' });
  run.events.push({ t: 'float', text: t('parryHint'), x: p.x, y: p.y - 48, color: '#fff1c2' });
  pushFx(run, 'parry', p.x + p.facing * 12, p.y - 20, p.facing);
  if (run.tutorial) run.tutFlags.parry = true;
}

function perfectDodge(run: Run): void {
  const p = run.player;
  run.energy = Math.min(run.energyMax, run.energy + 14);
  run.hitstop = Math.max(run.hitstop, 4);
  run.events.push({ t: 'sfx', id: 'dodge' });
  run.events.push({ t: 'float', text: t('dodgeHint'), x: p.x, y: p.y - 42, color: '#bfe9ff' });
  pushFx(run, 'dodge', p.x, p.y - 16, p.facing);
}

export function resolveCombat(run: Run): void {
  const p = run.player;
  p.hitThisFrame = false;
  for (const e of run.enemies) e.hitByPlayer = false;

  for (let i = run.followups.length - 1; i >= 0; i--) {
    const f = run.followups[i]!;
    f.delay--;
    if (f.delay > 0) continue;
    run.followups.splice(i, 1);
    const box = { x: f.x - f.w / 2, y: f.y - f.h / 2, w: f.w, h: f.h };
    for (const e of run.enemies) {
      if (!e.alive) continue;
      if (!overlap(box, enemyHurtbox(e))) continue;
      chipEnemy(run, e, f.damage);
      e.flash = 2;
      run.events.push({ t: 'float', text: String(f.damage), x: e.x, y: e.y - e.h, color: '#ffb070' });
    }
    pushFx(run, 'spark', f.x, f.y, f.facing);
  }

  if (p.action && p.action.id !== 'heal' && p.state !== 'dead') {
    const move = getMove(run.weapon, p.action.id);
    if (move.multiEvery && p.action.frame >= move.startup && (p.action.frame - move.startup) % move.multiEvery === 0) {
      p.action.hit = [];
    }
    const attacking = isActiveFrame(move, p.action.frame) && move.special !== 'parry' && (move.damage > 0 || p.action.id === 'dash');
    if (attacking && (move.damage > 0 || p.action.empowered || (p.action.id === 'dash' && hasRelic(run, 'flame')))) {
      const box = moveHitbox(p, move);
      const dashHit = p.action.id === 'dash';
      const dmgMove: MoveDef = dashHit
        ? { ...move, damage: p.action.empowered ? 14 : 5, poise: 6, hitstun: 10, kbX: 1.6, energy: 2, hitstop: 3 }
        : move;
      if (!dashHit || p.action.empowered || hasRelic(run, 'flame')) {
        for (const e of run.enemies) {
          if (!e.alive || p.action.hit.includes(e.eid)) continue;
          if (!overlap(box, enemyHurtbox(e))) continue;
          p.action.hit.push(e.eid);
          if (dmgMove.damage > 0) applyPlayerHit(run, e, dmgMove, p.action.riposte);
        }
        breakCracks(run, box);
      }
    }
    if (move.special === 'parry' && isActiveFrame(move, p.action.frame)) {
      const hb = playerHurtbox(p);
      for (const e of run.enemies) {
        if (!e.alive || !e.attack || e.attack.parried) continue;
        const box = enemyAttackBox(e);
        if (box && overlap(box, hb)) parrySuccess(run, e);
      }
      for (const proj of run.projectiles) {
        if (proj.team !== 'enemy' || proj.life <= 0) continue;
        const box = { x: proj.x - proj.w / 2, y: proj.y - proj.h / 2, w: proj.w, h: proj.h };
        if (overlap(box, hb)) {
          proj.life = 0;
          parrySuccess(run, null);
        }
      }
    }
  }

  const hb = playerHurtbox(p);
  if (p.iFrame) {
    for (const e of run.enemies) {
      if (!e.alive || !e.attack || e.attack.dodged) continue;
      const box = enemyAttackBox(e);
      if (box && overlap(box, hb)) {
        e.attack.dodged = true;
        perfectDodge(run);
      }
    }
  } else if (p.invuln <= 0 && p.state !== 'dead') {
    for (const e of run.enemies) {
      if (!e.alive || !e.attack || e.attack.hitPlayer || e.attack.parried) continue;
      const box = enemyAttackBox(e);
      if (!box || !overlap(box, hb)) continue;
      e.attack.hitPlayer = true;
      const d = e.attack.def;
      hurtPlayer(run, Math.round(d.damage * e.dmgScale), d.kbX * e.attack.facing, d.kbY, e.name);
    }
  }

  for (const proj of run.projectiles) {
    if (proj.life <= 0) continue;
    const box = { x: proj.x - proj.w / 2, y: proj.y - proj.h / 2, w: proj.w, h: proj.h };
    if (proj.team === 'enemy') {
      if (p.state === 'dead' || proj.hit.includes(-1)) continue;
      if (!overlap(box, hb)) continue;
      if (p.iFrame) {
        if (!proj.hit.includes(-2)) {
          proj.hit.push(-2);
          perfectDodge(run);
        }
        continue;
      }
      const parrying = p.action && p.action.id !== 'heal' && getMove(run.weapon, p.action.id).special === 'parry';
      if (parrying && p.action && isActiveFrame(getMove(run.weapon, p.action.id), p.action.frame)) {
        proj.life = 0;
        parrySuccess(run, null);
        continue;
      }
      if (proj.tick > 0) {
        if (proj.tickCd > 0) continue;
        proj.tickCd = proj.tick;
      } else proj.hit.push(-1);
      hurtPlayer(run, proj.damage, Math.sign(proj.vx) * proj.kbX || proj.kbX, proj.kbY, t('enemyWord'));
      if (proj.tick <= 0) proj.life = 0;
    } else {
      for (const e of run.enemies) {
        if (!e.alive || proj.hit.includes(e.eid)) continue;
        if (!overlap(box, enemyHurtbox(e))) continue;
        proj.hit.push(e.eid);
        const fake: MoveDef = {
          ...getMove(run.weapon, 'l1'),
          id: 'proj',
          damage: proj.damage,
          poise: proj.poise,
          hitstun: 10,
          kbX: proj.kbX,
          kbY: proj.kbY,
          hitstop: proj.hitstop,
          energy: 2,
          launch: false,
        };
        applyPlayerHit(run, e, fake, false);
        if (proj.tick <= 0) proj.life = 0;
      }
    }
  }

  if (p.invuln <= 0 && !p.iFrame && p.state !== 'dead') {
    for (const e of run.enemies) {
      if (!e.alive || e.contact <= 0 || e.contactCd > 0 || e.stun > 0 || e.hitByPlayer) continue;
      if (!overlap(playerHurtbox(p), enemyHurtbox(e))) continue;
      const dir = p.x < e.x ? -1 : 1;
      const hit = hurtPlayer(run, Math.round(e.contact * e.dmgScale), dir * 1.35, -0.45, e.name, { contact: true });
      if (hit) e.contactCd = 64;
    }
  }

  for (const e of run.enemies) {
    if (e.contactCd > 0) e.contactCd--;
    if (e.poiseRecover > 0) {
      e.poiseRecover--;
      if (e.poiseRecover === 0 && e.alive) e.poise = e.poiseMax;
    }
  }
}

function breakCracks(run: Run, box: Rect): void {
  const room = currentRoom(run);
  const x0 = Math.floor(box.x / TILE);
  const y0 = Math.floor(box.y / TILE);
  const x1 = Math.floor((box.x + box.w) / TILE);
  const y1 = Math.floor((box.y + box.h) / TILE);
  let hit = false;
  for (let ty = y0; ty <= y1; ty++) {
    const row = room.grid[ty];
    if (!row) continue;
    for (let tx = x0; tx <= x1; tx++) {
      if (row[tx] === 'x') {
        row[tx] = '.';
        hit = true;
      }
    }
  }
  if (!hit) return;
  room.secretOpen = true;
  for (const dir of ['l', 'r', 'u', 'd'] as const) {
    if (!room.secret[dir]) continue;
    const nid = room.doors[dir];
    if (!nid) continue;
    const other = run.floors[run.floorIndex]?.rooms.find((r) => r.id === nid);
    if (!other) continue;
    other.secretOpen = true;
    other.seen = true;
    for (const row of other.grid) {
      for (let i = 0; i < row.length; i++) if (row[i] === 'x') row[i] = '.';
    }
  }
  run.roomRevision++;
  run.events.push({ t: 'sfx', id: 'break' });
  run.events.push({ t: 'float', text: t('secretFound'), x: run.player.x, y: run.player.y - 40, color: '#e7b6ff' });
  run.shake = Math.min(5, run.shake + 1.5);
}

export function spawnShockwave(run: Run, dir: 1 | -1 | 0, big: boolean): void {
  const p = run.player;
  const dirs: Array<1 | -1> = dir === 0 ? [1, -1] : [dir];
  const meteor = hasRelic(run, 'star') && hasRelic(run, 'shock');
  for (const d of dirs) {
    run.projectiles.push({
      id: run.nextPid++,
      kind: 'wave',
      x: p.x + d * 16,
      y: p.y - 8,
      vx: d * (big || meteor ? 3.4 : 2.8),
      vy: 0,
      w: meteor ? 28 : big ? 22 : 16,
      h: 14,
      damage: meteor ? 16 : big ? 12 : 8,
      team: 'player',
      life: meteor ? 28 : 22,
      poise: meteor ? 16 : 8,
      kbX: 2.2,
      kbY: -0.6,
      hitstop: meteor ? 6 : 4,
      hit: [],
      tick: 0,
      tickCd: 0,
      gravity: 0,
      ground: true,
      owner: -1,
    });
  }
  run.events.push({ t: 'fx', kind: meteor ? 'boom' : 'wave', x: p.x, y: p.y - 6 });
  if (meteor) run.events.push({ t: 'float', text: t('meteor'), x: p.x, y: p.y - 36, color: '#ffd29a' });
}
