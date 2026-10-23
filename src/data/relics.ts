import type { Rarity } from '../core/types';

export interface RelicDef {
  id: string;
  name: string;
  rarity: Rarity;
  desc: string;
  icon: string;
}

export const RELICS: RelicDef[] = [
  { id: 'emberHeart', name: '余烬之心', rarity: 'common', icon: 'heart', desc: '每清空一个房间，回复 8 点生命。' },
  { id: 'swift', name: '轻羽', rarity: 'common', icon: 'feather', desc: '移动速度 +12%。' },
  { id: 'greed', name: '拾荒魂', rarity: 'common', icon: 'coin', desc: '获得余烬 +25%，最大生命 -10%。' },
  { id: 'flow', name: '气脉', rarity: 'common', icon: 'drop', desc: '攻击命中获得的能量 +50%。' },
  { id: 'thorns', name: '荆棘甲', rarity: 'common', icon: 'shield', desc: '受击时对攻击者反弹 5 点伤害。' },
  { id: 'sip', name: '余烬汲取', rarity: 'rare', icon: 'fang', desc: '击杀敌人回复 3 点生命。' },
  { id: 'brand', name: '连斩烙印', rarity: 'rare', icon: 'brand', desc: '连段终结技伤害 +40%。' },
  { id: 'parryEmber', name: '弹反余烬', rarity: 'rare', icon: 'spark', desc: '弹反成功回复 4 点生命与 15 点能量。' },
  { id: 'star', name: '坠星', rarity: 'rare', icon: 'star', desc: '下劈落地时掀起冲击波。' },
  { id: 'shock', name: '震荡锤心', rarity: 'rare', icon: 'hammer', desc: '重击硬直更久，破韧更高。' },
  { id: 'route', name: '商路', rarity: 'rare', icon: 'tag', desc: '商店售价降低 20%。' },
  { id: 'sense', name: '秘径嗅觉', rarity: 'rare', icon: 'eye', desc: '地图会标出相邻的隐藏房间。' },
  { id: 'flame', name: '焰步', rarity: 'rare', icon: 'flame', desc: '冲刺留下灼热余焰。' },
  { id: 'glass', name: '玻璃刃', rarity: 'epic', icon: 'glass', desc: '造成伤害 +30%，受到伤害 +20%。' },
  { id: 'ghost', name: '残影步', rarity: 'epic', icon: 'ghost', desc: '冲刺段数 +1。' },
  { id: 'openSky', name: '破空', rarity: 'epic', icon: 'wing', desc: '浮空追击的伤害衰减大幅降低。' },
  { id: 'undying', name: '烬火不灭', rarity: 'epic', icon: 'phoenix', desc: '每局一次，致命伤时保留 1 点生命并短暂无敌。' },
  { id: 'warrant', name: '斩首令', rarity: 'epic', icon: 'crown', desc: '对精英与首领伤害 +20%。' },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

export function relicById(id: string): RelicDef | undefined {
  return RELIC_BY_ID[id];
}

export function relicsOf(rarity: Rarity): RelicDef[] {
  return RELICS.filter((r) => r.rarity === rarity);
}

export interface Synergy {
  id: string;
  name: string;
  needs: [string, string];
  desc: string;
}

export const SYNERGIES: Synergy[] = [
  { id: 'dance', name: '烬舞', needs: ['brand', 'openSky'], desc: '终结技额外劈出一道残影。' },
  { id: 'backfire', name: '反焰', needs: ['parryEmber', 'flame'], desc: '弹反后的下一次冲刺会斩中敌人。' },
  { id: 'meteor', name: '陨铁', needs: ['star', 'shock'], desc: '下劈冲击波更大，硬直更长。' },
];

export function activeSynergies(owned: readonly string[]): Synergy[] {
  return SYNERGIES.filter((s) => owned.includes(s.needs[0]) && owned.includes(s.needs[1]));
}
