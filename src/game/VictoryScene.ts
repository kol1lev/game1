import Phaser from 'phaser';
import { VictoryScreen } from './VictoryScreen';
import { BackgroundMusic } from './BackgroundMusic';

export class VictoryScene extends Phaser.Scene {
  private readonly audio = BackgroundMusic.getInstance();

  constructor() {
    super('VictoryScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0b1020');
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b1020).setDepth(-10);

    new VictoryScreen(this, () => {
      this.audio.handleVictory();
      this.scene.start('GameScene', {
        carNumberIndex: 1,
        resetScroll: true,
        startFromRight: false,
        fadeIn: true,
        showWelcome: true,
      });
    }).show();
  }
}
