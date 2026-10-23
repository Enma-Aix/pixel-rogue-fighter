import type { BiomeId } from '../core/types';

export interface BiomeColors {
  bg: string;
  bg2: string;
  wall: string;
  wall2: string;
  wallHi: string;
  floor: string;
  floor2: string;
  platform: string;
  accent: string;
  hazard: string;
  deep: string;
  decor: string;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  intro: string;
  enemies: string[];
  elite: string;
  boss: string;
  colors: BiomeColors;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  ash: {
    id: 'ash',
    name: '灰烬废墟',
    intro: '城墙还烫着。灰里有人在走路。',
    enemies: ['guard', 'archer', 'crawler'],
    elite: 'knight',
    boss: 'boss1',
    colors: {
      bg: '#140e18',
      bg2: '#241628',
      wall: '#3a2a44',
      wall2: '#2a1c32',
      wallHi: '#6a5478',
      floor: '#4a3a3a',
      floor2: '#2e242c',
      platform: '#6a5a62',
      accent: '#ff6a2a',
      hazard: '#c4c8d0',
      deep: '#100a12',
      decor: '#8a7a6a',
    },
  },
  molten: {
    id: 'molten',
    name: '熔核矿脉',
    intro: '矿脉在呼吸。脚下的光不是灯。',
    enemies: ['slag', 'flea', 'bat'],
    elite: 'eliteBrute',
    boss: 'boss2',
    colors: {
      bg: '#1a0c0a',
      bg2: '#2a120e',
      wall: '#4a2a24',
      wall2: '#2a1612',
      wallHi: '#8a4a32',
      floor: '#3a241c',
      floor2: '#241410',
      platform: '#6a4030',
      accent: '#ffb03a',
      hazard: '#ff5a1a',
      deep: '#120806',
      decor: '#c47848',
    },
  },
  sanctum: {
    id: 'sanctum',
    name: '星烬圣殿',
    intro: '圣殿没有钟。只有还没熄的星。',
    enemies: ['phantom', 'mage', 'sentinel'],
    elite: 'sentinelElite',
    boss: 'boss3',
    colors: {
      bg: '#0c1020',
      bg2: '#16182e',
      wall: '#2a3050',
      wall2: '#1a2038',
      wallHi: '#6a78a8',
      floor: '#32384a',
      floor2: '#1e2436',
      platform: '#5a6888',
      accent: '#7ae0ff',
      hazard: '#9a6aff',
      deep: '#080a14',
      decor: '#c8d4ee',
    },
  },
};

export const BIOME_ORDER: BiomeId[] = ['ash', 'molten', 'sanctum'];

export function biomeAt(index: number): BiomeDef {
  return BIOMES[BIOME_ORDER[index] ?? 'ash']!;
}
