import type { EnemyKind } from "./types";

export type BossKind = "wisp" | "shade" | "boss";

export function isBossKind(kind: EnemyKind): kind is BossKind {
  return kind === "wisp" || kind === "shade" || kind === "boss";
}

export function bossForAct(act: 1 | 2 | 3): BossKind {
  if (act === 1) return "wisp";
  if (act === 2) return "shade";
  return "boss";
}

export interface BossCard {
  kind: BossKind;
  name: string;
  intro: string;
  introSub: string;
  calm: string;
  rageName: string;
  phase: string;
  phaseSub: string;
  bar: number;
  rageBar: number;
}

export const BOSS_CARD: Record<BossKind, BossCard> = {
  wisp: {
    kind: "wisp",
    name: "灯魂",
    intro: "夜郊",
    introSub: "灯未熄",
    calm: "残灯",
    rageName: "鬼火",
    phase: "灯灭",
    phaseSub: "鬼火四散",
    bar: 0xe6a04a,
    rageBar: 0xff6a32,
  },
  shade: {
    kind: "shade",
    name: "竹客",
    intro: "竹影",
    introSub: "叶后有人",
    calm: "竹影",
    rageName: "无踪",
    phase: "无影",
    phaseSub: "竹叶蔽目",
    bar: 0x3fa86a,
    rageBar: 0x7dffb0,
  },
  boss: {
    kind: "boss",
    name: "残将",
    intro: "残城",
    introSub: "玄甲",
    calm: "玄甲",
    rageName: "狂怒",
    phase: "狂怒",
    phaseSub: "玄甲裂开",
    bar: 0xa24ad0,
    rageBar: 0xff5a3a,
  },
};
