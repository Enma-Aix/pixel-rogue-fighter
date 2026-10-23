import type { CharacterId, WeaponId } from '../core/types';

export interface RunSnapshot {
  version: 1;
  seed: number;
  character: CharacterId;
  weapon: WeaponId;
  arsenal: WeaponId[];
  floorIndex: number;
  roomId: string;
  hp: number;
  gold: number;
  flasks: number;
  energy: number;
  relics: string[];
  attackBonus: number;
  lastStandUsed: boolean;
  curseNext: boolean;
  regenBonus: number;
  rewardTaken: string[];
  opened: string[];
  shopSold: string[];
  seen: string[];
  explored: string[];
  cleared: string[];
  secretOpen: string[];
  kills: number;
  rooms: number;
  maxCombo: number;
  bosses: number;
  frames: number;
}
