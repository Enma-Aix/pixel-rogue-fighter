import { TILE } from '../core/constants';
import { clamp } from '../core/math';
import { blankInput, type CharacterId, type Dir, type FrameInput, type WeaponId } from '../core/types';
import { CHARACTERS } from '../data/characters';
import { biomeAt } from '../data/biomes';
import { eventById } from '../data/events';
import type { MetaRanks } from '../data/meta';
import { relicById } from '../data/relics';
import { templateTutorial, cloneGrid } from '../data/rooms';
import { t } from '../data/strings';
import { WEAPONS } from '../data/weapons';
import { makeEnemy, stepEnemies, stepProjectiles, stepTelegraphs } from './ai';
import { resolveCombat } from './combat';
import { floorFeetY } from './collision';
import { goldAmount, grantRelic, hasRelic, recompute, rollChoices, rollRelic, shopStock } from './loot';
import { blankEdges, latchEdges, mergeInput, type Run } from './model';
import { stepPlayer } from './player';
import type { RunSnapshot } from './snapshot';
import { generateFloor } from './dungeon';
import { currentRoom, roomById } from './world';

export interface RunOptions {
  seed: number;
  character: CharacterId;
  weapon: WeaponId;
  arsenal: WeaponId[];
  ranks: MetaRanks;
  tutorial?: boolean;
  restore?: RunSnapshot | null;
}

export function createRun(opts: RunOptions): Run {
  const character = CHARACTERS[opts.character];
  const ranks = opts.ranks;
  const baseMaxHp = character.hp + ranks.hp * 12;
  const flaskMax = 3 + ranks.flask;
  const baseDash = 1 + ranks.dash;
  const floors = opts.tutorial ? [tutorialFloor()] : [0, 1, 2].map((i) => generateFloor(opts.seed, i));
  const start = floors[0]!.rooms.find((r) => r.type === 'start') ?? floors[0]!.rooms[0]!;
  const run: Run = {
    seed: opts.seed,
    character: opts.character,
    weapon: opts.weapon,
    arsenal: opts.arsenal.length ? opts.arsenal : ['sword'],
    floors,
    floorIndex: 0,
    roomId: start.id,
    player: {
      x: 72,
      y: floorFeetY(start.grid),
      vx: 0,
      vy: 0,
      w: 14,
      h: 30,
      facing: 1,
      hp: baseMaxHp,
      maxHp: baseMaxHp,
      state: 'idle',
      frame: 0,
      grounded: true,
      coyote: 8,
      jumpBuf: 0,
      jumpCut: false,
      invuln: 0,
      iFrame: false,
      armor: false,
      stun: 0,
      action: null,
      charge: 0,
      charging: false,
      atkBuf: 0,
      dashBuf: 0,
      dashCharges: baseDash,
      dashRegen: 0,
      airOk: true,
      dropTimer: 0,
      riposte: 0,
      hitCancel: 0,
      hazardCd: 0,
      anim: 'idle',
      animFrame: 0,
      landTick: 0,
      hitThisFrame: false,
      empowered: 0,
    },
    enemies: [],
    projectiles: [],
    telegraphs: [],
    events: [],
    mode: 'play',
    relics: [],
    gold: ranks.purse * 15,
    flasks: flaskMax,
    flaskMax,
    energy: 40,
    energyMax: 100,
    energyRegen: 0.045 + ranks.regen * 0.02 + character.regen,
    regenBonus: 0,
    dashMax: baseDash,
    baseDash,
    attackBonus: 0,
    charDmg: character.dmg,
    charSpeed: character.speed,
    charDr: character.dr,
    baseMaxHp,
    lastStandUsed: false,
    curseNext: false,
    gate: 0,
    hitstop: 0,
    shake: 0,
    combo: 0,
    comboTimer: 0,
    buf: blankEdges(),
    rewardTaken: [],
    opened: [],
    shopSold: [],
    reward: null,
    shop: null,
    dialogue: null,
    stats: { kills: 0, rooms: 0, maxCombo: 0, bosses: 0, frames: 0 },
    deathTimer: 0,
    tutorial: !!opts.tutorial,
    tutStep: 0,
    tutFlags: {},
    tutStartX: 72,
    lastHit: '',
    serial: 1,
    nextEid: 1,
    nextPid: 1,
    roomRevision: 0,
    interactPrompt: '',
    time: 0,
    introFloor: -1,
    banked: false,
    coresGained: 0,
    victory: false,
    followups: [],
    menuIndex: 0,
  };
  if (opts.tutorial) {
    enterRoom(run, start.id, 'spawn', false);
    run.enemies.push(makeEnemy(run, 'dummy', 230, floorFeetY(start.grid), false));
    run.tutStartX = run.player.x;
    return run;
  }
  enterRoom(run, start.id, 'spawn', true);
  if (opts.restore) applySnapshot(run, opts.restore);
  return run;
}

function tutorialFloor() {
  const grid = cloneGrid(templateTutorial());
  const id = '0:0,0';
  return {
    index: 0,
    biome: 'ash' as const,
    startId: id,
    bossId: id,
    rooms: [
      {
        id,
        gx: 0,
        gy: 0,
        type: 'start' as const,
        templateId: 'tutorial',
        grid,
        w: grid[0]!.length,
        h: grid.length,
        doors: {},
        secret: {},
        secretOpen: false,
        explored: false,
        seen: false,
        cleared: true,
        locked: false,
        spawns: [],
        props: [],
        upTile: Math.floor(grid[0]!.length / 2),
        downTile: Math.floor(grid[0]!.length / 2),
      },
    ],
  };
}

function applySnapshot(run: Run, snap: RunSnapshot): void {
  run.weapon = snap.weapon;
  run.arsenal = snap.arsenal.length ? snap.arsenal : run.arsenal;
  run.gold = snap.gold;
  run.relics = snap.relics.slice();
  run.attackBonus = snap.attackBonus;
  run.lastStandUsed = snap.lastStandUsed;
  run.curseNext = snap.curseNext;
  run.regenBonus = snap.regenBonus;
  run.rewardTaken = snap.rewardTaken.slice();
  run.opened = snap.opened.slice();
  run.shopSold = snap.shopSold.slice();
  run.stats = {
    kills: snap.kills,
    rooms: snap.rooms,
    maxCombo: snap.maxCombo,
    bosses: snap.bosses,
    frames: snap.frames,
  };
  run.time = snap.frames;
  for (const id of snap.seen) {
    const room = roomById(run.floors, id);
    if (room) room.seen = true;
  }
  for (const id of snap.explored) {
    const room = roomById(run.floors, id);
    if (room) room.explored = true;
  }
  for (const id of snap.cleared) {
    const room = roomById(run.floors, id);
    if (room) {
      room.cleared = true;
      room.locked = false;
    }
  }
  for (const id of snap.secretOpen) {
    const room = roomById(run.floors, id);
    if (!room) continue;
    room.secretOpen = true;
    room.seen = true;
    for (const row of room.grid) {
      for (let i = 0; i < row.length; i++) if (row[i] === 'x') row[i] = '.';
    }
  }
  recompute(run);
  run.player.hp = clamp(snap.hp, 1, run.player.maxHp);
  run.flasks = clamp(snap.flasks, 0, run.flaskMax);
  run.energy = clamp(snap.energy, 0, run.energyMax);
  run.introFloor = snap.floorIndex;
  enterRoom(run, snap.roomId, 'restore', false);
}

export function snapshotOf(run: Run): RunSnapshot {
  const seen: string[] = [];
  const explored: string[] = [];
  const cleared: string[] = [];
  const secretOpen: string[] = [];
  for (const floor of run.floors) {
    for (const room of floor.rooms) {
      if (room.seen) seen.push(room.id);
      if (room.explored) explored.push(room.id);
      if (room.cleared) cleared.push(room.id);
      if (room.secretOpen) secretOpen.push(room.id);
    }
  }
  return {
    version: 1,
    seed: run.seed,
    character: run.character,
    weapon: run.weapon,
    arsenal: run.arsenal.slice(),
    floorIndex: run.floorIndex,
    roomId: run.roomId,
    hp: run.player.hp,
    gold: run.gold,
    flasks: run.flasks,
    energy: run.energy,
    relics: run.relics.slice(),
    attackBonus: run.attackBonus,
    lastStandUsed: run.lastStandUsed,
    curseNext: run.curseNext,
    regenBonus: run.regenBonus,
    rewardTaken: run.rewardTaken.slice(),
    opened: run.opened.slice(),
    shopSold: run.shopSold.slice(),
    seen,
    explored,
    cleared,
    secretOpen,
    kills: run.stats.kills,
    rooms: run.stats.rooms,
    maxCombo: run.stats.maxCombo,
    bosses: run.stats.bosses,
    frames: run.stats.frames,
  };
}

function placePlayer(run: Run, how: Dir | 'spawn' | 'restore'): void {
  const room = currentRoom(run);
  const floorY = (room.h - 1) * TILE - 0.01;
  const p = run.player;
  p.stun = 0;
  p.action = null;
  p.charging = false;
  if (how === 'spawn' || how === 'restore') {
    p.x = 64;
    p.y = floorY;
    p.vx = 0;
    p.vy = 0;
    p.facing = 1;
    p.grounded = true;
  } else if (how === 'r') {
    p.x = 28;
    p.y = floorY;
    p.vx = 1.2;
    p.vy = 0;
    p.facing = 1;
    p.grounded = true;
  } else if (how === 'l') {
    p.x = room.w * TILE - 28;
    p.y = floorY;
    p.vx = -1.2;
    p.vy = 0;
    p.facing = -1;
    p.grounded = true;
  } else if (how === 'u') {
    const hole = room.downTile * TILE + TILE / 2;
    p.x = clamp(hole + 42, 30, room.w * TILE - 30);
    p.y = floorY;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
  } else {
    p.x = clamp(room.upTile * TILE + TILE / 2, 30, room.w * TILE - 30);
    p.y = p.h + 18;
    p.vx = 0;
    p.vy = 1.4;
    p.grounded = false;
  }
  for (let i = 0; i < 12; i++) {
    const left = p.x - p.w / 2;
    const top = p.y - p.h;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor((top + p.h * 0.5) / TILE);
    const ch = room.grid[ty]?.[tx];
    if (ch === '#' || ch === '+' || ch === 'x') p.y -= 4;
    else break;
    void left;
  }
}

export function enterRoom(run: Run, id: string, how: Dir | 'spawn' | 'restore', count: boolean): void {
  const room = roomById(run.floors, id);
  if (!room) return;
  const idx = Number(id.split(':')[0]);
  if (!Number.isNaN(idx) && run.floors[idx]) run.floorIndex = idx;
  run.roomId = id;
  run.enemies = [];
  run.projectiles = [];
  run.telegraphs = [];
  run.followups = [];
  run.gate = how === 'spawn' || how === 'restore' ? 6 : 14;
  run.roomRevision++;
  placePlayer(run, how);
  room.explored = true;
  room.seen = true;
  if (count) run.stats.rooms += 1;
  const sense = hasRelic(run, 'sense');
  for (const dir of ['l', 'r', 'u', 'd'] as const) {
    const nid = room.doors[dir];
    if (!nid) continue;
    const next = roomById(run.floors, nid);
    if (!next) continue;
    if (room.secret[dir] && !room.secretOpen && !sense) continue;
    next.seen = true;
  }
  const hostile = room.type === 'combat' || room.type === 'elite' || room.type === 'boss';
  if (!run.tutorial && hostile && !room.cleared && room.spawns.length > 0) {
    room.locked = true;
    const cursed = run.curseNext;
    if (cursed) {
      run.curseNext = false;
      run.events.push({ t: 'float', text: t('cursedRoom'), x: run.player.x, y: run.player.y - 48, color: '#d7a6ff' });
    }
    for (const spawn of room.spawns) run.enemies.push(makeEnemy(run, spawn.kind, spawn.x, spawn.y, cursed));
  } else {
    room.locked = false;
    if (hostile && room.spawns.length === 0) room.cleared = true;
  }
  if (room.type === 'boss' && room.cleared) ensurePortal(room);
  if (run.introFloor !== run.floorIndex && !run.tutorial) {
    run.introFloor = run.floorIndex;
    const biome = biomeAt(run.floorIndex);
    run.events.push({ t: 'float', text: biome.name, x: run.player.x, y: run.player.y - 56, color: '#f4f0ea' });
    run.events.push({ t: 'float', text: biome.intro, x: run.player.x, y: run.player.y - 40, color: '#c8bdd4' });
  }
  if (room.type === 'boss' && !room.cleared) {
    const boss = room.spawns[0] ? enemyName(room.spawns[0].kind) : t('boss');
    run.events.push({ t: 'float', text: boss, x: run.player.x, y: 48, color: '#ffb089' });
  }
  if (!run.tutorial && room.cleared && !run.rewardTaken.includes(room.id) && (room.type === 'elite' || room.type === 'boss')) {
    openReward(run);
  }
  run.events.push({ t: 'save' });
  run.events.push({ t: 'sfx', id: 'stepRoom' });
}

function enemyName(kind: string): string {
  if (kind === 'boss1') return t('bossIncoming', { name: '烬卫将军' });
  if (kind === 'boss2') return t('bossIncoming', { name: '熔核巨像' });
  if (kind === 'boss3') return t('bossIncoming', { name: '终烬之主' });
  return kind;
}

function ensurePortal(room: ReturnType<typeof currentRoom>): void {
  if (room.props.some((p) => p.kind === 'portal')) return;
  room.props.push({ kind: 'portal', x: room.w * TILE * 0.55, y: (room.h - 1) * TILE });
}

function openReward(run: Run): void {
  const room = currentRoom(run);
  if (run.rewardTaken.includes(room.id)) return;
  const boss = room.type === 'boss';
  const choices = rollChoices(run, boss ? 3 : 2, `reward:${room.id}`, boss ? 'epic' : 'rare');
  if (!choices.length) {
    run.gold += goldAmount(18, run, `empty:${room.id}`);
    run.rewardTaken.push(room.id);
    run.events.push({ t: 'float', text: t('emptyRelic'), x: run.player.x, y: run.player.y - 40, color: '#f0c85c' });
    return;
  }
  run.reward = { title: boss ? t('bossReward') : t('eliteReward'), choices };
  run.mode = 'reward';
  run.menuIndex = 0;
}

export function pickReward(run: Run, index: number): void {
  const choice = run.reward?.choices[index];
  if (!choice) return;
  grantRelic(run, choice.id);
  run.rewardTaken.push(currentRoom(run).id);
  run.reward = null;
  run.mode = 'play';
  run.events.push({ t: 'save' });
}

export function skipReward(run: Run): void {
  run.gold += 8;
  run.rewardTaken.push(currentRoom(run).id);
  run.reward = null;
  run.mode = 'play';
  run.events.push({ t: 'float', text: t('goldGet', { n: 8 }), x: run.player.x, y: run.player.y - 30, color: '#f0c85c' });
  run.events.push({ t: 'save' });
}

export function buyItem(run: Run, index: number): void {
  const room = currentRoom(run);
  const items = shopStock(run, room.id);
  const item = items[index];
  if (!item) return;
  const key = `${room.id}:${index}`;
  if (run.shopSold.includes(key)) return;
  if (run.gold < item.price) {
    run.events.push({ t: 'sfx', id: 'deny' });
    run.events.push({ t: 'float', text: t('needGold'), x: run.player.x, y: run.player.y - 30, color: '#ffb0a0' });
    return;
  }
  run.gold -= item.price;
  run.shopSold.push(key);
  if (item.kind === 'relic' && item.relicId) grantRelic(run, item.relicId);
  if (item.kind === 'heal') {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 36);
    run.events.push({ t: 'float', text: t('healGet', { n: 36 }), x: run.player.x, y: run.player.y - 30, color: '#8dffb0' });
  }
  if (item.kind === 'flask') {
    if (run.flasks < run.flaskMax) run.flasks++;
    else run.energy = run.energyMax;
  }
  run.events.push({ t: 'sfx', id: 'buy' });
  run.events.push({ t: 'save' });
}

export function chooseRest(run: Run, which: 'heal' | 'hone' | 'flask'): void {
  const room = currentRoom(run);
  const key = `rest:${room.id}`;
  if (run.opened.includes(key)) return;
  run.opened.push(key);
  const p = run.player;
  if (which === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.45));
    run.events.push({ t: 'float', text: t('healed'), x: p.x, y: p.y - 36, color: '#8dffb0' });
  } else if (which === 'hone') {
    run.attackBonus = Math.min(0.32, run.attackBonus + 0.08);
    run.events.push({ t: 'float', text: t('attackUp'), x: p.x, y: p.y - 36, color: '#ffd29a' });
  } else if (run.flasks < run.flaskMax) {
    run.flasks++;
    run.events.push({ t: 'float', text: t('plusFlask', { n: run.flasks }), x: p.x, y: p.y - 36, color: '#9ad7ff' });
  } else {
    run.energy = run.energyMax;
    run.events.push({ t: 'float', text: t('fullFlasks'), x: p.x, y: p.y - 36, color: '#9ad7ff' });
  }
  run.mode = 'play';
  run.events.push({ t: 'sfx', id: 'heal2' });
  run.events.push({ t: 'save' });
}

export function applyEvent(run: Run, effect: string): void {
  const room = currentRoom(run);
  const key = `ev:${room.id}`;
  if (run.opened.includes(key)) return;
  const p = run.player;
  const close = (msg?: string) => {
    if (!run.opened.includes(key)) run.opened.push(key);
    run.mode = 'play';
    if (msg) run.events.push({ t: 'float', text: msg, x: p.x, y: p.y - 36, color: '#f4f0ea' });
    run.events.push({ t: 'sfx', id: 'pickup' });
    run.events.push({ t: 'save' });
  };
  if (effect === 'leave') return close(t('left'));
  if (effect === 'payHeal') {
    if (run.gold < 16) {
      run.events.push({ t: 'sfx', id: 'deny' });
      return;
    }
    run.gold -= 16;
    p.hp = Math.min(p.maxHp, p.hp + 36);
    return close(t('drank'));
  }
  if (effect === 'bleedRelic') {
    p.hp = Math.max(1, p.hp - 22);
    const relic = rollRelic(run, 'any', `bleed:${room.id}`);
    if (relic) grantRelic(run, relic.id);
    else run.gold += 18;
    return close(t('bled'));
  }
  if (effect === 'hone') {
    run.attackBonus = Math.min(0.4, run.attackBonus + 0.06);
    return close(t('honed'));
  }
  if (effect === 'swapWeapon') {
    const others = run.arsenal.filter((w) => w !== run.weapon);
    if (others.length) {
      run.weapon = others[run.time % others.length]!;
      return close(t('swapped'));
    }
    run.gold += 22;
    return close(t('tookGold'));
  }
  if (effect === 'curseRelic') {
    const relic = rollRelic(run, 'rare', `curse:${room.id}`);
    if (relic) grantRelic(run, relic.id);
    run.curseNext = true;
    return close(t('curseOn'));
  }
  if (effect === 'gold28') {
    run.gold += goldAmount(28, run, `evgold:${room.id}`);
    return close(t('tookGold'));
  }
  if (effect === 'tradeUp') {
    if (!run.relics.length) {
      run.gold += 15;
      return close(t('noTrade'));
    }
    const idx = run.time % run.relics.length;
    const old = run.relics[idx]!;
    const prev = relicById(old);
    run.relics.splice(idx, 1);
    recompute(run);
    const next = prev?.rarity === 'epic' ? 'epic' : prev?.rarity === 'rare' ? 'epic' : 'rare';
    const relic = rollRelic(run, next, `trade:${room.id}:${old}`);
    if (relic) grantRelic(run, relic.id);
    else run.gold += 24;
    return close(t('traded'));
  }
  if (effect === 'breath') {
    run.energy = run.energyMax;
    run.regenBonus += 0.02;
    return close(t('breathed'));
  }
  close();
}

export function usePortal(run: Run): void {
  const room = currentRoom(run);
  if (room.type !== 'boss' || !room.cleared) return;
  if (run.floorIndex >= 2) {
    run.victory = true;
    run.mode = 'victory';
    run.events.push({ t: 'sfx', id: 'win' });
    return;
  }
  run.floorIndex += 1;
  run.player.hp = Math.min(run.player.maxHp, run.player.hp + Math.round(run.player.maxHp * 0.18));
  const next = run.floors[run.floorIndex];
  if (!next) return;
  enterRoom(run, next.startId, 'spawn', true);
  run.events.push({ t: 'float', text: t('nextBiome', { name: biomeAt(run.floorIndex).name }), x: run.player.x, y: run.player.y - 48, color: '#ffd29a' });
}

function nearestProp(run: Run): { index: number; kind: string } | null {
  const room = currentRoom(run);
  let best: { index: number; kind: string; d: number } | null = null;
  room.props.forEach((prop, index) => {
    const d = Math.abs(prop.x - run.player.x) + Math.abs(prop.y - run.player.y) * 0.25;
    if (d > 48) return;
    if (!best || d < best.d) best = { index, kind: prop.kind, d };
  });
  return best;
}

function interact(run: Run): void {
  const room = currentRoom(run);
  if (room.locked) return;
  const hit = nearestProp(run);
  if (!hit) return;
  const prop = room.props[hit.index];
  if (!prop) return;
  if (prop.kind === 'chest') {
    const key = `${room.id}:${hit.index}`;
    if (run.opened.includes(key)) return;
    run.opened.push(key);
    const relic = rollRelic(run, room.type === 'secret' ? 'epic' : 'rare', `chest:${key}`);
    if (relic) grantRelic(run, relic.id);
    run.gold += goldAmount(room.type === 'secret' ? 24 : 16, run, key);
    run.events.push({ t: 'sfx', id: 'chest' });
    run.events.push({ t: 'save' });
    return;
  }
  if (prop.kind === 'shrine') {
    if (run.opened.includes(`rest:${room.id}`)) return;
    run.mode = 'rest';
    run.menuIndex = 0;
    return;
  }
  if (prop.kind === 'npc') {
    run.shop = shopStock(run, room.id);
    run.mode = 'shop';
    run.menuIndex = 0;
    return;
  }
  if (prop.kind === 'event') {
    if (run.opened.includes(`ev:${room.id}`)) return;
    run.mode = 'event';
    run.menuIndex = 0;
    return;
  }
  if (prop.kind === 'lore') {
    run.dialogue = { title: t('loreTitle'), body: t('startLore') };
    run.mode = 'dialogue';
    return;
  }
  if (prop.kind === 'portal') usePortal(run);
}

function refreshPrompt(run: Run): void {
  const room = currentRoom(run);
  if (room.locked) {
    run.interactPrompt = '';
    return;
  }
  const hit = nearestProp(run);
  if (!hit) {
    run.interactPrompt = '';
    return;
  }
  const prop = room.props[hit.index];
  if (!prop) return;
  if (prop.kind === 'chest' && run.opened.includes(`${room.id}:${hit.index}`)) run.interactPrompt = '';
  else if (prop.kind === 'chest') run.interactPrompt = t('chestPrompt');
  else if (prop.kind === 'shrine' && run.opened.includes(`rest:${room.id}`)) run.interactPrompt = '';
  else if (prop.kind === 'shrine') run.interactPrompt = t('restPrompt');
  else if (prop.kind === 'npc') run.interactPrompt = t('shopPrompt');
  else if (prop.kind === 'event' && run.opened.includes(`ev:${room.id}`)) run.interactPrompt = '';
  else if (prop.kind === 'event') run.interactPrompt = t('eventPrompt');
  else if (prop.kind === 'lore') run.interactPrompt = t('lorePrompt');
  else if (prop.kind === 'portal') run.interactPrompt = run.floorIndex >= 2 ? t('portalEnd') : t('portal');
  else run.interactPrompt = t('interact');
}

function checkClear(run: Run): void {
  const room = currentRoom(run);
  if (!room.locked || room.cleared) return;
  if (!run.enemies.length || run.enemies.some((e) => e.alive)) return;
  room.locked = false;
  room.cleared = true;
  const bonus = goldAmount(6 + run.floorIndex * 3, run, `clear:${room.id}`);
  run.gold += bonus;
  if (hasRelic(run, 'emberHeart')) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 8);
  }
  run.events.push({ t: 'sfx', id: 'clear' });
  run.events.push({ t: 'float', text: t('doorOpen'), x: run.player.x, y: run.player.y - 42, color: '#f4f0ea' });
  run.shake = Math.min(4, run.shake + 1);
  if (room.type === 'boss') {
    ensurePortal(room);
    const boss = run.enemies.find((e) => e.boss);
    run.events.push({ t: 'float', text: t('bossDown', { name: boss?.name ?? t('boss') }), x: run.player.x, y: 40, color: '#ffd29a' });
  }
  if (room.type === 'elite' || room.type === 'boss') openReward(run);
  run.events.push({ t: 'save' });
}

function checkExit(run: Run): void {
  if (run.gate > 0 || run.tutorial) return;
  const room = currentRoom(run);
  const p = run.player;
  const floorY = (room.h - 1) * TILE;
  if (room.locked) {
    const min = 22;
    const max = room.w * TILE - 22;
    if (p.x < min) p.x = min;
    if (p.x > max) p.x = max;
    // Holes stay shut until the room is cleared, including rooms that have a down door.
    if (p.y > floorY + 2) {
      p.y = floorY - 0.01;
      p.vy = Math.min(0, p.vy);
    }
    return;
  }
  const tryDir = (dir: Dir): boolean => {
    if (!room.doors[dir]) return false;
    if (room.secret[dir] && !room.secretOpen) return false;
    enterRoom(run, room.doors[dir]!, dir, true);
    return true;
  };
  if (room.doors.l && p.x < 10 && Math.abs(p.y - floorY) < 28) {
    tryDir('l');
    return;
  }
  if (room.doors.r && p.x > room.w * TILE - 10 && Math.abs(p.y - floorY) < 28) {
    tryDir('r');
    return;
  }
  const downX = room.downTile * TILE + TILE / 2;
  const upX = room.upTile * TILE + TILE / 2;
  if (room.doors.d && p.y > floorY + 8 && Math.abs(p.x - downX) < 34) {
    tryDir('d');
    return;
  }
  if (room.doors.u && p.vy < 0 && p.y - p.h < 8 && Math.abs(p.x - upX) < 36) {
    tryDir('u');
  }
}

function advanceTutorial(run: Run): void {
  if (!run.tutorial || run.tutFlags.done) return;
  const order = ['move', 'jump', 'combo', 'dash', 'parry', 'skill', 'plunge'] as const;
  const key = order[run.tutStep];
  if (!key) {
    run.tutFlags.done = true;
    return;
  }
  if (run.tutFlags[key]) {
    run.tutStep += 1;
    run.events.push({ t: 'sfx', id: 'pickup' });
    if (run.tutStep === 5) run.energy = run.energyMax;
    if (run.tutStep >= order.length) run.tutFlags.done = true;
  }
}

export function stepRun(run: Run, input: FrameInput): void {
  run.events = [];
  if (run.mode === 'dying') {
    stepPlayer(run, blankInput());
    run.deathTimer += 1;
    if (run.deathTimer > 72) run.mode = 'dead';
    run.shake *= 0.9;
    return;
  }
  if (run.mode !== 'play') return;
  if (input.pause) {
    run.mode = 'pause';
    run.menuIndex = 0;
    run.events.push({ t: 'sfx', id: 'ui' });
    return;
  }
  if (input.map) {
    run.mode = 'map';
    run.events.push({ t: 'sfx', id: 'ui' });
    return;
  }
  if (run.hitstop > 0) {
    latchEdges(run.buf, input);
    run.hitstop -= 1;
    run.shake *= 0.9;
    return;
  }
  const frame = mergeInput(input, run.buf);
  run.buf = blankEdges();
  run.time += 1;
  run.stats.frames = run.time;
  if (run.gate > 0) run.gate -= 1;
  if (run.comboTimer > 0) {
    run.comboTimer -= 1;
    if (run.comboTimer <= 0) run.combo = 0;
  }
  run.energy = Math.min(run.energyMax, run.energy + run.energyRegen + run.regenBonus);
  stepPlayer(run, frame);
  if (run.mode !== 'play') return;
  stepEnemies(run);
  stepProjectiles(run);
  stepTelegraphs(run);
  resolveCombat(run);
  if (run.mode !== 'play') return;
  checkClear(run);
  if (run.mode !== 'play') return;
  refreshPrompt(run);
  if (frame.interact) interact(run);
  if (run.mode !== 'play') return;
  checkExit(run);
  advanceTutorial(run);
  run.shake *= 0.86;
  if (run.shake < 0.08) run.shake = 0;
}

export function weaponName(id: WeaponId): string {
  return WEAPONS[id].name;
}

export function eventOf(run: Run) {
  const room = currentRoom(run);
  return eventById(room.eventId ?? 'fountain');
}

export { currentRoom, shopStock };
