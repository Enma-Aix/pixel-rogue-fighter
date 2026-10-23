export interface EventChoice {
  id: string;
  label: string;
  detail: string;
  effect: string;
}

export interface EventDef {
  id: string;
  title: string;
  body: string;
  choices: EventChoice[];
}

export const EVENTS: EventDef[] = [
  {
    id: 'altar',
    title: '灰烬祭坛',
    body: '祭坛还热。它想要一点血，或者你直接走开。',
    choices: [
      { id: 'bleed', label: '献出生命', detail: '失去 22 点生命，获得一件遗物。', effect: 'bleedRelic' },
      { id: 'leave', label: '离开', detail: '什么都不做。', effect: 'leave' },
    ],
  },
  {
    id: 'fountain',
    title: '余烬泉',
    body: '泉眼里浮着细碎的火星。喝一口要付钱，这很荒唐，也很有效。',
    choices: [
      { id: 'drink', label: '投币饮水', detail: '花费 16 余烬，回复 36 点生命。', effect: 'payHeal' },
      { id: 'leave', label: '离开', detail: '省下余烬。', effect: 'leave' },
    ],
  },
  {
    id: 'rack',
    title: '破损武器架',
    body: '架子上的兵器还认得手。磨一磨，或者换一把。',
    choices: [
      { id: 'hone', label: '磨砺', detail: '本局攻击 +6%。', effect: 'hone' },
      { id: 'swap', label: '换一把', detail: '若已解锁其他武器则替换，否则获得 22 余烬。', effect: 'swapWeapon' },
    ],
  },
  {
    id: 'whisper',
    title: '低语宝箱',
    body: '箱子自己在说话。打开它的人，下一间屋子会更难。',
    choices: [
      { id: 'open', label: '打开', detail: '获得稀有遗物。下一场战斗敌人更强。', effect: 'curseRelic' },
      { id: 'coin', label: '只取余烬', detail: '获得 28 余烬。', effect: 'gold28' },
    ],
  },
  {
    id: 'echo',
    title: '回响',
    body: '墙上的影子问你：拿一件旧的来，换一件更亮的。',
    choices: [
      { id: 'trade', label: '交换', detail: '献祭一件遗物，获得更高稀有度的遗物。', effect: 'tradeUp' },
      { id: 'leave', label: '拒绝', detail: '影子消下去。', effect: 'leave' },
    ],
  },
  {
    id: 'drill',
    title: '旧训场',
    body: '地上还有没擦掉的脚印。站上去，呼吸会对齐。',
    choices: [
      { id: 'breathe', label: '站定', detail: '能量回满，本局能量回复小幅加快。', effect: 'breath' },
      { id: 'leave', label: '离开', detail: '脚印不是你的。', effect: 'leave' },
    ],
  },
];

export function eventById(id: string): EventDef {
  return EVENTS.find((e) => e.id === id) ?? EVENTS[0]!;
}
