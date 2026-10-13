import Phaser from 'phaser';
import officerSheetTexture from '../pics/player/Officer_sheet_unboxed_0.png';
import { updatePlayerMovement, type PlayerMovementInput } from './playerMovement';
import { BackgroundMusic } from './BackgroundMusic';

const PLAYER_SPEED = 260;
const PLAYER_FRAME_SIZE = 32;
const PLAYER_SCALE = 12;
const PLAYER_DISPLAY_SIZE = 48;
const PLAYER_SHADOW_WIDTH = 150;
const PLAYER_SHADOW_HEIGHT = 24;
const PLAYER_SHADOW_COLOR = 0x101010;
const PLAYER_SHADOW_ALPHA = 0.48;
const PLAYER_IDLE_ANIMATION = 'officer-idle';
const PLAYER_WALK_ANIMATION = 'officer-walk';
// Анимация ходьбы — 4 кадра при 5 fps (800 мс на цикл), шага в цикле два.
const FOOTSTEP_INTERVAL_MS = 400;
// Экранная позиция стоит на месте в тот кадр, когда только начинается прокрутка карты,
// поэтому анимацию останавливаем с маленькой задержкой — иначе она мигает на старте прокрутки.
const ANIMATION_STOP_DELAY_MS = 100;

// Объединяет спрайт игрока, движение, анимации и тень в один игровой объект.
export class Player {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private stepTimer = FOOTSTEP_INTERVAL_MS;
  private idleDelay = ANIMATION_STOP_DELAY_MS;
  private previousWorldX?: number;

  public static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet('officer', officerSheetTexture, {
      frameWidth: PLAYER_FRAME_SIZE,
      frameHeight: PLAYER_FRAME_SIZE,
    });
    // Менеджер звука сам пропускает повторную загрузку, так что шаги будут готовы всегда.
    BackgroundMusic.getInstance().preload(scene);
  }

  constructor(private readonly scene: Phaser.Scene, x: number, y: number, shadowScale: number) {
    const texture = scene.textures.get('officer');
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    if (!scene.anims.exists(PLAYER_IDLE_ANIMATION)) {
      scene.anims.create({
        key: PLAYER_IDLE_ANIMATION,
        frames: scene.anims.generateFrameNumbers('officer', { start: 0, end: 6 }),
        frameRate: 2,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(PLAYER_WALK_ANIMATION)) {
      scene.anims.create({
        key: PLAYER_WALK_ANIMATION,
        frames: scene.anims.generateFrameNumbers('officer', { start: 10, end: 13 }),
        frameRate: 5,
        repeat: -1,
      });
    }

    this.sprite = scene.add.sprite(x, y, 'officer');
    this.sprite.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
    this.sprite.setScale(PLAYER_SCALE);
    this.sprite.setDepth(2);
    this.sprite.anims.play(PLAYER_IDLE_ANIMATION);

    this.shadow = scene.add.ellipse(
      x,
      y + this.sprite.displayHeight / 2 - 8,
      PLAYER_SHADOW_WIDTH,
      PLAYER_SHADOW_HEIGHT,
      PLAYER_SHADOW_COLOR,
      PLAYER_SHADOW_ALPHA,
    );
    this.shadow.setScale(shadowScale);
    this.shadow.setDepth(1);
  }

  public get x(): number {
    return this.sprite.x;
  }

  public get y(): number {
    return this.sprite.y;
  }

  public get displayWidth(): number {
    return this.sprite.displayWidth;
  }

  public get displayHeight(): number {
    return this.sprite.displayHeight;
  }

  public get speed(): number {
    return PLAYER_SPEED;
  }

  public update(
    input: PlayerMovementInput,
    delta: number,
    leftBoundary: number,
    rightBoundary: number,
    viewportHeight: number,
    mapScrollX: number,
  ): void {
    const isWalking = input.left || input.right;

    if (input.left && this.sprite.x > leftBoundary) {
      updatePlayerMovement(this.sprite as unknown as Phaser.GameObjects.Rectangle, { left: true, right: false }, delta, PLAYER_SPEED);
    } else if (input.right && this.sprite.x < rightBoundary) {
      updatePlayerMovement(this.sprite as unknown as Phaser.GameObjects.Rectangle, { left: false, right: true }, delta, PLAYER_SPEED);
    }

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, leftBoundary, rightBoundary);
    this.sprite.y = Phaser.Math.Clamp(
      this.sprite.y,
      viewportHeight / 2 - 90 + this.sprite.displayHeight / 2,
      viewportHeight / 2 + 90 + this.sprite.displayHeight / 2,
    );
    this.shadow.setPosition(this.sprite.x, this.sprite.y + this.sprite.displayHeight / 2 - 8);

    // Экранная координата игрока стоит на месте, когда карта едет под ним,
    // поэтому движение считаем по позиции в мире: координата на экране + прокрутка карты.
    const worldX = this.sprite.x + mapScrollX;
    let isMoving: boolean;
    if (this.previousWorldX === undefined) {
      this.previousWorldX = worldX;
      isMoving = isWalking;
    } else {
      isMoving = worldX !== this.previousWorldX;
      this.previousWorldX = worldX;
    }

    if (isWalking) {
      this.sprite.flipX = input.left;
    }

    this.updateAnimation(isMoving, isWalking, delta);
    this.updateFootsteps(isMoving, delta);
  }

  // Анимация следует за реальным смещением: уперевшись в стену, игрок встаёт в idle,
  // хотя клавиша движения остаётся нажатой.
  private updateAnimation(isMoving: boolean, isWalking: boolean, delta: number): void {
    if (isMoving) {
      this.idleDelay = 0;
      this.sprite.anims.play(PLAYER_WALK_ANIMATION, true);
      return;
    }

    // Без нажатой клавиши стоим сразу; задержка нужна только для упора в стену,
    // где экранная позиция стоит на месте в кадр старта прокрутки карты.
    if (!isWalking) {
      this.idleDelay = 0;
      this.sprite.anims.play(PLAYER_IDLE_ANIMATION, true);
      return;
    }

    this.idleDelay += delta;
    if (this.idleDelay >= ANIMATION_STOP_DELAY_MS) {
      this.sprite.anims.play(PLAYER_IDLE_ANIMATION, true);
    }
  }

  private updateFootsteps(isMoving: boolean, delta: number): void {
    // При остановке таймер ставим в интервал, чтобы первый шаг после старта прозвучал сразу.
    if (!isMoving) {
      this.stepTimer = FOOTSTEP_INTERVAL_MS;
      return;
    }

    this.stepTimer += delta;
    if (this.stepTimer < FOOTSTEP_INTERVAL_MS) {
      return;
    }

    this.stepTimer = 0;
    BackgroundMusic.getInstance().playStep(this.scene);
  }

  public hide(): void {
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
  }
}