import { describe, expect, it } from 'vitest';
import { blankInput } from '../src/core/types';
import type { Dir, FrameInput, RoomType, WeaponId } from '../src/core/types';
import { JUMP_V } from '../src/core/constants';
import { TILE } from '../src/core/constants';
import { enemyDef } from '../src/data/enemies';
import { WEAPONS, COMMON_MOVES, getMove, moveLength } from '../src/data/weapons';
import { debugMap, generateFloor } from '../src/sim/dungeon';
import { makeEnemy } from '../src/sim/ai';
import { onPlatform } from '../src/sim/collision';
import { createRun, enterRoom, stepRun } from '../src/sim/run';
import { currentRoom } from '../src/sim/world';
import type { Run } from '../src/sim/model';

const ranks = { hp: 0, flask: 0, dash: 0, purse: 0, regen: 0 };

function runOf(seed = 1): Run {
  return createRun({
    seed,
    character: 'wanderer',
    weapon: 'sword',
    arsenal: ['sword'],
    ranks,
  });
}

function press(partial: Partial<FrameInput>): FrameInput {
  return { ...blankInput(), ...partial };
}

function hold(run: Run, partial: Partial<FrameInput>, frames: number): void {
  for (let i = 0; i < frames; i++) stepRun(run, press(partial));
}

const TYPES: RoomType[] = ['start', 'combat', 'elite', 'treasure', 'shop', 'event', 'rest', 'secret', 'boss'];

function graphDist(rooms: { id: string; doors: Partial<Record<Dir, string>> }[], from: string, to: string): number {
  const q = [from];
  const dist = new Map<string, number>([[from, 0]]);
  while (q.length) {
    const id = q.shift()!;
    if (id === to) return dist.get(id)!;
    const room = rooms.find((r) => r.id === id);
    if (!room) continue;
    for (const next of Object.values(room.doors)) {
      if (!next || dist.has(next)) continue;
      dist.set(next, (dist.get(id) ?? 0) + 1);
      q.push(next);
    }
  }
  return -1;
}

describe('dungeon', () => {
  it('builds a real 2D floor for many seeds', () => {
    for (let seed = 1; seed <= 24; seed++) {
      for (let floorIndex = 0; floorIndex < 3; floorIndex++) {
        const floor = generateFloor(seed, floorIndex);
        const label = `seed ${seed} floor ${floorIndex}\n${debugMap(floor)}`;
        expect(floor.rooms.length, label).toBeGreaterThanOrEqual(11);
        const types = new Set(floor.rooms.map((r) => r.type));
        for (const need of TYPES) expect(types.has(need), `${label} missing ${need}`).toBe(true);
        const xs = new Set(floor.rooms.map((r) => r.gx));
        const ys = new Set(floor.rooms.map((r) => r.gy));
        expect(xs.size, label).toBeGreaterThanOrEqual(3);
        expect(ys.size, label).toBeGreaterThanOrEqual(3);
        let vert = 0;
        let horiz = 0;
        for (const room of floor.rooms) {
          for (const dir of ['l', 'r', 'u', 'd'] as const) {
            const nid = room.doors[dir];
            if (!nid) continue;
            const other = floor.rooms.find((r) => r.id === nid);
            expect(other, `${label} dangling ${room.id} ${dir}`).toBeTruthy();
            const back = dir === 'l' ? 'r' : dir === 'r' ? 'l' : dir === 'u' ? 'd' : 'u';
            expect(other!.doors[back], `${label} one-way ${room.id}->${nid}`).toBe(room.id);
            if (dir === 'r' || dir === 'd') {
              if (dir === 'r') horiz++;
              else vert++;
            }
          }
          expect(room.w).toBeGreaterThan(8);
          expect(room.h).toBeGreaterThan(8);
          expect(room.grid.length).toBe(room.h);
          expect(room.grid[0]!.length).toBe(room.w);
        }
        expect(horiz, label).toBeGreaterThanOrEqual(2);
        expect(vert, label).toBeGreaterThanOrEqual(2);
        const start = floor.rooms.find((r) => r.id === floor.startId)!;
        const boss = floor.rooms.find((r) => r.id === floor.bossId)!;
        expect(start.type).toBe('start');
        expect(boss.type).toBe('boss');
        const dist = graphDist(floor.rooms, start.id, boss.id);
        expect(dist, label).toBeGreaterThanOrEqual(3);
        const combatNeighbor = Object.values(start.doors).some((id) => floor.rooms.find((r) => r.id === id)?.type === 'combat');
        expect(combatNeighbor, label).toBe(true);
        expect(floor.rooms.some((r) => Object.values(r.secret).some(Boolean))).toBe(true);
      }
    }
  });
});

describe('moves', () => {
  it('keeps cancel targets and windows inside each weapon', () => {
    for (const weapon of Object.values(WEAPONS)) {
      const ids = new Set([...Object.keys(weapon.moves), ...Object.keys(COMMON_MOVES)]);
      for (const id of weapon.combo) expect(ids.has(id), weapon.id + ' ' + id).toBe(true);
      for (const move of Object.values(weapon.moves)) {
        expect(move.startup).toBeGreaterThan(0);
        expect(move.active).toBeGreaterThan(0);
        expect(move.hitbox.w).toBeGreaterThan(0);
        expect(move.hitbox.h).toBeGreaterThan(0);
        const len = moveLength(move);
        if (move.cancelAt < len) {
          expect(move.cancelEnd).toBeGreaterThanOrEqual(move.cancelAt);
          expect(move.cancelEnd).toBeLessThanOrEqual(len);
        }
        for (const next of move.cancelTo) expect(ids.has(next), `${weapon.id} ${move.id} -> ${next}`).toBe(true);
        expect(() => getMove(weapon.id, move.id)).not.toThrow();
      }
    }
  });
});

describe('combat and rooms', () => {
  it('lands a light hit on a guard', () => {
    const run = runOf(3);
    const guard = makeEnemy(run, 'guard', run.player.x + 26, run.player.y, false);
    guard.stun = 90;
    guard.cd = 999;
    run.enemies.push(guard);
    const before = guard.hp;
    hold(run, { attack: true }, 1);
    hold(run, {}, 8);
    expect(guard.hp).toBeLessThan(before);
    expect(before - guard.hp).toBeGreaterThanOrEqual(8);
  });

  it('does not crash when a shot lands during a flask', () => {
    const run = runOf(6);
    run.flasks = 2;
    run.player.hp = 40;
    const archer = makeEnemy(run, 'archer', run.player.x + 40, run.player.y, false);
    archer.cd = 999;
    run.enemies.push(archer);
    hold(run, { heal: true }, 1);
    expect(run.player.action?.id).toBe('heal');
    run.projectiles.push({
      id: 1,
      kind: 'arrow',
      x: run.player.x,
      y: run.player.y - 16,
      vx: 0,
      vy: 0,
      w: 14,
      h: 8,
      damage: 7,
      team: 'enemy',
      life: 10,
      poise: 4,
      kbX: 1,
      kbY: 0,
      hitstop: 2,
      hit: [],
      tick: 0,
      tickCd: 0,
      gravity: 0,
      ground: false,
      owner: archer.eid,
    });
    expect(() => hold(run, {}, 4)).not.toThrow();
    expect(run.player.hp).toBeLessThan(40);
  });

  it('contact damage leaves room to escape', () => {
    const run = runOf(9);
    const guard = makeEnemy(run, 'guard', run.player.x, run.player.y, false);
    guard.cd = 999;
    run.enemies.push(guard);
    const hp = run.player.hp;
    hold(run, {}, 180);
    const lost = hp - run.player.hp;
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(20);
    expect(run.player.hp).toBeGreaterThan(70);
  });

  it('parries an active slash without taking the hit', () => {
    const run = runOf(4);
    const guard = makeEnemy(run, 'guard', run.player.x + 22, run.player.y, false);
    guard.facing = -1;
    guard.cd = 999;
    const slash = enemyDef('guard').attacks[0]!;
    guard.attack = {
      id: slash.id,
      frame: slash.telegraph - 2,
      def: slash,
      hitPlayer: false,
      facing: -1,
      destX: run.player.x,
      destY: run.player.y,
      serial: 1,
      parried: false,
      dodged: false,
    };
    run.enemies.push(guard);
    const hp = run.player.hp;
    hold(run, { parry: true }, 1);
    hold(run, {}, 2);
    expect(run.player.hp).toBe(hp);
    expect(run.player.riposte).toBeGreaterThan(0);
    expect(guard.stun).toBeGreaterThan(0);
  });

  it('still jumps during coyote time', () => {
    const run = runOf(5);
    const p = run.player;
    p.y -= 70;
    p.grounded = false;
    p.coyote = 6;
    p.vy = 0.4;
    stepRun(run, press({ jump: true, jumpHeld: true }));
    expect(p.vy).toBeLessThan(JUMP_V * 0.7);
  });

  it('walks through an open side door into the next room', () => {
    const run = runOf(7);
    const floor = run.floors[0]!;
    const room = floor.rooms.find((r) => r.cleared && ((r.doors.r && !r.secret.r) || (r.doors.l && !r.secret.l)));
    expect(room).toBeTruthy();
    enterRoom(run, room!.id, 'spawn', false);
    const dir: 'l' | 'r' = room!.doors.r && !room!.secret.r ? 'r' : 'l';
    const dest = room!.doors[dir]!;
    hold(run, {}, 8);
    const edge = dir === 'r' ? room!.w * TILE - 8 : 8;
    run.player.x = edge;
    run.player.facing = dir === 'r' ? 1 : -1;
    run.player.vx = dir === 'r' ? 2 : -2;
    hold(run, { x: dir === 'r' ? 1 : -1 }, 30);
    expect(run.roomId).toBe(dest);
    expect(currentRoom(run).explored).toBe(true);
  });

  it('gives every up door a step the jump can reach', () => {
    for (let seed = 1; seed <= 24; seed++) {
      for (let floor = 0; floor < 3; floor++) {
        const built = generateFloor(seed, floor);
        for (const room of built.rooms) {
          if (!room.doors.u || room.secret.u) continue;
          const x = room.upTile;
          let gap = 99;
          for (let y = room.h - 2; y > 1; y--) {
            const ch = room.grid[y]?.[x];
            if (ch === '=' || ch === '#') {
              gap = room.h - 1 - y;
              break;
            }
          }
          expect(gap, `${room.id} ${room.templateId} seed ${seed}`).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('drops a stranded enemy back off a high ledge', () => {
    const run = runOf(2);
    const room = run.floors[0]!.rooms.find((r) => r.h >= 28 && r.doors.u && !r.secret.u);
    expect(room).toBeTruthy();
    enterRoom(run, room!.id, 'spawn', false);
    run.enemies = [];
    currentRoom(run).locked = false;
    const x = room!.upTile * TILE + TILE / 2;
    const guard = makeEnemy(run, 'guard', x, 96, false);
    guard.cd = 9999;
    guard.grounded = true;
    guard.vy = 0;
    run.enemies.push(guard);
    run.player.x = x;
    run.player.y = (room!.h - 1) * TILE - 0.01;
    run.player.grounded = true;
    hold(run, {}, 90);
    expect(guard.y).toBeGreaterThan(200);
  });

  it('boss hops onto the ledge a player is standing on', () => {
    const run = runOf(7);
    const bossRoom = run.floors[0]!.rooms.find((r) => r.type === 'boss')!;
    enterRoom(run, bossRoom.id, 'spawn', false);
    const room = currentRoom(run);
    const boss = run.enemies.find((e) => e.boss)!;
    const surface = (room.h - 5) * TILE;
    run.player.x = 9 * TILE;
    run.player.y = surface - 0.01;
    run.player.vx = 0;
    run.player.vy = 0;
    run.player.grounded = true;
    boss.x = 9 * TILE;
    boss.y = (room.h - 1) * TILE - 0.01;
    boss.vx = 0;
    boss.vy = 0;
    boss.grounded = true;
    boss.cd = 5000;
    boss.attack = null;
    const floorY = boss.y;
    hold(run, {}, 70);
    expect(boss.alive).toBe(true);
    expect(boss.y).toBeLessThan(floorY - 48);
  });

  it('keeps the player inside a locked combat room', () => {
    const run = runOf(8);
    const room = run.floors[0]!.rooms.find((r) => r.type === 'combat' && r.spawns.length > 0)!;
    enterRoom(run, room.id, 'spawn', false);
    expect(currentRoom(run).locked).toBe(true);
    hold(run, {}, 8);
    run.player.x = 4;
    hold(run, { x: -1 }, 5);
    expect(run.roomId).toBe(room.id);
    expect(run.player.x).toBeGreaterThanOrEqual(22);
  });
});

function weaponRun(seed: number, weapon: WeaponId): Run {
  return createRun({
    seed,
    character: 'wanderer',
    weapon,
    arsenal: [weapon],
    ranks,
  });
}

function nearestFoe(run: Run) {
  let best: Run['enemies'][number] | null = null;
  let bestD = 1e9;
  for (const e of run.enemies) {
    if (!e.alive) continue;
    const d = Math.abs(e.x - run.player.x) + Math.abs(e.y - run.player.y);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function idealRange(weapon: WeaponId): number {
  if (weapon === 'hammer') return 32;
  if (weapon === 'dagger') return 22;
  return 26;
}

function floorAhead(run: Run, dir: number): string | undefined {
  if (!dir) return undefined;
  const room = currentRoom(run);
  const tx = Math.floor((run.player.x + dir * 14) / TILE);
  const ty = Math.floor((run.player.y + 2) / TILE);
  return room.grid[ty]?.[tx];
}

function hazardAhead(run: Run, dir: number): boolean {
  const ch = floorAhead(run, dir);
  return ch === '^' || ch === '~';
}


function fightInput(run: Run): FrameInput {
  const input = press({});
  const p = run.player;
  const foe = nearestFoe(run);
  if (!foe) return input;
  const dx = foe.x - p.x;
  const adx = Math.abs(dx);
  const dir = dx >= 0 ? 1 : -1;
  const ideal = idealRange(run.weapon);
  const room = currentRoom(run);
  const pinned = adx < 46 && (p.x < 40 || p.x > room.w * TILE - 40);
  if (pinned && p.grounded) {
    input.jump = true;
    input.jumpHeld = true;
    input.x = p.x < room.w * TILE * 0.5 ? 1 : -1;
    return input;
  }
  if (foe.y > p.y + 40) {
    input.x = dir;
    if (onPlatform(room.grid, p) && adx < 36 && p.grounded) {
      input.down = true;
      input.y = 1;
      input.jump = true;
    }
  } else if (foe.y < p.y - 36 && adx < 90) {
    input.x = adx < 18 ? 0 : dir;
    if (p.grounded) input.jump = true;
  } else if (adx > ideal + 10) {
    input.x = dir;
    if (adx > 140 && p.grounded && p.dashCharges > 0) input.dash = true;
  }
  if (hazardAhead(run, input.x || dir) && p.grounded) {
    input.jump = true;
    input.jumpHeld = true;
  }
  const level = Math.abs(foe.y - p.y) < 56;
  if (level && adx < ideal + 24 && !pinned) input.attack = true;
  if (foe.y < p.y - 20) input.x = adx < 16 ? 0 : dir;
  const windup = run.enemies.find((e) => {
    if (!e.alive || !e.attack || e.attack.frame >= e.attack.def.telegraph) return false;
    return Math.abs(e.x - p.x) < e.attack.def.reach + 36 && Math.abs(e.y - p.y) < 70;
  });
  if (windup && p.grounded && !pinned) {
    input.attack = false;
    input.x = windup.x >= p.x ? -1 : 1;
    if (p.dashCharges > 0 && windup.attack && windup.attack.frame > windup.attack.def.telegraph * 0.45) input.dash = true;
    else {
      input.jump = true;
    }
  }
  if (p.hp < p.maxHp * 0.42 && run.flasks > 0 && adx > 36 && p.grounded && !windup) input.heal = true;
  if (input.jump || p.vy < 0) input.jumpHeld = true;
  return input;
}


describe('weapon playtests', () => {
  it('clears a floor-1 combat room with each weapon without melting', () => {
    for (const weapon of ['sword', 'hammer', 'dagger'] as const) {
      for (const seed of [3, 7, 11]) {
        const run = weaponRun(seed, weapon);
        const room = run.floors[0]!.rooms.find((r) => r.type === 'combat' && r.spawns.length > 0);
        expect(room, `${weapon} seed ${seed}`).toBeTruthy();
        enterRoom(run, room!.id, 'spawn', false);
        const startHp = run.player.hp;
        let frames = 0;
        for (; frames < 4200; frames++) {
          if (run.mode !== 'play') break;
          if (currentRoom(run).cleared) break;
          stepRun(run, fightInput(run));
        }
        expect(run.mode, `${weapon} seed ${seed} mode`).toBe('play');
        expect(currentRoom(run).cleared, `${weapon} seed ${seed} clear in ${frames}`).toBe(true);
        expect(startHp - run.player.hp, `${weapon} seed ${seed} hp`).toBeLessThan(55);
        expect(run.player.hp, `${weapon} seed ${seed}`).toBeGreaterThan(40);
      }
    }
  });
});

