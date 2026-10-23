import Phaser from 'phaser';
import { TILE, VIEW_H, VIEW_W } from '../../core/constants';
import { clamp } from '../../core/math';
import { blankInput, type RoomType } from '../../core/types';
import { audio } from '../../audio/audio';
import { biomeAt } from '../../data/biomes';
import { relicById, activeSynergies } from '../../data/relics';
import { t, type StringKey } from '../../data/strings';
import { WEAPONS } from '../../data/weapons';
import { BIND_ORDER, captureKey, gather, gatherHeld, keyLabel, type BindAction, type Gathered } from '../../input/controls';
import { bakeRoom } from '../../render/bake';
import { ENEMY_BOX, PLAYER_H, PLAYER_OX, PLAYER_OY, PLAYER_W, enemyKey, playerKey } from '../../render/sprites';
import { label, setLabel, wrapText } from '../../render/text';
import { bankRun, loadSave, storeCheckpoint, writeSave, type SaveFile } from '../../save/save';
import type { MetaRanks } from '../../data/meta';
import { syncTouch } from '../../ui/touch';
import {
  applyEvent,
  buyItem,
  chooseRest,
  createRun,
  currentRoom,
  enterRoom,
  eventOf,
  pickReward,
  skipReward,
  stepRun,
} from '../../sim/run';
import { shopStock } from '../../sim/loot';
import type { Run } from '../../sim/model';

const BIND_KEY: Record<BindAction, StringKey> = {
  left: 'keyLeft',
  right: 'keyRight',
  up: 'keyUp',
  down: 'keyDown',
  jump: 'keyJump',
  attack: 'keyAttack',
  heavy: 'keyHeavy',
  dash: 'keyDash',
  parry: 'keyParry',
  skill: 'keySkill',
  heal: 'keyHeal',
  interact: 'keyInteract',
  map: 'keyMap',
  pause: 'keyPause',
};

const ROOM_KEY: Record<RoomType, StringKey> = {
  start: 'roomStart',
  combat: 'roomCombat',
  elite: 'roomElite',
  treasure: 'roomTreasure',
  shop: 'roomShop',
  event: 'roomEvent',
  rest: 'roomRest',
  secret: 'roomSecret',
  boss: 'roomBoss',
};

export class RunScene extends Phaser.Scene {
  constructor() {
    super('run');
  }

  private save!: SaveFile;
  private run!: Run;
  private ranks!: MetaRanks;
  private acc = 0;
  private world!: Phaser.GameObjects.Container;
  private ui!: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Container;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private gfx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private mapG!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Image;
  private fadeRect!: Phaser.GameObjects.Rectangle;
  private vignette!: Phaser.GameObjects.Image;
  private floorLabel!: Phaser.GameObjects.Image;
  private goldLabel!: Phaser.GameObjects.Image;
  private promptLabel!: Phaser.GameObjects.Image;
  private comboLabel!: Phaser.GameObjects.Image;
  private tutLabel!: Phaser.GameObjects.Image;
  private weaponLabel!: Phaser.GameObjects.Image;
  private enemies = new Map<number, Phaser.GameObjects.Image>();
  private shots = new Map<number, Phaser.GameObjects.Image>();
  private floats: Array<{ img: Phaser.GameObjects.Image; life: number }> = [];
  private sparks: Array<{ img: Phaser.GameObjects.Image; life: number; max: number }> = [];
  private roomKey = '';
  private panelKey = '';
  private look = 0;
  private camX = 0;
  private camY = 0;
  private fade = 1;
  private askAbandon = false;
  private rebinding: BindAction | null = null;
  private bindCursor = 0;
  private bossTag!: Phaser.GameObjects.Image;
  private showBoxes = false;
  private fromPause = false;

  create(): void {
    this.save = loadSave();
    const launch = (this.registry.get('launch') as string | undefined) ?? 'new';
    const checkpoint = launch === 'continue' ? this.save.checkpoint : null;
    this.ranks = checkpoint?.ranks ?? { ...this.save.meta.ranks };
    const unlocks = this.save.meta.unlocks;
    const arsenal = (['sword', ...(unlocks.hammer ? ['hammer'] : []), ...(unlocks.dagger ? ['dagger'] : [])] as Array<'sword' | 'hammer' | 'dagger'>);
    if (checkpoint) {
      this.run = createRun({
        seed: checkpoint.snap.seed,
        character: checkpoint.snap.character,
        weapon: checkpoint.snap.weapon,
        arsenal: checkpoint.snap.arsenal,
        ranks: this.ranks,
        restore: checkpoint.snap,
      });
    } else if (launch === 'tutorial') {
      this.run = createRun({
        seed: 1,
        character: 'wanderer',
        weapon: 'sword',
        arsenal: ['sword'],
        ranks: { hp: 0, flask: 0, dash: 0, purse: 0, regen: 0 },
        tutorial: true,
      });
    } else {
      this.run = createRun({
        seed: this.save.seed,
        character: this.save.character,
        weapon: this.save.weapon,
        arsenal,
        ranks: this.ranks,
      });
    }
    if (import.meta.env.DEV) {
      const q = new URLSearchParams(location.search);
      this.showBoxes = q.has('boxes');
      if (q.has('boss') && !this.run.tutorial) {
        const floor = this.run.floors[Number(q.get('floor') ?? 0)] ?? this.run.floors[0];
        if (floor) enterRoom(this.run, floor.bossId, 'spawn', false);
      }
    }
    audio.unlock();
    audio.musicVol = this.save.settings.music;
    audio.sfxVol = this.save.settings.sfx;
    audio.applyVolumes();
    this.cameras.main.setBackgroundColor('#07060a');
    this.cameras.main.setRoundPixels(true);
    this.far = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'para:ash:far').setOrigin(0, 0);
    this.near = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'para:ash:near').setOrigin(0, 0);
    this.world = this.add.container(0, 0);
    this.gfx = this.add.graphics();
    this.world.add(this.gfx);
    this.player = this.add.image(0, 0, playerKey('wanderer', 'sword', 'idle', 0));
    this.player.setOrigin(PLAYER_OX / PLAYER_W, PLAYER_OY / PLAYER_H);
    this.world.add(this.player);
    this.ui = this.add.container(0, 0);
    this.bars = this.add.graphics();
    this.mapG = this.add.graphics();
    this.ui.add(this.bars);
    this.ui.add(this.mapG);
    this.floorLabel = label(this, 250, 6, ' ');
    this.goldLabel = label(this, 12, 30, ' ');
    this.weaponLabel = label(this, 12, 252, ' ');
    this.promptLabel = label(this, 160, 232, ' ');
    this.comboLabel = label(this, 200, 48, ' ');
    this.tutLabel = label(this, 12, 46, ' ');
    this.bossTag = label(this, 150, 18, ' ');
    this.bossTag.setVisible(false);
    for (const img of [this.floorLabel, this.goldLabel, this.weaponLabel, this.promptLabel, this.comboLabel, this.tutLabel, this.bossTag]) {
      this.ui.add(img);
    }
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0, 0).setAlpha(0.4);
    this.ui.add(this.vignette);
    this.panel = this.add.container(0, 0);
    this.ui.add(this.panel);
    this.fadeRect = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x07060a, 1).setOrigin(0, 0);
    this.ui.add(this.fadeRect);
    this.ui.sendToBack(this.vignette);
    this.fade = 1;
    this.rebuildRoom();
    this.drain();
  }

  update(_time: number, delta: number): void {
    if (this.rebinding) {
      this.present();
      return;
    }
    this.acc += Math.min(delta, 80);
    let steps = 0;
    let first = true;
    while (this.acc >= 1000 / 60 && steps < 4) {
      const got = first ? gather(this.save.settings.bindings) : null;
      first = false;
      if (this.run.mode === 'play' || this.run.mode === 'dying') {
        const frame = this.run.mode === 'dying' || !got ? blankInput() : got.frame;
        if (!got && this.run.mode === 'play') {
          const held = gatherHeld(this.save.settings.bindings);
          stepRun(this.run, held);
        } else stepRun(this.run, frame);
        this.drain();
      } else if (got) this.menu(got);
      this.acc -= 1000 / 60;
      steps += 1;
    }
    this.maybeBank();
    this.present();
    audio.pump();
    syncTouch(this.save.settings, true);
  }

  private menu(got: Gathered): void {
    const count = this.optionCount();
    if (got.frame.up) this.run.menuIndex = (this.run.menuIndex - 1 + count) % count;
    if (got.frame.down) this.run.menuIndex = (this.run.menuIndex + 1) % count;
    if ((this.run.mode === 'settings' || this.askAbandon) && got.frame.x !== 0) this.nudge(got.frame.x);
    if (got.confirm) this.activate();
    if (got.cancel) this.cancel();
  }

  private optionCount(): number {
    const mode = this.run.mode;
    if (this.askAbandon) return 2;
    if (mode === 'pause') return this.run.tutorial ? 4 : 5;
    if (mode === 'reward') return (this.run.reward?.choices.length ?? 0) + 1;
    if (mode === 'shop') return shopStock(this.run, this.run.roomId).length + 1;
    if (mode === 'rest') return 4;
    if (mode === 'event') return eventOf(this.run).choices.length;
    if (mode === 'dialogue') return 1;
    if (mode === 'settings') return 7;
    if (mode === 'map') return 1;
    if (mode === 'dead' || mode === 'victory') return 2;
    if (this.run.tutorial && this.run.tutFlags.done) return 1;
    return 1;
  }

  private cancel(): void {
    const mode = this.run.mode;
    if (this.askAbandon) {
      this.askAbandon = false;
      return;
    }
    if (mode === 'map') {
      this.run.mode = this.fromPause ? 'pause' : 'play';
      this.fromPause = false;
      return;
    }
    if (mode === 'settings') {
      this.run.mode = 'pause';
      this.run.menuIndex = 0;
      return;
    }
    if (mode === 'pause') this.run.mode = 'play';
    else if (mode === 'shop' || mode === 'dialogue' || mode === 'rest') this.run.mode = 'play';
    else if (mode === 'reward') {
      skipReward(this.run);
      this.drain();
    }
    audio.play('ui');
  }

  private nudge(dir: number): void {
    if (this.run.mode !== 'settings') return;
    const i = this.run.menuIndex;
    if (i === 0) this.save.settings.music = clamp01(this.save.settings.music + dir * 0.1);
    if (i === 1) this.save.settings.sfx = clamp01(this.save.settings.sfx + dir * 0.1);
    if (i === 2) this.save.settings.shake = dir > 0;
    if (i === 5) {
      this.bindCursor = (this.bindCursor + (dir > 0 ? 1 : BIND_ORDER.length - 1)) % BIND_ORDER.length;
      return;
    }
    if (i === 3) {
      const order = ['auto', 'on', 'off'] as const;
      const at = order.indexOf(this.save.settings.touch);
      this.save.settings.touch = order[(at + (dir > 0 ? 1 : order.length - 1)) % order.length]!;
    }
    audio.musicVol = this.save.settings.music;
    audio.sfxVol = this.save.settings.sfx;
    audio.applyVolumes();
    writeSave(this.save);
  }

  private activate(): void {
    const mode = this.run.mode;
    const i = this.run.menuIndex;
    if (this.run.tutorial && this.run.tutFlags.done && mode === 'play') {
      this.save.meta.tutorialSeen = true;
      writeSave(this.save);
      this.scene.start('title');
      return;
    }
    if (this.askAbandon) {
      if (i === 0) {
        if (!this.run.tutorial) bankRun(this.save, this.run);
        this.scene.start('title');
      } else this.askAbandon = false;
      return;
    }
    if (mode === 'pause') {
      const skip = this.run.tutorial;
      if (i === 0) this.run.mode = 'play';
      else if (i === 1) {
        this.fromPause = true;
        this.run.mode = 'map';
      } else if (i === 2) {
        this.run.mode = 'settings';
        this.run.menuIndex = 0;
      } else if (i === 3 && skip) {
        this.save.meta.tutorialSeen = true;
        writeSave(this.save);
        this.scene.start('title');
      } else if (i === 3) {
        storeCheckpoint(this.save, this.run, this.ranks);
        this.scene.start('title');
      } else if (i === 4) this.askAbandon = true;
      audio.play('ui');
      return;
    }
    if (mode === 'settings') {
      if (i === 4) {
        this.run.mode = 'map';
        this.fromPause = true;
      } else if (i === 5) this.captureBind();
      else if (i === 6) {
        this.run.mode = 'pause';
        this.run.menuIndex = 2;
      }
      return;
    }
    if (mode === 'reward') {
      const n = this.run.reward?.choices.length ?? 0;
      if (i >= n) skipReward(this.run);
      else pickReward(this.run, i);
      this.drain();
      return;
    }
    if (mode === 'shop') {
      const items = shopStock(this.run, this.run.roomId);
      if (i >= items.length) this.run.mode = 'play';
      else {
        buyItem(this.run, i);
        this.drain();
      }
      return;
    }
    if (mode === 'rest') {
      if (i === 0) chooseRest(this.run, 'heal');
      else if (i === 1) chooseRest(this.run, 'hone');
      else if (i === 2) chooseRest(this.run, 'flask');
      else this.run.mode = 'play';
      this.drain();
      return;
    }
    if (mode === 'event') {
      const choice = eventOf(this.run).choices[i];
      if (choice) applyEvent(this.run, choice.effect);
      this.drain();
      return;
    }
    if (mode === 'dialogue' || mode === 'map') {
      this.run.mode = mode === 'map' && this.fromPause ? 'pause' : 'play';
      this.fromPause = false;
      return;
    }
    if (mode === 'dead' || mode === 'victory') {
      if (i === 0) {
        this.save.seed = 1 + Math.floor(Math.random() * 999983);
        writeSave(this.save);
        this.registry.set('launch', 'new');
        this.scene.restart();
      } else this.scene.start('title');
    }
  }

  private captureBind(): void {
    const which = BIND_ORDER[this.bindCursor]!;
    this.rebinding = which;
    this.panelKey = '';
    captureKey((code) => {
      this.rebinding = null;
      if (code) {
        for (const key of BIND_ORDER) this.save.settings.bindings[key] = this.save.settings.bindings[key].filter((c) => c !== code);
        this.save.settings.bindings[which] = [code, ...this.save.settings.bindings[which]].slice(0, 2);
        writeSave(this.save);
        audio.play('pickup');
      }
      this.panelKey = '';
    });
  }

  private maybeBank(): void {
    if (this.run.tutorial || this.run.banked) return;
    if (this.run.mode === 'dead' || this.run.mode === 'victory') bankRun(this.save, this.run);
  }

  private drain(): void {
    const events = this.run.events.splice(0);
    for (const e of events) {
      if (e.t === 'sfx' && e.id) audio.play(e.id);
      if (e.t === 'save') storeCheckpoint(this.save, this.run, this.ranks);
      if ((e.t === 'float' || e.t === 'fx' || e.t === 'slash') && e.x !== undefined && e.y !== undefined) {
        if (e.t === 'float' && e.text) this.spawnFloat(e.x, e.y, e.text, e.color ?? '#f4f0ea');
        else this.spawnSpark(e.x, e.y, e.kind ?? e.id ?? 'spark', e.facing);
      }
    }
  }

  private spawnFloat(x: number, y: number, text: string, color: string): void {
    const img = label(this, x, y, text, color);
    img.setOrigin(0.5, 1);
    this.world.add(img);
    this.floats.push({ img, life: 46 });
  }

  private spawnSpark(x: number, y: number, kind: string, facing?: 1 | -1): void {
    const key = this.textures.exists(`fx:${kind}:0`) ? `fx:${kind}:0` : 'fx:spark:0';
    const img = this.add.image(x, y, key);
    if (facing === -1) img.setFlipX(true);
    this.world.add(img);
    this.sparks.push({ img, life: 12, max: 12 });
  }

  private present(): void {
    const room = currentRoom(this.run);
    const biome = biomeAt(this.run.floorIndex).id;
    const nextKey = `${room.id}:${this.run.roomRevision}:${biome}`;
    if (this.roomKey !== nextKey) this.rebuildRoom();
    const p = this.run.player;
    this.look += (p.facing * 32 - this.look) * 0.08;
    const maxX = Math.max(0, room.w * TILE - VIEW_W);
    const maxY = Math.max(0, room.h * TILE - VIEW_H);
    this.camX += (clamp(p.x - VIEW_W * 0.42 + this.look, 0, maxX) - this.camX) * 0.2;
    this.camY += (clamp(p.y - VIEW_H * 0.62, 0, maxY) - this.camY) * 0.16;
    const mag = this.save.settings.shake ? this.run.shake : 0;
    const sx = mag ? (Math.random() - 0.5) * mag * 2.2 : 0;
    const sy = mag ? (Math.random() - 0.5) * mag * 2.2 : 0;
    this.world.x = Math.round(-this.camX + sx);
    this.world.y = Math.round(-this.camY + sy);
    this.far.setTexture(`para:${biome}:far`);
    this.near.setTexture(`para:${biome}:near`);
    this.far.tilePositionX = this.camX * 0.22;
    this.far.tilePositionY = this.camY * 0.08;
    this.near.tilePositionX = this.camX * 0.45;
    this.near.tilePositionY = this.camY * 0.16;
    const pkey = playerKey(this.run.character, this.run.weapon, p.anim, p.animFrame);
    this.player.setTexture(this.textures.exists(pkey) ? pkey : playerKey(this.run.character, this.run.weapon, 'idle', 0));
    this.player.setPosition(p.x, p.y);
    this.player.setFlipX(p.facing === -1);
    const flicker = p.invuln > 0 && Math.floor(this.run.time / 2) % 2 === 0;
    this.player.setAlpha(p.state === 'dead' ? 0.7 : p.iFrame ? 0.45 : flicker ? 0.25 : 1);
    this.player.clearTint();
    if (this.run.hitstop > 0) this.player.setTintFill(0xfff1d2);
    this.syncActors();
    this.drawWorldFx();
    this.drawHud();
    this.syncPanel();
    this.fade = Math.max(0, this.fade - 0.08);
    this.fadeRect.setAlpha(this.fade);
    const low = p.hp / Math.max(1, p.maxHp) < 0.3;
    this.vignette.setAlpha(low && Math.floor(this.time.now / 180) % 2 === 0 ? 0.7 : 0.4);
    if (low) this.vignette.setTint(0xff8080);
    else this.vignette.clearTint();
    const boss = this.run.enemies.some((e) => e.boss && e.alive);
    audio.setCue(this.run.mode === 'dead' ? 'none' : boss ? 'boss' : biome);
    for (const mote of this.world.list) {
      if (mote instanceof Phaser.GameObjects.Image && mote.getData('mote')) {
        const base = mote.getData('base') as number;
        mote.y = base + Math.sin(this.time.now / 500 + mote.x) * 3;
      }
    }
  }

  private rebuildRoom(): void {
    const room = currentRoom(this.run);
    const biome = biomeAt(this.run.floorIndex).id;
    const key = `${room.id}:${this.run.roomRevision}:${biome}`;
    const tex = `rm:${key}`;
    if (this.roomKey && this.textures.exists(`rm:${this.roomKey}`)) this.textures.remove(`rm:${this.roomKey}`);
    if (this.textures.exists(tex)) this.textures.remove(tex);
    this.textures.addCanvas(tex, bakeRoom(room, biome));
    this.roomKey = key;
    for (const child of [...this.world.getAll()]) {
      if (child !== this.gfx && child !== this.player) child.destroy();
    }
    this.enemies.clear();
    this.shots.clear();
    this.floats = [];
    this.sparks = [];
    const bg = this.add.image(0, 0, tex).setOrigin(0, 0);
    this.world.addAt(bg, 0);
    for (const prop of room.props) {
      const img = this.add.image(prop.x, prop.y, `pr:${prop.kind}:0`).setOrigin(0.5, 1);
      img.setData('prop', prop.kind);
      this.world.add(img);
    }
    for (let i = 0; i < 8; i++) {
      const mx = 30 + ((i * 97 + room.w * 13) % Math.max(40, room.w * TILE - 60));
      const my = 24 + ((i * 53) % Math.max(30, room.h * TILE - 80));
      const mote = this.add.image(mx, my, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
      mote.setData('mote', true);
      mote.setData('base', my);
      this.world.add(mote);
    }
    this.world.bringToTop(this.player);
    this.world.bringToTop(this.gfx);
    this.fade = 1;
    this.panelKey = '';
  }

  private syncActors(): void {
    const alive = new Set<number>();
    for (const e of this.run.enemies) {
      alive.add(e.eid);
      let sprite = this.enemies.get(e.eid);
      if (!sprite) {
        sprite = this.add.image(e.x, e.y, enemyKey(e.kind, 'idle', 0));
        const box = ENEMY_BOX[e.kind] ?? ENEMY_BOX.guard!;
        sprite.setOrigin(box.ox / box.w, box.oy / box.h);
        this.world.add(sprite);
        this.enemies.set(e.eid, sprite);
      }
      const key = enemyKey(e.kind, e.anim, e.animFrame);
      if (this.textures.exists(key)) sprite.setTexture(key);
      sprite.setPosition(e.x, e.y);
      sprite.setFlipX(e.facing === -1);
      sprite.setAlpha(e.alive ? 1 : Math.max(0, 1 - e.deadTimer / 40));
      sprite.clearTint();
      if (e.flash > 0) sprite.setTintFill(0xffffff);
      else if (e.attack && e.attack.frame < e.attack.def.telegraph) sprite.setTint(0xffb089);
      else if (!e.alive) sprite.setTint(0x886060);
    }
    for (const [id, sprite] of this.enemies) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.enemies.delete(id);
      }
    }
    const shots = new Set<number>();
    for (const proj of this.run.projectiles) {
      shots.add(proj.id);
      let sprite = this.shots.get(proj.id);
      const tex = this.textures.exists(`shot:${proj.kind}`) ? `shot:${proj.kind}` : 'shot:bolt';
      if (!sprite) {
        sprite = this.add.image(proj.x, proj.y, tex);
        this.world.add(sprite);
        this.shots.set(proj.id, sprite);
      }
      sprite.setTexture(tex);
      sprite.setPosition(proj.x, proj.y);
      sprite.setDisplaySize(Math.max(6, proj.w), Math.max(4, proj.h));
      if (proj.kind === 'arrow' || proj.kind === 'bolt') sprite.setRotation(Math.atan2(proj.vy, proj.vx));
    }
    for (const [id, sprite] of this.shots) {
      if (!shots.has(id)) {
        sprite.destroy();
        this.shots.delete(id);
      }
    }
    const frame = Math.floor(this.run.time / 8) % 2;
    for (const child of this.world.list) {
      if (child instanceof Phaser.GameObjects.Image && child.getData('prop')) {
        const kind = child.getData('prop') as string;
        const key = `pr:${kind}:${kind === 'portal' || kind === 'shrine' ? frame : 0}`;
        if (this.textures.exists(key)) child.setTexture(key);
      }
    }
    for (const spark of this.sparks) {
      spark.life -= 1;
      const f = spark.life > 8 ? 0 : spark.life > 4 ? 1 : 2;
      const base = spark.img.texture.key.replace(/:\d$/, '');
      const next = `${base}:${f}`;
      if (this.textures.exists(next)) spark.img.setTexture(next);
      spark.img.setAlpha(spark.life / spark.max);
      if (spark.life <= 0) spark.img.destroy();
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const flo of this.floats) {
      flo.life -= 1;
      flo.img.y -= 0.45;
      flo.img.setAlpha(Math.max(0, flo.life / 46));
      if (flo.life <= 0) flo.img.destroy();
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.world.bringToTop(this.gfx);
  }

  private drawWorldFx(): void {
    const g = this.gfx;
    g.clear();
    const room = currentRoom(this.run);
    for (const tele of this.run.telegraphs) {
      const a = 0.18 + 0.55 * (1 - tele.life / Math.max(1, tele.max));
      if (tele.kind === 'circle') {
        g.lineStyle(2, 0xff6a2a, a + 0.2);
        g.strokeCircle(tele.x + tele.w / 2, tele.y + tele.h / 2, tele.w / 2);
        g.fillStyle(0xffb03a, a * 0.35);
        g.fillCircle(tele.x + tele.w / 2, tele.y + tele.h / 2, tele.w / 2);
      } else {
        g.fillStyle(0xff6a2a, a * 0.45);
        g.fillRect(tele.x, tele.y, tele.w, tele.h);
        g.lineStyle(1, 0xfff1c2, Math.min(1, a + 0.2));
        g.strokeRect(tele.x, tele.y, tele.w, tele.h);
      }
    }
    if (room.locked) {
      g.lineStyle(1, 0xff6a2a, 0.9);
      const floorY = (room.h - 3) * TILE;
      if (room.doors.l) {
        for (const x of [4, 8, 12]) g.lineBetween(x, floorY, x, floorY + TILE * 2);
      }
      if (room.doors.r) {
        const edge = room.w * TILE;
        for (const x of [1, 5, 9]) g.lineBetween(edge - x, floorY, edge - x, floorY + TILE * 2);
      }
      if (room.doors.d) {
        const x = room.downTile * TILE;
        const edge = room.h * TILE;
        for (let k = 0; k < 3; k++) g.lineBetween(x - TILE + k * 8, edge - 6, x + TILE, edge - 10);
      }
    }
    if (this.showBoxes) {
      g.lineStyle(1, 0x7dffb0, 0.8);
      const p = this.run.player;
      g.strokeRect(p.x - p.w / 2, p.y - p.h, p.w, p.h);
      g.lineStyle(1, 0xff8080, 0.8);
      for (const e of this.run.enemies) if (e.alive) g.strokeRect(e.x - e.w / 2, e.y - e.h, e.w, e.h);
    }
  }

  private drawHud(): void {
    const menu = this.run.mode !== 'play' && this.run.mode !== 'dying';
    this.bars.setVisible(!menu);
    this.mapG.setVisible(!menu);
    for (const img of [this.floorLabel, this.goldLabel, this.weaponLabel, this.promptLabel, this.comboLabel, this.tutLabel]) {
      img.setVisible(!menu);
    }
    if (menu) {
      this.bossTag.setVisible(false);
      return;
    }
    const p = this.run.player;
    const g = this.bars;
    g.clear();
    g.fillStyle(0x1a1218, 0.9);
    g.fillRect(10, 8, 104, 8);
    g.fillStyle(p.hp / p.maxHp < 0.3 ? 0xff5050 : 0xe25a3a, 1);
    g.fillRect(11, 9, Math.max(0, 102 * (p.hp / Math.max(1, p.maxHp))), 6);
    g.fillStyle(0x1a1218, 0.9);
    g.fillRect(10, 18, 78, 5);
    g.fillStyle(0x7ad0ff, 1);
    g.fillRect(11, 19, 76 * (this.run.energy / Math.max(1, this.run.energyMax)), 3);
    for (let i = 0; i < this.run.flaskMax; i++) {
      g.fillStyle(i < this.run.flasks ? 0x8dffb0 : 0x243028, 1);
      g.fillRect(92 + i * 7, 18, 5, 5);
    }
    for (let i = 0; i < this.run.dashMax; i++) {
      g.fillStyle(i < p.dashCharges ? 0xf4f0ea : 0x3a3444, 1);
      g.fillRect(12 + i * 8, 40, 6, 3);
    }
    const boss = this.run.enemies.find((e) => e.boss && (e.alive || e.deadTimer < 30));
    if (boss) {
      g.fillStyle(0x140c12, 0.9);
      g.fillRect(140, 8, 160, 8);
      g.fillStyle(boss.phase >= 3 ? 0xb9a6ff : boss.phase === 2 ? 0xffb03a : 0xff6a2a, 1);
      g.fillRect(141, 9, 158 * Math.max(0, boss.hp / Math.max(1, boss.maxHp)), 6);
      setLabel(this.bossTag, `${boss.name} ${t('phase', { n: boss.phase })}`, '#ffd29a');
      this.bossTag.setVisible(true);
      this.bossTag.x = 140;
    } else this.bossTag.setVisible(false);
    setLabel(this.goldLabel, `${t('gold')} ${this.run.gold}`, '#f0c85c');
    const biome = biomeAt(this.run.floorIndex);
    setLabel(this.floorLabel, t('floorName', { biome: biome.name, n: this.run.floorIndex + 1 }), '#f4f0ea');
    this.floorLabel.x = VIEW_W - this.floorLabel.width - 8;
    setLabel(this.weaponLabel, WEAPONS[this.run.weapon].name, '#c8bdd4');
    const prompt = this.run.mode === 'play' ? this.run.interactPrompt : '';
    setLabel(this.promptLabel, prompt || ' ', '#ffd29a');
    this.promptLabel.x = (VIEW_W - this.promptLabel.width) / 2;
    if (this.run.combo >= 2) setLabel(this.comboLabel, t('combo', { n: this.run.combo }), '#ffd29a');
    else setLabel(this.comboLabel, ' ', '#ffd29a');
    this.comboLabel.x = (VIEW_W - this.comboLabel.width) / 2;
    if (this.run.tutorial && !this.run.tutFlags.done && this.run.tutStep <= 7) {
      const line = t(`tut${this.run.tutStep}` as StringKey);
      setLabel(this.tutLabel, wrapText(line, 300)[0] ?? ' ', '#f4f0ea');
    } else setLabel(this.tutLabel, ' ', '#f4f0ea');
    this.drawMinimap();
  }

  private drawMinimap(): void {
    const g = this.mapG;
    g.clear();
    const floor = this.run.floors[this.run.floorIndex];
    if (!floor) return;
    let maxX = 0;
    let maxY = 0;
    for (const room of floor.rooms) {
      maxX = Math.max(maxX, room.gx);
      maxY = Math.max(maxY, room.gy);
    }
    const cell = 7;
    const ox = VIEW_W - (maxX + 1) * cell - 10;
    const oy = 22;
    for (const room of floor.rooms) {
      if (!room.seen && !room.explored) continue;
      const x = ox + room.gx * cell;
      const y = oy + room.gy * cell;
      const here = room.id === this.run.roomId;
      g.fillStyle(here ? 0xffd29a : room.explored ? 0x8a7d96 : 0x3a3444, 1);
      g.fillRect(x, y, cell - 1, cell - 1);
    }
  }

  private syncPanel(): void {
    const sig = [
      this.run.mode,
      this.run.menuIndex,
      this.askAbandon ? 1 : 0,
      this.rebinding ?? '',
      this.run.reward?.choices.map((c) => c.id).join(',') ?? '',
      this.run.gold,
      this.run.shopSold.join(','),
      this.run.dialogue?.title ?? '',
      this.run.player.hp,
      this.run.tutFlags.done ? 1 : 0,
      this.run.coresGained,
      this.save.settings.music,
      this.save.settings.sfx,
      this.save.settings.shake ? 1 : 0,
      this.save.settings.touch,
      this.bindCursor,
    ].join('|');
    if (sig === this.panelKey) return;
    this.panelKey = sig;
    this.panel.removeAll(true);
    if (this.run.tutorial && this.run.tutFlags.done && this.run.mode === 'play') {
      this.block();
      this.heading(t('tutorialDone'), 70);
      this.bodyText(t('tutorialDoneBody'), 96);
      this.choice(150, t('gotIt'), 0);
      return;
    }
    const mode = this.run.mode;
    if (mode === 'play' || mode === 'dying') return;
    this.block();
    if (this.askAbandon) {
      this.heading(t('abandonAsk'), 80);
      this.choice(130, t('abandonConfirm'), 0, '#ffb0a0');
      this.choice(150, t('no'), 1);
      return;
    }
    if (mode === 'pause') this.paintPause();
    else if (mode === 'settings') this.paintSettings();
    else if (mode === 'map') this.paintMap();
    else if (mode === 'reward') this.paintReward();
    else if (mode === 'shop') this.paintShop();
    else if (mode === 'rest') this.paintRest();
    else if (mode === 'event') this.paintEvent();
    else if (mode === 'dialogue') this.paintDialogue();
    else if (mode === 'dead' || mode === 'victory') this.paintEnd();
  }

  private block(): void {
    const dim = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x07040c, 0.94).setOrigin(0, 0);
    this.panel.add(dim);
  }

  private heading(text: string, y: number): void {
    this.panel.add(label(this, 28, y, text, '#ffd29a'));
  }

  private bodyText(text: string, y: number): number {
    let cursor = y;
    for (const line of wrapText(text, 420)) {
      this.panel.add(label(this, 28, cursor, line, '#f4f0ea'));
      cursor += 14;
    }
    return cursor;
  }

  private choice(y: number, text: string, index: number, color = '#f4f0ea'): void {
    const on = index === this.run.menuIndex;
    if (on) {
      const g = this.add.graphics();
      g.fillStyle(0xffd29a, 1);
      g.fillRect(28, y + 3, 6, 6);
      this.panel.add(g);
    }
    const img = label(this, 40, y, text, on ? '#ffd29a' : color);
    this.panel.add(img);
    img.setInteractive({ useHandCursor: true });
    img.on('pointerdown', () => {
      this.run.menuIndex = index;
      this.activate();
      this.panelKey = '';
    });
  }

  private paintPause(): void {
    this.heading(t('pauseTitle'), 48);
    const rows = this.run.tutorial
      ? [t('resume'), t('map'), t('settings'), t('tutorialSkip')]
      : [t('resume'), t('map'), t('settings'), t('saveQuit'), t('abandon')];
    rows.forEach((text, i) => this.choice(78 + i * 18, text, i, i === rows.length - 1 && !this.run.tutorial ? '#ffb0a0' : '#f4f0ea'));
    const names = this.run.relics.map((id) => relicById(id)?.name ?? id).join('  ');
    this.bodyText(`${t('ownedRelics')}  ${names || t('noOwned')}`, 180);
    const syn = activeSynergies(this.run.relics).map((s) => s.name).join(' ');
    if (syn) this.panel.add(label(this, 28, 220, `${t('synergy')} ${syn}`, '#7ae0ff'));
  }

  private paintSettings(): void {
    this.heading(t('settingsTitle'), 36);
    const touch = this.save.settings.touch === 'on' ? t('touchOn') : this.save.settings.touch === 'off' ? t('touchOff') : t('touchAuto');
    const action = BIND_ORDER[this.bindCursor]!;
    const shown = this.rebinding === action ? t('rebindHint') : keyLabel(this.save.settings.bindings[action][0] ?? '');
    const rows = [
      `${t('music')}  ${Math.round(this.save.settings.music * 10)}`,
      `${t('sfx')}  ${Math.round(this.save.settings.sfx * 10)}`,
      `${t('shake')}  ${this.save.settings.shake ? t('on') : t('off')}`,
      `${t('touch')}  ${touch}`,
      t('map'),
      `${t('rebind')}  ${t(BIND_KEY[action])} ${shown}`,
      t('back'),
    ];
    rows.forEach((text, i) => this.choice(64 + i * 16, text, i));
    if (this.rebinding) this.panel.add(label(this, 28, 190, `${t(BIND_KEY[this.rebinding])}  ${t('rebindHint')}`, '#ffd29a'));
  }

  private paintMap(): void {
    this.heading(t('mapTitle'), 16);
    const floor = this.run.floors[this.run.floorIndex]!;
    let maxX = 0;
    let maxY = 0;
    for (const room of floor.rooms) {
      maxX = Math.max(maxX, room.gx);
      maxY = Math.max(maxY, room.gy);
    }
    const cell = 32;
    const ox = Math.max(20, (VIEW_W - (maxX + 1) * cell) / 2);
    const oy = 40;
    const g = this.add.graphics();
    this.panel.add(g);
    for (const room of floor.rooms) {
      for (const dir of ['r', 'd'] as const) {
        const nid = room.doors[dir];
        if (!nid) continue;
        const other = floor.rooms.find((r) => r.id === nid);
        if (!other) continue;
        if (!room.seen && !other.seen && !room.explored && !other.explored) continue;
        const secret = room.secret[dir] && !room.secretOpen && !other.secretOpen;
        if (secret && !room.explored && !other.explored) continue;
        g.lineStyle(2, secret ? 0x6a5080 : 0x8a7d96, 1);
        g.lineBetween(ox + room.gx * cell + 14, oy + room.gy * cell + 14, ox + other.gx * cell + 14, oy + other.gy * cell + 14);
      }
    }
    for (const room of floor.rooms) {
      if (!room.seen && !room.explored) continue;
      const x = ox + room.gx * cell;
      const y = oy + room.gy * cell;
      const here = room.id === this.run.roomId;
      g.fillStyle(here ? 0xffd29a : room.explored ? 0x2a2434 : 0x18141e, 1);
      g.fillRect(x, y, 28, 28);
      g.lineStyle(1, here ? 0xfff1c2 : 0x6a6080, 1);
      g.strokeRect(x, y, 28, 28);
      const text = room.explored ? t(ROOM_KEY[room.type]).slice(0, 2) : '?';
      const img = label(this, x + 2, y + 8, text, here ? '#1a120c' : '#f4f0ea');
      this.panel.add(img);
    }
    this.panel.add(label(this, 16, 236, wrapText(t('mapHint'), 360)[0] ?? '', '#8a7d96'));
    this.choice(250, t('close'), 0);
  }

  private paintReward(): void {
    const reward = this.run.reward;
    this.heading(reward?.title ?? t('rewardTitle'), 28);
    let y = 52;
    reward?.choices.forEach((choice, i) => {
      const rarity = choice.rarity === 'epic' ? t('rarityEpic') : choice.rarity === 'rare' ? t('rarityRare') : t('rarityCommon');
      const color = choice.rarity === 'epic' ? '#e7b6ff' : choice.rarity === 'rare' ? '#7ad0ff' : '#f4f0ea';
      this.choice(y, `${choice.name}  ${rarity}`, i, color);
      y += 14;
      for (const line of wrapText(choice.desc, 400)) {
        this.panel.add(label(this, 52, y, line, '#c8bdd4'));
        y += 13;
      }
      y += 4;
    });
    this.choice(y, t('rewardSkip'), reward?.choices.length ?? 0);
  }

  private paintShop(): void {
    this.heading(t('shopTitle'), 24);
    this.panel.add(label(this, 300, 24, `${t('gold')} ${this.run.gold}`, '#f0c85c'));
    this.panel.add(label(this, 28, 42, t('shopGreet'), '#c8bdd4'));
    const items = shopStock(this.run, this.run.roomId);
    let y = 64;
    items.forEach((item, i) => {
      const sold = this.run.shopSold.includes(`${this.run.roomId}:${i}`);
      const text = sold ? `${item.name}  ${t('sold')}` : `${item.name}  ${t('price', { n: item.price })}`;
      this.choice(y, text, i, sold ? '#8a7d96' : '#f4f0ea');
      y += 14;
      this.panel.add(label(this, 52, y, item.desc, '#c8bdd4'));
      y += 16;
    });
    this.choice(y, t('shopLeave'), items.length);
  }

  private paintRest(): void {
    this.heading(t('restTitle'), 36);
    this.bodyText(t('restGreet'), 58);
    this.choice(100, `${t('restHeal')}  ${t('restHealDesc')}`, 0);
    this.choice(118, `${t('restHone')}  ${t('restHoneDesc')}`, 1);
    this.choice(136, `${t('restFlask')}  ${t('restFlaskDesc')}`, 2);
    this.choice(160, t('eventLeave'), 3);
  }

  private paintEvent(): void {
    const ev = eventOf(this.run);
    this.heading(ev.title, 28);
    let y = this.bodyText(ev.body, 52);
    y += 8;
    ev.choices.forEach((choice, i) => {
      this.choice(y, choice.label, i);
      y += 14;
      for (const line of wrapText(choice.detail, 400)) {
        this.panel.add(label(this, 52, y, line, '#c8bdd4'));
        y += 13;
      }
      y += 4;
    });
  }

  private paintDialogue(): void {
    const d = this.run.dialogue;
    this.heading(d?.title ?? t('loreTitle'), 48);
    const y = this.bodyText(d?.body ?? '', 76);
    this.choice(y + 12, t('close'), 0);
  }

  private paintEnd(): void {
    const win = this.run.mode === 'victory' || this.run.victory;
    this.heading(win ? t('winTitle') : t('deadTitle'), 28);
    const place = biomeAt(this.run.floorIndex).name;
    let y = this.bodyText(win ? t('winBody') : t('deadBody', { place }), 52);
    if (!win && this.run.lastHit) {
      this.panel.add(label(this, 28, y, t('youDiedTo', { name: this.run.lastHit }), '#ffb0a0'));
      y += 16;
    }
    const sec = Math.floor(this.run.stats.frames / 60);
    const lines = [
      `${t('summaryFloor')}  ${t('floorName', { biome: place, n: this.run.floorIndex + 1 })}`,
      `${t('summaryKills')}  ${this.run.stats.kills}`,
      `${t('summaryGold')}  ${this.run.gold}`,
      `${t('summaryCores')}  ${this.run.coresGained}`,
      `${t('summaryTime')}  ${t('timeFmt', { m: Math.floor(sec / 60), s: String(sec % 60).padStart(2, '0') })}`,
      `${t('summarySeed')}  ${this.run.seed}`,
    ];
    for (const line of lines) {
      this.panel.add(label(this, 28, y, line, '#f4f0ea'));
      y += 14;
    }
    this.choice(y + 8, t('again'), 0);
    this.choice(y + 26, t('toTitle'), 1);
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 10) / 10));
}
