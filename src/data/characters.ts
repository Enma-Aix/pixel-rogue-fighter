import type { CharacterId } from '../core/types';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  desc: string;
  hp: number;
  speed: number;
  dmg: number;
  dr: number;
  regen: number;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  wanderer: {
    id: 'wanderer',
    name: '烬行者',
    desc: '均衡。剑比话多。',
    hp: 100,
    speed: 1,
    dmg: 1,
    dr: 0,
    regen: 0,
  },
  dancer: {
    id: 'dancer',
    name: '影舞者',
    desc: '更快，更脆。匕首会喜欢你。',
    hp: 82,
    speed: 1.14,
    dmg: 0.94,
    dr: 0,
    regen: 0.03,
  },
  bulwark: {
    id: 'bulwark',
    name: '磐卫',
    desc: '更高的生命，受击更轻。锤子的朋友。',
    hp: 128,
    speed: 0.9,
    dmg: 1.06,
    dr: 0.1,
    regen: 0,
  },
};
