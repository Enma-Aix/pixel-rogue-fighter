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
      bg: '#1c1424',
      bg2: '#3a2848',
      wall: '#7a5c8c',
      wall2: '#543c64',
      wallHi: '#f0e2f6',
      floor: '#8d7268',
      floor2: '#5a4440',
      platform: '#d2bfb4',
      accent: '#ff7a3a',
      hazard: '#eef2f8',
      deep: '#0c0810',
      decor: '#e0c6a4',
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
      bg: '#24100c',
      bg2: '#4a2218',
      wall: '#8a4a38',
      wall2: '#5c2e22',
      wallHi: '#ffc49a',
      floor: '#a05a3c',
      floor2: '#5a3020',
      platform: '#e09a72',
      accent: '#ffc04a',
      hazard: '#ff5a1a',
      deep: '#140806',
      decor: '#ffb07a',
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
      bg: '#12182c',
      bg2: '#243056',
      wall: '#5a6aa0',
      wall2: '#3a4878',
      wallHi: '#e4ecff',
      floor: '#6a7898',
      floor2: '#3a4464',
      platform: '#b7c6ee',
      accent: '#7ae0ff',
      hazard: '#b48cff',
      deep: '#080a14',
      decor: '#e8f0ff',
    },
  },
};

export const BIOME_ORDER: BiomeId[] = ['ash', 'molten', 'sanctum'];

export function biomeAt(index: number): BiomeDef {
  return BIOMES[BIOME_ORDER[index] ?? 'ash']!;
}
