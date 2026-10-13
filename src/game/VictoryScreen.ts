import Phaser from 'phaser';

const DEPTH_OVERLAY = 100;
const DEPTH_PANEL = 101;
const DEPTH_TEXT = 102;

const TEXT =
  'Поздравляем, вы покинули состав.\nНажмите любую кнопку, чтобы начать сначала.';

export class VictoryScreen {
  private container?: Phaser.GameObjects.Container;
  private keyboardHandler?: (event: KeyboardEvent) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly onRestart: () => void) {}

  public show(): void {
    if (this.container) {
      return;
    }

    const { width, height } = this.scene.scale;
    this.container = this.scene.add.container(0, 0).setDepth(DEPTH_OVERLAY);

    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    overlay.setDepth(DEPTH_OVERLAY);
    this.container.add(overlay);

    const panelWidth = Math.min(width * 0.85, 720);
    const panelHeight = Math.min(height * 0.6, 360);
    const panelX = width / 2;
    const panelY = height / 2;
    const radius = 24;

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x1a1f2e, 0.95);
    graphics.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, radius);
    graphics.setDepth(DEPTH_PANEL);
    this.container.add(graphics);

    const text = this.scene.add.text(panelX, panelY, TEXT, {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: panelWidth - 48 },
      lineSpacing: 8,
    });
    text.setOrigin(0.5);
    text.setDepth(DEPTH_TEXT);
    this.container.add(text);

    this.setupInput();
  }

  private setupInput(): void {
    if (this.scene.input.keyboard) {
      this.keyboardHandler = (_event: KeyboardEvent) => {
        this.close();
      };
      this.scene.input.keyboard.on('keydown', this.keyboardHandler);
    }

    this.scene.input.once('pointerdown', this.onPointerDown, this);
  }

  private onPointerDown(_pointer: Phaser.Input.Pointer): void {
    this.close();
  }

  public close(): void {
    if (!this.container) {
      return;
    }

    if (this.keyboardHandler && this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown', this.keyboardHandler);
      this.keyboardHandler = undefined;
    }

    this.scene.input.off('pointerdown', this.onPointerDown, this);

    this.container.destroy();
    this.container = undefined;

    this.onRestart();
  }
}
