import './style.css';
import Phaser from 'phaser';
import { audio } from './audio/audio';
import { Boot } from './game/scenes/Boot';
import { RunScene } from './game/scenes/Run';
import { Title } from './game/scenes/Title';
import { hookInput } from './input/controls';
import { VIEW_H, VIEW_W } from './core/constants';

hookInput();

function unlock(): void {
  audio.unlock();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
}

window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

async function start(): Promise<void> {
  try {
    await document.fonts.load('12px FusionPixel');
  } catch {
    /* the face still falls back to the next family */
  }
  await document.fonts.ready;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#07060a',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    fps: { target: 60 },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: VIEW_W,
      height: VIEW_H,
    },
    scene: [Boot, Title, RunScene],
  });
  if (import.meta.env.DEV) (window as unknown as { __game?: Phaser.Game }).__game = game;
}

void start();
