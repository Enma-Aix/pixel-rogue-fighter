import type { BindAction } from '../input/controls';
import { touchSet } from '../input/controls';
import { t } from '../data/strings';
import type { Settings } from '../save/save';

const BUTTONS: Array<{ id: BindAction; label: string; place: string }> = [
  { id: 'left', label: '←', place: 'left' },
  { id: 'right', label: '→', place: 'left' },
  { id: 'up', label: '↑', place: 'left' },
  { id: 'down', label: '↓', place: 'left' },
  { id: 'jump', label: t('touchJump'), place: 'left' },
  { id: 'attack', label: t('touchAttack'), place: 'right' },
  { id: 'heavy', label: t('touchHeavy'), place: 'right' },
  { id: 'dash', label: t('touchDash'), place: 'right' },
  { id: 'parry', label: t('touchParry'), place: 'right' },
  { id: 'skill', label: t('touchSkill'), place: 'right' },
  { id: 'heal', label: t('touchHeal'), place: 'right' },
  { id: 'interact', label: t('touchInteract'), place: 'top' },
  { id: 'map', label: t('touchMap'), place: 'top' },
  { id: 'pause', label: t('touchPause'), place: 'top' },
];

let built = false;

function coarse(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function touchWanted(settings: Settings): boolean {
  if (settings.touch === 'on') return true;
  if (settings.touch === 'off') return false;
  return coarse();
}

export function mountTouch(): void {
  if (built) return;
  const root = document.getElementById('touch');
  if (!root) return;
  built = true;
  for (const place of ['left', 'right', 'top'] as const) {
    const row = document.createElement('div');
    row.className = `touch-${place}`;
    for (const btn of BUTTONS.filter((b) => b.place === place)) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = btn.label;
      el.dataset.action = btn.id;
      const down = (e: Event) => {
        e.preventDefault();
        touchSet(btn.id, true);
      };
      const up = (e: Event) => {
        e.preventDefault();
        touchSet(btn.id, false);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
      row.appendChild(el);
    }
    root.appendChild(row);
  }
}

export function syncTouch(settings: Settings, inRun: boolean): void {
  mountTouch();
  const root = document.getElementById('touch');
  const rotate = document.getElementById('rotate');
  const show = inRun && touchWanted(settings);
  if (root) root.hidden = !show;
  const portrait = window.matchMedia('(orientation: portrait)').matches && coarse();
  if (rotate) rotate.hidden = !portrait;
}
