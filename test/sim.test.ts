import { describe, expect, it } from 'vitest';
import { blankInput } from '../src/core/types';
import type { Dir, FrameInput, RoomType } from '../src/core/types';
import { JUMP_V } from '../src/core/constants';
import { TILE } from '../src/core/constants';
import { enemyDef } from '../src/data/enemies';
import { WEAPONS, COMMON_MOVES, getMove, moveLength } from '../src/data/weapons';
import { debugMap, generateFloor } from '../src/sim/dungeon';
import { makeEnemy } from '../src/sim/ai';
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
