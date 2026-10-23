import {
  ACCEL,
  AIR_ACCEL,
  COYOTE,
  DASH_REGEN,
  FRICTION,
  GRAVITY,
  JUMP_BUFFER,
  JUMP_CUT,
  JUMP_V,
  MAX_FALL,
  RUN_SPEED,
} from '../core/constants';
import { clamp } from '../core/math';
import type { FrameInput } from '../core/types';
import { t } from '../data/strings';
import { WEAPONS, getMove, isActiveFrame, moveLength, nextCombo } from '../data/weapons';
import { hasRelic } from './loot';
import type { Action, Enemy, Run } from './model';
import { hurtPlayer, moveHitbox, spawnShockwave } from './combat';
import { moveBody, onPlatform } from './collision';
import { currentRoom } from './world';

function topSpeed(run: Run): number {
  const weapon = WEAPONS[run.weapon].speed;
  const swift = hasRelic(run, 'swift') ? 1.12 : 1;
  return RUN_SPEED * run.charSpeed * weapon * swift;
}

function attackIndex(frame: number, startup: number, active: number): number {
  if (frame < startup) return frame < startup * 0.5 ? 0 : 1;
  if (frame < startup + active) {
    const t = (frame - startup) / Math.max(1, active);
    return t < 0.5 ? 2 : 3;
  }
  const rec = frame - startup - active;
  if (rec < 4) return 4;
  if (rec < 8) return 5;
  return 6;
}

function syncAnim(run: Run): void {
  const p = run.player;
  if (p.state === 'dead') {
    p.anim = 'dead';
    p.animFrame = Math.min(6, Math.floor(p.frame / 5));
    return;
  }
  if (p.stun > 0) {
    p.anim = 'hurt';
    p.animFrame = Math.min(2, Math.floor(p.frame / 3));
    return;
  }
  if (p.charging) {
    p.anim = 'charge';
    p.animFrame = Math.min(3, Math.floor(p.charge / 8));
    return;
  }
  if (p.action) {
    if (p.action.id === 'heal') {
      p.anim = 'heal';
      p.animFrame = Math.min(3, Math.floor(p.action.frame / 8));
      return;
    }
    p.anim = p.action.id;
    if (p.action.id === 'dash') p.animFrame = Math.min(3, Math.floor(p.action.frame / 3));
    else if (p.action.id === 'parry') p.animFrame = Math.min(3, Math.floor(p.action.frame / 4));
    else {
      const m = getMove(run.weapon, p.action.id);
      p.animFrame = attackIndex(p.action.frame, m.startup, m.active);
    }
    return;
  }
  if (p.state === 'land') {
    p.anim = 'land';
    p.animFrame = Math.min(3, 4 - p.landTick);
    return;
  }
  if (!p.grounded) {
    p.anim = p.vy < 0 ? 'jump' : 'fall';
    p.animFrame = Math.min(2, Math.floor(p.frame / 4));
    return;
  }
  if (Math.abs(p.vx) > 0.25) {
    p.anim = 'run';
    p.animFrame = Math.floor(p.frame / 4) % 8;
    return;
  }
  p.anim = 'idle';
  p.animFrame = Math.floor(p.frame / 8) % 6;
}

function canAct(p: Run['player']): boolean {
  return p.stun <= 0 && p.state !== 'dead' && p.state !== 'hurt';
}

function neutral(p: Run['player']): boolean {
  return canAct(p) && !p.action && !p.charging;
}

function begin(run: Run, id: string): void {
  const p = run.player;
  const riposte = p.riposte > 0 && id !== 'dash' && id !== 'parry' && id !== 'heal';
  if (riposte) p.riposte = 0;
  const empowered = id === 'dash' && p.empowered > 0;
  if (empowered) p.empowered -= 1;
  const action: Action = {
    id,
    frame: riposte && id !== 'skill' ? 1 : 0,
    serial: ++run.serial,
    hit: [],
    riposte,
    empowered,
  };
  p.action = action;
  p.charging = false;
  p.state = id === 'dash' ? 'dash' : id === 'parry' ? 'parry' : id === 'heal' ? 'heal' : 'attack';
  p.atkBuf = 0;
  if (id === 'dash') {
    p.vx = (getMove(run.weapon, 'dash').vx ?? 5.6) * p.facing;
    p.dashCharges = Math.max(0, p.dashCharges - 1);
    if (p.dashRegen <= 0) p.dashRegen = DASH_REGEN;
    if (!p.grounded) p.airOk = false;
    if (run.tutorial) run.tutFlags.dash = true;
    run.events.push({ t: 'sfx', id: 'dash' });
    run.events.push({ t: 'fx', kind: 'dash', x: p.x, y: p.y - 12, facing: p.facing });
  } else if (id === 'parry') run.events.push({ t: 'sfx', id: 'swing' });
  else if (id === 'heal') run.events.push({ t: 'sfx', id: 'heal' });
  else if (id === 'skill') {
    run.energy = Math.max(0, run.energy - WEAPONS[run.weapon].skillCost);
    if (run.tutorial) run.tutFlags.skill = true;
    run.events.push({ t: 'sfx', id: 'skill' });
    const move = getMove(run.weapon, 'skill');
    if (move.special === 'blink') blink(run);
  } else run.events.push({ t: 'sfx', id: id === 'heavy' || id === 'heavyFull' ? 'swingHeavy' : 'swing' });
}

function blink(run: Run): void {
  const p = run.player;
  const room = currentRoom(run);
  let best: Enemy | null = null;
  let bestD = 150;
  for (const e of run.enemies) {
    if (!e.alive) continue;
    const d = Math.abs(e.x - p.x);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  if (best) {
    p.facing = best.x >= p.x ? 1 : -1;
    p.x = best.x + p.facing * 26;
  } else {
    p.x += p.facing * 86;
  }
  const max = room.w * 16 - 20;
  p.x = clamp(p.x, 20, max);
  p.vx = 0;
  run.events.push({ t: 'fx', kind: 'blink', x: p.x, y: p.y - 16, facing: p.facing });
}

function wantsDash(run: Run, input: FrameInput): boolean {
  return (input.dash || run.player.dashBuf > 0) && run.player.dashCharges > 0;
}

function tryCancel(run: Run, input: FrameInput): void {
  const p = run.player;
  const a = p.action;
  if (!a || a.id === 'heal') return;
  const m = getMove(run.weapon, a.id);
  const window = a.frame >= m.cancelAt && a.frame <= m.cancelEnd;
  const hitCancel = p.hitCancel > 0;
  if (wantsDash(run, input) && m.cancelTo.includes('dash') && (window || hitCancel)) {
    if (!p.grounded && !p.airOk) return;
    p.dashBuf = 0;
    begin(run, 'dash');
    return;
  }
  if (!window && !(hitCancel && m.launch && (input.jump || p.jumpBuf > 0))) return;
  if (input.parry && p.grounded && m.cancelTo.includes('parry')) {
    begin(run, 'parry');
    return;
  }
  if ((input.skill || false) && run.energy >= WEAPONS[run.weapon].skillCost && m.cancelTo.includes('skill')) {
    begin(run, 'skill');
    return;
  }
  if ((input.attack || p.atkBuf > 0) && p.grounded) {
    const next = nextCombo(run.weapon, a.id);
    if (next && m.cancelTo.includes(next)) {
      begin(run, next);
      return;
    }
  }
  if (m.launch && hitCancel && (input.jump || p.jumpBuf > 0) && p.coyote > 0) {
    p.action = null;
    doJump(run);
  }
}

function doJump(run: Run): void {
  const p = run.player;
  p.vy = JUMP_V;
  p.grounded = false;
  p.coyote = 0;
  p.jumpBuf = 0;
  p.jumpCut = true;
  p.state = 'jump';
  p.action = null;
  p.charging = false;
  if (run.tutorial) run.tutFlags.jump = true;
  run.events.push({ t: 'sfx', id: 'jump' });
  run.events.push({ t: 'fx', kind: 'dust', x: p.x, y: p.y, facing: p.facing });
}

function tryStart(run: Run, input: FrameInput): void {
  const p = run.player;
  if (!neutral(p)) return;
  const room = currentRoom(run);
  const platform = onPlatform(room.grid, p);
  if (p.grounded && input.y > 0 && input.jump && platform) {
    p.dropTimer = 8;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.vy = 1;
    return;
  }
  if (wantsDash(run, input) && (p.grounded || p.airOk)) {
    p.dashBuf = 0;
    begin(run, 'dash');
    return;
  }
  if (input.parry && p.grounded) {
    begin(run, 'parry');
    return;
  }
  if (input.skill && run.energy >= WEAPONS[run.weapon].skillCost) {
    begin(run, 'skill');
    return;
  }
  if (input.heal && p.grounded && run.flasks > 0 && p.hp < p.maxHp) {
    begin(run, 'heal');
    return;
  }
  const attack = input.attack || p.atkBuf > 0;
  if (input.heavy && p.grounded) {
    p.charging = true;
    p.charge = 0;
    p.state = 'charge';
    return;
  }
  if (attack || (input.heavy && !p.grounded)) {
    if (!p.grounded && input.y > 0) begin(run, 'plunge');
    else if (!p.grounded && input.heavy) begin(run, 'airHeavy');
    else if (!p.grounded) begin(run, 'air');
    else begin(run, 'l1');
  }
}

function stepAction(run: Run, input: FrameInput): void {
  const p = run.player;
  const a = p.action;
  if (!a) return;
  if (a.id === 'heal') {
    p.vx = 0;
    a.frame++;
    if (a.frame === 18 && run.flasks > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + 42);
      run.flasks--;
      run.events.push({ t: 'float', text: t('healGet', { n: 42 }), x: p.x, y: p.y - 40, color: '#8dffb0' });
      run.events.push({ t: 'sfx', id: 'heal2' });
    }
    if (a.frame >= 32) p.action = null;
    return;
  }
  const m = getMove(run.weapon, a.id);
  a.frame++;
  if (m.iStart !== undefined && a.frame >= m.iStart && a.frame < (m.iEnd ?? 0)) p.iFrame = true;
  if (m.armor && isActiveFrame(m, a.frame)) p.armor = true;
  if (m.vx !== undefined && a.frame < m.startup + m.active) p.vx = m.vx * p.facing;
  else if (m.lunge && a.frame < m.startup + m.active) p.vx = m.lunge * p.facing;
  else if (!p.grounded && input.x !== 0 && m.air) {
    p.vx = clamp(p.vx + input.x * AIR_ACCEL, -topSpeed(run) * 0.85, topSpeed(run) * 0.85);
  } else if (p.grounded) p.vx *= 0.82;

  if (m.plunge && a.frame >= m.startup) p.vy = 6.5;
  else if (!p.grounded) p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * (m.gravity ?? 1));

  if (m.special === 'quake' && a.frame === m.startup) spawnShockwave(run, 0, true);
  if (m.special === 'dashStrike' && a.frame === m.startup) {
    run.events.push({ t: 'fx', kind: 'dash', x: p.x, y: p.y - 14, facing: p.facing });
  }
  if (a.id === 'dash' && hasRelic(run, 'flame') && a.frame % 3 === 0) {
    run.projectiles.push({
      id: run.nextPid++,
      kind: 'flame',
      x: p.x - p.facing * 8,
      y: p.y - 8,
      vx: 0,
      vy: 0,
      w: 16,
      h: 16,
      damage: 4,
      team: 'player',
      life: 16,
      poise: 2,
      kbX: 0.4,
      kbY: 0,
      hitstop: 2,
      hit: [],
      tick: 8,
      tickCd: 0,
      gravity: 0,
      ground: true,
      owner: -1,
    });
  }
  if (isActiveFrame(m, a.frame) && a.frame === m.startup) {
    const box = moveHitbox(p, m);
    run.events.push({ t: 'slash', kind: m.id, x: box.x + box.w / 2, y: box.y + box.h / 2, facing: p.facing });
  }
  if (a.frame >= moveLength(m)) p.action = null;
}

function locomote(run: Run, input: FrameInput): void {
  const p = run.player;
  const speed = topSpeed(run);
  if (p.charging) {
    p.charge++;
    if (input.x !== 0) {
      p.facing = input.x > 0 ? 1 : -1;
      p.vx = input.x * speed * 0.38;
    } else p.vx *= 0.6;
    if (input.jump && p.coyote > 0) {
      doJump(run);
      return;
    }
    if (wantsDash(run, input) && (p.grounded || p.airOk)) {
      begin(run, 'dash');
      return;
    }
    if (!input.heavyHeld || p.charge >= 46) {
      begin(run, p.charge >= 24 ? 'heavyFull' : 'heavy');
    }
    if (!p.grounded) p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
    return;
  }
  if (input.x !== 0) {
    const accel = p.grounded ? ACCEL : AIR_ACCEL;
    p.vx += input.x * accel;
    if (Math.abs(p.vx) > 0.2) p.facing = input.x > 0 ? 1 : -1;
  } else if (p.grounded) {
    p.vx *= 1 - FRICTION;
    if (Math.abs(p.vx) < 0.08) p.vx = 0;
  } else p.vx *= 0.985;
  p.vx = clamp(p.vx, -speed, speed);

  const room = currentRoom(run);
  if (p.grounded && input.y > 0 && input.jump && onPlatform(room.grid, p)) {
    p.dropTimer = 8;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.vy = 1;
  } else if (p.jumpBuf > 0 && p.coyote > 0) {
    doJump(run);
  }
  if (!input.jumpHeld && p.jumpCut && p.vy < 0) {
    p.vy *= JUMP_CUT;
    p.jumpCut = false;
  }
  if (!p.grounded) p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
  else if (p.vy > 0) p.vy = 0;

  if (p.state === 'land') {
    p.landTick--;
    if (p.landTick <= 0) p.state = Math.abs(p.vx) > 0.2 ? 'run' : 'idle';
  } else if (!p.grounded) p.state = p.vy < 0 ? 'jump' : 'fall';
  else p.state = Math.abs(p.vx) > 0.2 ? 'run' : 'idle';
}

export function stepPlayer(run: Run, input: FrameInput): void {
  const p = run.player;
  const room = currentRoom(run);
  p.frame++;
  if (p.invuln > 0) p.invuln--;
  if (p.hazardCd > 0) p.hazardCd--;
  if (p.riposte > 0) p.riposte--;
  if (p.hitCancel > 0) p.hitCancel--;
  if (p.dropTimer > 0) p.dropTimer--;
  if (p.dashCharges < run.dashMax) {
    if (p.dashRegen > 0) p.dashRegen--;
    if (p.dashRegen <= 0) {
      p.dashCharges++;
      p.dashRegen = p.dashCharges < run.dashMax ? DASH_REGEN : 0;
    }
  }
  if (input.attack) p.atkBuf = 8;
  if (input.dash) p.dashBuf = 7;
  if (input.jump) p.jumpBuf = JUMP_BUFFER;
  else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.atkBuf > 0) p.atkBuf--;
  if (p.dashBuf > 0) p.dashBuf--;

  if (p.grounded) p.coyote = COYOTE;
  else if (p.coyote > 0) p.coyote--;

  p.iFrame = false;
  p.armor = false;

  if (p.state === 'dead') {
    p.vx *= 0.9;
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
    moveBody(p, room.grid, 'player', false);
    syncAnim(run);
    return;
  }

  if (p.stun > 0) {
    p.stun--;
    p.action = null;
    p.charging = false;
    p.state = 'hurt';
    p.vx *= 0.9;
    if (!p.grounded) p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
    const res = moveBody(p, room.grid, 'player', false);
    p.grounded = res.grounded;
    if (res.grounded) p.airOk = true;
    if (res.hazard) hazard(run);
    syncAnim(run);
    return;
  }

  if (p.action) tryCancel(run, input);
  if (!p.action && !p.charging) tryStart(run, input);
  if (p.action) stepAction(run, input);
  else locomote(run, input);

  const impact = p.vy;
  const wasGround = p.grounded;
  const res = moveBody(p, room.grid, 'player', p.dropTimer > 0);
  if (!wasGround && res.grounded && impact > 2.2 && p.state !== 'dead') {
    run.events.push({ t: 'sfx', id: 'land' });
    run.events.push({ t: 'fx', kind: 'dust', x: p.x, y: p.y, facing: p.facing });
    if (p.action && p.action.id !== 'heal' && getMove(run.weapon, p.action.id).endOnLand) {
      const move = getMove(run.weapon, p.action.id);
      const wave = move.shockwave || hasRelic(run, 'star') || run.weapon === 'hammer';
      if (wave) spawnShockwave(run, 0, move.shockwave === 'big' || (hasRelic(run, 'star') && hasRelic(run, 'shock')));
      if (run.tutorial) run.tutFlags.plunge = true;
      p.action = null;
      p.vy = move.bounce ?? -3.2;
      p.grounded = false;
      res.grounded = false;
    } else if (!p.action && !p.charging) {
      p.state = 'land';
      p.landTick = 5;
    }
  }
  if (p.action && p.action.id !== 'heal') {
    const move = getMove(run.weapon, p.action.id);
    if (move.shockwave && isActiveFrame(move, p.action.frame) && p.action.frame === move.startup && move.special !== 'quake') {
      spawnShockwave(run, p.facing, move.shockwave === 'big');
    }
  }
  p.grounded = res.grounded;
  if (res.grounded) {
    p.airOk = true;
    if (p.vy > 0) p.vy = 0;
  }
  if (res.hazard) hazard(run);
  if (run.tutorial && Math.abs(p.x - run.tutStartX) > 36) run.tutFlags.move = true;
  syncAnim(run);
}

function hazard(run: Run): void {
  const p = run.player;
  if (p.hazardCd > 0 || p.invuln > 0 || p.iFrame || p.state === 'dead') return;
  const room = currentRoom(run);
  const name = room.grid.flat().includes('~') && run.floors[run.floorIndex]?.biome === 'molten' ? t('lavaName') : t('spikeName');
  p.hazardCd = 28;
  hurtPlayer(run, 12, -p.facing * 1.6, -3.4, name);
}
