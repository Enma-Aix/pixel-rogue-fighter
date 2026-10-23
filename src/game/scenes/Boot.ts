import Phaser from 'phaser';
import { t } from '../../data/strings';
import { installArt, refreshCanvases } from '../../render/sprites';
import { label } from '../../render/text';

export class Boot extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#07060a');
    label(this, 168, 126, t('loading'), '#f4f0ea');
    installArt(this);
    this.time.delayedCall(50, () => {
      refreshCanvases(this);
      this.scene.start('title');
    });
  }
}
