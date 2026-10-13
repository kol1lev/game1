import Phaser from 'phaser';

const DEPTH_OVERLAY = 100;
const DEPTH_PANEL = 101;
const DEPTH_TEXT = 102;

// Отвечает за экран поражения и ввод; действие перезапуска передаёт сцена.
export class DefeatScreen {
  private readonly restartKey: Phaser.Input.Keyboard.Key;
  private container?: Phaser.GameObjects.Container;
  private visible = false;

  constructor(private readonly scene: Phaser.Scene, private readonly onRestart: () => void) {
    if (!scene.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.restartKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  public get isVisible(): boolean {
    return this.visible;
  }

  public show(): void {
    if (this.visible || this.container) {
      return;
    }

    this.visible = true;
    const { width, height } = this.scene.scale;
    const panelWidth = Math.min(width * 0.75, 480);
    const titleY = height / 2 - 65;
    const restartY = height / 2 + 65;
    const radius = 24;

    this.container = this.scene.add.container(0, 0).setDepth(DEPTH_OVERLAY);

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    overlay.setDepth(DEPTH_OVERLAY);
    this.container.add(overlay);

    const titlePanel = this.scene.add.graphics();
    titlePanel.fillStyle(0x1a1f2e, 0.95);
    titlePanel.fillRoundedRect(width / 2 - panelWidth / 2, titleY - 45, panelWidth, 90, radius);
    titlePanel.setDepth(DEPTH_PANEL);
    this.container.add(titlePanel);

    const titleText = this.scene.add.text(width / 2, titleY, 'ПОРАЖЕНИЕ', {
      fontFamily: 'sans-serif',
      fontSize: '32px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);
    titleText.setDepth(DEPTH_TEXT);
    this.container.add(titleText);

    const restartPanel = this.scene.add.graphics();
    restartPanel.fillStyle(0x30343b, 0.95);
    restartPanel.fillRoundedRect(width / 2 - panelWidth / 2, restartY - 38, panelWidth, 76, radius);
    restartPanel.setDepth(DEPTH_PANEL);
    this.container.add(restartPanel);

    const restartButton = this.scene.add.rectangle(width / 2, restartY, panelWidth, 76, 0x000000, 0.001);
    restartButton.setDepth(DEPTH_TEXT);
    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on('pointerdown', this.onRestart);
    this.container.add(restartButton);

    const restartText = this.scene.add.text(width / 2, restartY, 'НАЧАТЬ ЗАНОВО (R)', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);
    restartText.setDepth(DEPTH_TEXT);
    this.container.add(restartText);
  }

  public hide(): void {
    if (!this.visible) {
      return;
    }

    this.visible = false;
    this.container?.destroy();
    this.container = undefined;
  }

  public update(): void {
    if (this.visible && Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.onRestart();
    }
  }
}