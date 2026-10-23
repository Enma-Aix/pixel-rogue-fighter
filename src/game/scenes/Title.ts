import Phaser from 'phaser';
import { CHARACTERS } from '../../data/characters';
import { UPGRADES } from '../../data/meta';
import { t, type StringKey } from '../../data/strings';
import { WEAPONS } from '../../data/weapons';
import type { CharacterId, WeaponId } from '../../core/types';
import { audio } from '../../audio/audio';
import { BIND_ORDER, captureKey, gather, keyLabel, type BindAction } from '../../input/controls';
import { label, wrapText } from '../../render/text';
import { PLAYER_H, PLAYER_OX, PLAYER_OY, PLAYER_W, playerKey } from '../../render/sprites';
import { loadSave, wipeSave, writeSave, type SaveFile } from '../../save/save';
import { syncTouch } from '../../ui/touch';

type Screen = 'main' | 'help' | 'credits' | 'settings' | 'rebind' | 'altar' | 'loadout' | 'overwrite' | 'wipe';

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

export class Title extends Phaser.Scene {
  constructor() {
    super('title');
  }

  private save!: SaveFile;
  private screen: Screen = 'main';
  private index = 0;
  private built = '';
  private root!: Phaser.GameObjects.Container;
  private hero!: Phaser.GameObjects.Image;
  private rebinding: BindAction | null = null;

  create(): void {
    this.save = loadSave();
    this.sanitize();
    audio.unlock();
    audio.musicVol = this.save.settings.music;
    audio.sfxVol = this.save.settings.sfx;
    audio.applyVolumes();
    audio.setCue('title');
    this.cameras.main.setBackgroundColor('#07060a');
    this.cameras.main.setRoundPixels(true);
    const far = this.add.tileSprite(0, 0, 480, 270, 'para:ash:far').setOrigin(0, 0);
    const near = this.add.tileSprite(0, 0, 480, 270, 'para:ash:near').setOrigin(0, 0);
    far.setAlpha(0.95);
    near.setAlpha(0.55);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setAlpha(0.85);
    this.hero = this.add.image(400, 210, playerKey(this.save.character, this.save.weapon, 'idle', 0));
    this.hero.setOrigin(PLAYER_OX / PLAYER_W, PLAYER_OY / PLAYER_H);
    this.root = this.add.container(0, 0);
    this.built = '';
    this.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.tick, this);
  }

  private sanitize(): void {
    const u = this.save.meta.unlocks;
    if (this.save.character === 'dancer' && !u.dancer) this.save.character = 'wanderer';
    if (this.save.character === 'bulwark' && !u.bulwark) this.save.character = 'wanderer';
    if (this.save.weapon === 'hammer' && !u.hammer) this.save.weapon = 'sword';
    if (this.save.weapon === 'dagger' && !u.dagger) this.save.weapon = 'sword';
  }

  private tick = (): void => {
    audio.pump();
    syncTouch(this.save.settings, false);
    const tiles = this.children.list.filter((c) => c instanceof Phaser.GameObjects.TileSprite) as Phaser.GameObjects.TileSprite[];
    const scroll = this.time.now / 1000;
    if (tiles[0]) tiles[0].tilePositionX = scroll * 6;
    if (tiles[1]) tiles[1].tilePositionX = scroll * 14;
    const frame = Math.floor(this.time.now / 140) % 6;
    const key = playerKey(this.save.character, this.save.weapon, 'idle', frame);
    if (this.textures.exists(key)) this.hero.setTexture(key);
    this.hero.y = 210 + Math.sin(this.time.now / 400) * 1;
    if (!this.rebinding) {
    const got = gather(this.save.settings.bindings);
    const count = this.optionCount();
    if (got.frame.up) this.index = (this.index - 1 + count) % count;
    if (got.frame.down) this.index = (this.index + 1) % count;
    if (this.screen === 'loadout' || this.screen === 'settings' || this.screen === 'altar') {
      if (got.frame.x < 0) this.nudge(-1);
      if (got.frame.x > 0) this.nudge(1);
    }
    if (got.confirm) this.activate();
    if (got.cancel && this.screen !== 'main') this.back();
    }
    const sig = `${this.screen}|${this.index}|${this.save.meta.cores}|${this.save.character}|${this.save.weapon}|${this.save.seed}|${this.save.settings.music}|${this.save.settings.sfx}|${this.save.settings.shake}|${this.save.settings.touch}|${this.rebinding}`;
    if (sig !== this.built) {
      this.built = sig;
      this.paint();
    }
  };

  private optionCount(): number {
    if (this.screen === 'main') return this.mainRows().length;
    if (this.screen === 'help' || this.screen === 'credits') return 1;
    if (this.screen === 'overwrite' || this.screen === 'wipe') return 2;
    if (this.screen === 'altar') return UPGRADES.length + 1;
    if (this.screen === 'loadout') return 6;
    if (this.screen === 'rebind') return BIND_ORDER.length + 1;
    return 7;
  }

  private back(): void {
    if (this.screen === 'rebind' || this.screen === 'wipe') this.screen = 'settings';
    else this.screen = 'main';
    this.index = 0;
    audio.play('ui');
  }

  private nudge(dir: number): void {
    if (this.screen === 'settings') {
      if (this.index === 0) this.save.settings.music = clamp01(this.save.settings.music + dir * 0.1);
      if (this.index === 1) this.save.settings.sfx = clamp01(this.save.settings.sfx + dir * 0.1);
      if (this.index === 2) this.save.settings.shake = dir > 0;
      if (this.index === 3) {
        const order = ['auto', 'on', 'off'] as const;
        const i = order.indexOf(this.save.settings.touch);
        this.save.settings.touch = order[(i + (dir > 0 ? 1 : order.length - 1)) % order.length]!;
      }
      audio.musicVol = this.save.settings.music;
      audio.sfxVol = this.save.settings.sfx;
      audio.applyVolumes();
      writeSave(this.save);
      audio.play('ui');
    } else if (this.screen === 'loadout') {
      if (this.index === 0) this.cycleChar(dir);
      if (this.index === 1) this.cycleWeapon(dir);
      if (this.index === 2) this.save.seed = Math.max(1, this.save.seed + dir * (this.index === 2 ? 1 : 1));
      writeSave(this.save);
    }
  }

  private cycleChar(dir: number): void {
    const all: CharacterId[] = ['wanderer', 'dancer', 'bulwark'];
    const open = all.filter((id) => id === 'wanderer' || this.save.meta.unlocks[id]);
    const i = Math.max(0, open.indexOf(this.save.character));
    this.save.character = open[(i + (dir > 0 ? 1 : open.length - 1)) % open.length]!;
  }

  private cycleWeapon(dir: number): void {
    const all: WeaponId[] = ['sword', 'hammer', 'dagger'];
    const open = all.filter((id) => id === 'sword' || this.save.meta.unlocks[id]);
    const i = Math.max(0, open.indexOf(this.save.weapon));
    this.save.weapon = open[(i + (dir > 0 ? 1 : open.length - 1)) % open.length]!;
  }

  private activate(): void {
    audio.play('ui');
    if (this.screen === 'main') {
      const rows = this.mainRows();
      const id = rows[this.index]?.id;
      if (id === 'continue') this.depart('continue');
      else if (id === 'start') {
        if (this.save.checkpoint) {
          this.screen = 'overwrite';
          this.index = 0;
        } else this.depart('new');
      } else if (id === 'tutorial') this.depart('tutorial');
      else if (id === 'loadout') {
        this.screen = 'loadout';
        this.index = 0;
      } else if (id === 'altar') {
        this.screen = 'altar';
        this.index = 0;
      } else if (id === 'help') {
        this.screen = 'help';
        this.index = 0;
      } else if (id === 'settings') {
        this.screen = 'settings';
        this.index = 0;
      } else if (id === 'credits') {
        this.screen = 'credits';
        this.index = 0;
      }
      return;
    }
    if (this.screen === 'overwrite') {
      if (this.index === 0) {
        this.save.checkpoint = null;
        writeSave(this.save);
        this.depart('new');
      } else this.back();
      return;
    }
    if (this.screen === 'wipe') {
      if (this.index === 0) {
        wipeSave(this.save);
        this.screen = 'main';
        this.index = 0;
      } else this.back();
      return;
    }
    if (this.screen === 'help' || this.screen === 'credits') {
      this.back();
      return;
    }
    if (this.screen === 'altar') {
      if (this.index >= UPGRADES.length) {
        this.back();
        return;
      }
      this.buyUpgrade(this.index);
      return;
    }
    if (this.screen === 'loadout') {
      if (this.index === 2) {
        this.save.seed = 1 + Math.floor(Math.random() * 999983);
        writeSave(this.save);
      } else if (this.index === 3) {
        if (this.save.checkpoint) {
          this.screen = 'overwrite';
          this.index = 0;
        } else this.depart('new');
      } else if (this.index === 4) this.depart('tutorial');
      else if (this.index === 5) this.back();
      return;
    }
    if (this.screen === 'settings') {
      if (this.index === 4) {
        this.screen = 'rebind';
        this.index = 0;
      } else if (this.index === 5) {
        this.screen = 'wipe';
        this.index = 0;
      } else if (this.index === 6) this.back();
      return;
    }
    if (this.screen === 'rebind') {
      if (this.index >= BIND_ORDER.length) {
        this.back();
        return;
      }
      const action = BIND_ORDER[this.index]!;
      this.rebinding = action;
      this.built = '';
      captureKey((code) => {
        this.rebinding = null;
        if (code) {
          for (const key of BIND_ORDER) {
            this.save.settings.bindings[key] = this.save.settings.bindings[key].filter((c) => c !== code);
          }
          const list = this.save.settings.bindings[action];
          list.unshift(code);
          this.save.settings.bindings[action] = list.slice(0, 2);
          writeSave(this.save);
          audio.play('pickup');
        }
        this.built = '';
      });
    }
  }

  private buyUpgrade(index: number): void {
    const up = UPGRADES[index];
    if (!up) return;
    const rank = up.kind === 'rank' ? this.save.meta.ranks[up.id as keyof typeof this.save.meta.ranks] : this.save.meta.unlocks[up.id as keyof typeof this.save.meta.unlocks] ? 1 : 0;
    if (rank >= up.max) {
      audio.play('deny');
      return;
    }
    const cost = up.cost(rank);
    if (this.save.meta.cores < cost) {
      audio.play('deny');
      return;
    }
    this.save.meta.cores -= cost;
    if (up.kind === 'rank') this.save.meta.ranks[up.id as keyof typeof this.save.meta.ranks] = rank + 1;
    else this.save.meta.unlocks[up.id as keyof typeof this.save.meta.unlocks] = true;
    writeSave(this.save);
    audio.play('buy');
  }

  private depart(mode: 'new' | 'continue' | 'tutorial'): void {
    writeSave(this.save);
    this.registry.set('launch', mode);
    this.scene.start('run');
  }

  private mainRows(): Array<{ id: string; label: string }> {
    const rows: Array<{ id: string; label: string }> = [];
    if (this.save.checkpoint) rows.push({ id: 'continue', label: t('continue') });
    rows.push({ id: 'start', label: t('start') });
    rows.push({ id: 'tutorial', label: t('tutorial') });
    rows.push({ id: 'loadout', label: t('loadoutTitle') });
    rows.push({ id: 'altar', label: t('altar') });
    rows.push({ id: 'help', label: t('help') });
    rows.push({ id: 'settings', label: t('settings') });
    rows.push({ id: 'credits', label: t('credits') });
    return rows;
  }

  private paint(): void {
    this.root.removeAll(true);
    const mark = (y: number, on: boolean) => {
      if (!on) return;
      const g = this.add.graphics();
      g.fillStyle(0xffd29a, 1);
      g.fillRect(28, y + 3, 6, 6);
      this.root.add(g);
    };
    const row = (y: number, text: string, i: number, color = '#f4f0ea') => {
      mark(y, i === this.index);
      const img = label(this, 40, y, text, i === this.index ? '#ffd29a' : color);
      this.root.add(img);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => {
        this.index = i;
        this.activate();
        this.built = '';
      });
    };
    const title = label(this, 28, 18, t('title'), '#ffd29a', 3);
    this.root.add(title);
    this.root.add(label(this, 32, 62, t('subtitle'), '#c8bdd4'));
    let y = 88;
    if (this.screen === 'main') {
      this.root.add(label(this, 28, y, t('cores') + ' ' + this.save.meta.cores, '#f0c85c'));
      y += 18;
      this.mainRows().forEach((item, i) => {
        row(y, item.label, i);
        y += 16;
      });
      const hint = wrapText(t('menuHelp'), 200);
      hint.forEach((line, i) => this.root.add(label(this, 28, 236 + i * 14, line, '#8a7d96')));
      return;
    }
    this.root.add(label(this, 28, y, this.heading(), '#ffd29a'));
    y += 20;
    if (this.screen === 'help') {
      for (const key of ['helpMove', 'helpFight', 'helpDash', 'helpParry', 'helpRooms', 'helpMeta', 'helpBody'] as const) {
        for (const line of wrapText(t(key), 420)) {
          this.root.add(label(this, 28, y, line, '#f4f0ea'));
          y += 14;
        }
        y += 4;
      }
      row(248, t('back'), 0);
      return;
    }
    if (this.screen === 'credits') {
      for (const key of ['creditsBody', 'creditsFont', 'original', 'fontCredit', 'engine'] as const) {
        for (const line of wrapText(t(key), 420)) {
          this.root.add(label(this, 28, y, line));
          y += 14;
        }
        y += 6;
      }
      row(248, t('back'), 0);
      return;
    }
    if (this.screen === 'overwrite' || this.screen === 'wipe') {
      const body = this.screen === 'wipe' ? t('wipeAsk') : t('overwriteAsk');
      for (const line of wrapText(body, 400)) {
        this.root.add(label(this, 28, y, line));
        y += 14;
      }
      row(180, this.screen === 'wipe' ? t('confirmWipe') : t('yes'), 0, '#ffb0a0');
      row(198, t('no'), 1);
      return;
    }
    if (this.screen === 'altar') {
      this.root.add(label(this, 280, 88, `${t('cores')} ${this.save.meta.cores}`, '#f0c85c'));
      this.root.add(label(this, 28, y, t('altarHint'), '#c8bdd4'));
      y += 16;
      UPGRADES.forEach((up, i) => {
        const rank = up.kind === 'rank' ? this.save.meta.ranks[up.id as keyof typeof this.save.meta.ranks] : this.save.meta.unlocks[up.id as keyof typeof this.save.meta.unlocks] ? 1 : 0;
        const done = rank >= up.max;
        const cost = done ? t('purchased') : t('cost', { n: up.cost(rank) });
        const name = `${up.name}  ${up.kind === 'rank' ? t('rank', { n: rank, max: up.max }) : ''}  ${cost}`;
        row(y, name, i, done ? '#8a7d96' : '#f4f0ea');
        y += 14;
      });
      row(y + 2, t('back'), UPGRADES.length);
      return;
    }
    if (this.screen === 'loadout') {
      const char = CHARACTERS[this.save.character];
      const weapon = WEAPONS[this.save.weapon];
      row(y, `${t('character')}  ${char.name}`, 0);
      y += 14;
      this.root.add(label(this, 52, y, char.desc, '#c8bdd4'));
      y += 16;
      row(y, `${t('weapon')}  ${weapon.name}`, 1);
      y += 14;
      this.root.add(label(this, 52, y, weapon.desc, '#c8bdd4'));
      y += 16;
      row(y, `${t('seedLabel')}  ${this.save.seed}   ${t('randomSeed')}`, 2);
      y += 18;
      row(y, t('depart'), 3);
      y += 16;
      row(y, t('tutorial'), 4);
      y += 16;
      row(y, t('back'), 5);
      this.root.add(label(this, 28, 236, t('loadoutHint'), '#8a7d96'));
      return;
    }
    if (this.screen === 'rebind') {
      this.root.add(label(this, 28, y, t('settingsKeys'), '#c8bdd4'));
      y += 16;
      const windowStart = Math.max(0, Math.min(this.index - 4, BIND_ORDER.length - 8));
      BIND_ORDER.slice(windowStart, windowStart + 9).forEach((action, offset) => {
        const i = windowStart + offset;
        const code = this.save.settings.bindings[action][0];
        const shown = this.rebinding === action ? t('rebindHint') : keyLabel(code ?? '');
        row(y, `${t(BIND_KEY[action])}  ${shown}`, i);
        y += 14;
      });
      row(248, t('back'), BIND_ORDER.length);
      return;
    }
    const touch =
      this.save.settings.touch === 'on' ? t('touchOn') : this.save.settings.touch === 'off' ? t('touchOff') : t('touchAuto');
    row(y, `${t('music')}  ${Math.round(this.save.settings.music * 10)}`, 0);
    y += 16;
    row(y, `${t('sfx')}  ${Math.round(this.save.settings.sfx * 10)}`, 1);
    y += 16;
    row(y, `${t('shake')}  ${this.save.settings.shake ? t('on') : t('off')}`, 2);
    y += 16;
    row(y, `${t('touch')}  ${touch}`, 3);
    y += 16;
    row(y, t('rebind'), 4);
    y += 16;
    row(y, t('wipe'), 5, '#ffb0a0');
    y += 16;
    row(y, t('back'), 6);
  }

  private heading(): string {
    if (this.screen === 'help') return t('controlsTitle');
    if (this.screen === 'credits') return t('credits');
    if (this.screen === 'settings' || this.screen === 'wipe' || this.screen === 'rebind') return t('settingsTitle');
    if (this.screen === 'altar') return t('altarTitle');
    if (this.screen === 'loadout') return t('loadoutTitle');
    return t('title');
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 10) / 10));
}
