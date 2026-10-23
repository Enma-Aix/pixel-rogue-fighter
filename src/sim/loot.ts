import { hashStr } from '../core/math';
import { mulberry32, pick } from '../core/rng';
import type { Rarity } from '../core/types';
import { relicById, RELICS, activeSynergies, type RelicDef } from '../data/relics';
import { t } from '../data/strings';
import type { RewardChoice, Run, ShopItem } from './model';

export function hasRelic(run: Run, id: string): boolean {
  return run.relics.includes(id);
}

export function recompute(run: Run): void {
  let max = run.baseMaxHp;
  if (hasRelic(run, 'greed')) max = Math.round(max * 0.9);
  run.player.maxHp = Math.max(1, max);
  run.player.hp = Math.min(run.player.hp, run.player.maxHp);
  const dashes = run.baseDash + (hasRelic(run, 'ghost') ? 1 : 0);
  if (dashes > run.dashMax) run.player.dashCharges += dashes - run.dashMax;
  run.dashMax = dashes;
  run.player.dashCharges = Math.max(0, Math.min(run.dashMax, run.player.dashCharges));
}

export function grantRelic(run: Run, id: string): boolean {
  if (run.relics.includes(id)) return false;
  const def = relicById(id);
  if (!def) return false;
  run.relics.push(id);
  recompute(run);
  run.events.push({
    t: 'float',
    text: t('gotRelic', { name: def.name }),
    x: run.player.x,
    y: run.player.y - 46,
    color: '#f0c85c',
  });
  for (const syn of activeSynergies(run.relics)) {
    if (syn.needs.includes(id)) {
      run.events.push({
        t: 'float',
        text: t('synergyGet', { name: syn.name }),
        x: run.player.x,
        y: run.player.y - 64,
        color: '#7ae0ff',
      });
    }
  }
  run.events.push({ t: 'sfx', id: 'pickup' });
  return true;
}

function poolFor(bias: Rarity | 'any', rng: () => number): Rarity {
  if (bias !== 'any') return bias;
  const n = rng();
  if (n < 0.12) return 'epic';
  if (n < 0.42) return 'rare';
  return 'common';
}

export function rollRelic(run: Run, bias: Rarity | 'any', salt: string): RelicDef | null {
  const rng = mulberry32(hashStr(`${run.seed}:${salt}`) >>> 0);
  const rarity = poolFor(bias, rng);
  const order: Rarity[] = rarity === 'epic' ? ['epic', 'rare', 'common'] : rarity === 'rare' ? ['rare', 'common', 'epic'] : ['common', 'rare', 'epic'];
  for (const r of order) {
    const choices = RELICS.filter((rel) => rel.rarity === r && !run.relics.includes(rel.id));
    if (choices.length) return pick(rng, choices);
  }
  return null;
}

export function rollChoices(run: Run, count: number, salt: string, bias: Rarity | 'any'): RewardChoice[] {
  const out: RewardChoice[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count + 4 && out.length < count; i++) {
    const rel = rollRelic(run, bias, `${salt}:${i}:${[...used].join(',')}`);
    if (!rel || used.has(rel.id) || run.relics.includes(rel.id)) continue;
    used.add(rel.id);
    out.push({ id: rel.id, name: rel.name, desc: rel.desc, rarity: rel.rarity });
  }
  return out;
}

export function shopStock(run: Run, roomId: string): ShopItem[] {
  const floor = run.floorIndex;
  const discount = hasRelic(run, 'route') ? 0.8 : 1;
  const price = (base: number) => Math.max(8, Math.round(base * discount));
  const a = rollRelic(run, 'any', `shop:${roomId}:a`);
  const b = rollRelic(run, floor === 0 ? 'common' : 'rare', `shop:${roomId}:b`);
  const items: ShopItem[] = [];
  if (a) items.push({ kind: 'relic', relicId: a.id, price: price((a.rarity === 'epic' ? 58 : a.rarity === 'rare' ? 40 : 26) + floor * 6), name: a.name, desc: a.desc });
  if (b && b.id !== a?.id) items.push({ kind: 'relic', relicId: b.id, price: price((b.rarity === 'epic' ? 58 : b.rarity === 'rare' ? 40 : 26) + floor * 8), name: b.name, desc: b.desc });
  items.push({ kind: 'heal', price: price(16 + floor * 5), name: t('healName'), desc: t('healDesc') });
  items.push({ kind: 'flask', price: price(22 + floor * 6), name: t('flaskName'), desc: t('flaskDesc') });
  return items;
}

export function goldAmount(base: number, run: Run, salt: string): number {
  const jitter = hashStr(salt) % 3;
  const greed = hasRelic(run, 'greed') ? 1.25 : 1;
  return Math.max(1, Math.round((base + jitter) * greed));
}
