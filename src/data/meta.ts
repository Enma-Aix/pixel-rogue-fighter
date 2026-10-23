export interface MetaRanks {
  hp: number;
  flask: number;
  dash: number;
  purse: number;
  regen: number;
}

export interface Unlocks {
  hammer: boolean;
  dagger: boolean;
  dancer: boolean;
  bulwark: boolean;
}

export interface MetaState {
  cores: number;
  ranks: MetaRanks;
  unlocks: Unlocks;
  stats: { runs: number; wins: number; bestFloor: number; kills: number };
  tutorialSeen: boolean;
}

export interface UpgradeDef {
  id: keyof MetaRanks | 'hammer' | 'dagger' | 'dancer' | 'bulwark';
  name: string;
  desc: string;
  max: number;
  cost: (rank: number) => number;
  kind: 'rank' | 'unlock';
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'hp', name: '生命余烬', desc: '最大生命 +12', max: 5, cost: (r) => 28 + r * 18, kind: 'rank' },
  { id: 'flask', name: '备用药瓶', desc: '药瓶上限 +1', max: 2, cost: (r) => 76 + r * 36, kind: 'rank' },
  { id: 'dash', name: '残页', desc: '冲刺段数 +1', max: 1, cost: () => 110, kind: 'rank' },
  { id: 'purse', name: '旧钱袋', desc: '开局余烬 +15', max: 3, cost: (r) => 22 + r * 14, kind: 'rank' },
  { id: 'regen', name: '余温', desc: '能量回复加快', max: 3, cost: (r) => 26 + r * 16, kind: 'rank' },
  { id: 'hammer', name: '灰锤', desc: '解锁武器「灰锤」', max: 1, cost: () => 55, kind: 'unlock' },
  { id: 'dagger', name: '双匕', desc: '解锁武器「双匕」', max: 1, cost: () => 55, kind: 'unlock' },
  { id: 'dancer', name: '影舞者', desc: '解锁角色「影舞者」', max: 1, cost: () => 90, kind: 'unlock' },
  { id: 'bulwark', name: '磐卫', desc: '解锁角色「磐卫」', max: 1, cost: () => 90, kind: 'unlock' },
];

export function defaultMeta(): MetaState {
  return {
    cores: 0,
    ranks: { hp: 0, flask: 0, dash: 0, purse: 0, regen: 0 },
    unlocks: { hammer: false, dagger: false, dancer: false, bulwark: false },
    stats: { runs: 0, wins: 0, bestFloor: 0, kills: 0 },
    tutorialSeen: false,
  };
}
