import Phaser from 'phaser';
import doorHintTexture from '../pics/other/doorHint.png';
import { CAMERA_MARGIN, updateMapScroll } from './mapScrolling';
import { MapObject } from './MapObject';
import { Npc } from './Npc';
import { Player } from './Player';
import { WagonFactory } from './WagonFactory';
import { Wagon, type WagonType } from './Wagon';
import { DefeatScreen } from './DefeatScreen';
import { WelcomeScreen } from './WelcomeScreen';
import { VictoryScreen } from './VictoryScreen';
import { BackgroundMusic } from './BackgroundMusic';
import { Anomaly } from './Anomaly';

const CAR_NUMBER_ASSETS = import.meta.glob('../pics/nums/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const MAP_EDGE_PLAYER_MARGIN = 80;
const NPC_SPEED = 100;
const NPC_TRAVEL_RATIO = 0.8;
const LOSE_SCREEN_DELAY_MS = 1000;
const PLAYER_START_X = 250;
const CAR_NUMBER_WORLD_X = PLAYER_START_X - 195;
const MAX_CAR_NUMBER = 10;


// Координирует ввод игрока, смену вагонов, прокрутку и последствия аномалий.
export class GameScene extends Phaser.Scene {
  private mapImage!: Phaser.GameObjects.Image;
  private carNumber!: MapObject;
  private rightCarNumber!: MapObject;
  private doorHint!: Phaser.GameObjects.Image;
  private player!: Player;
  private npc!: Npc;
  private water!: MapObject;
  private wagon!: Wagon;
  private anomalyOverlay?: MapObject;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
  private doorKey!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private defeatScreen!: DefeatScreen;
  private welcomeScreen?: WelcomeScreen;
  private victoryScreen?: VictoryScreen;
  private showWelcome = false;
  private readonly audio = BackgroundMusic.getInstance();
  private mapWidth = 0;
  private mapViewWidth = 0;
  private mapScrollX = 0;
  private currentCarNumber = 1;
  private startFromRight = false;
  private requestedWagonType?: WagonType;
  private fadeInOnStart = false;
  private transitionStarted = false;
  private loseAnimationActive = false;

  constructor() {
    super('GameScene');
  }

  private getCarNumberKey(carNumberIndex: number): string {
    const normalizedIndex = ((carNumberIndex - 1) % MAX_CAR_NUMBER) + 1;
    return `d${normalizedIndex}`;
  }

  // В аномалии правильный выход — возврат через входную дверь, в обычном вагоне — через противоположную.
  private exitsCorrectly(moveLeft: boolean): boolean {
    const exitsThroughEntryDoor = moveLeft !== this.startFromRight;
    return this.wagon.type === 'anomaly' ? exitsThroughEntryDoor : !exitsThroughEntryDoor;
  }

  private getNextCarNumberIndex(currentCarNumber: number, moveLeft: boolean): number {
    if (!this.exitsCorrectly(moveLeft)) {
      return 1;
    }

    if (currentCarNumber >= MAX_CAR_NUMBER) {
      return MAX_CAR_NUMBER + 1;
    }

    return currentCarNumber + 1;
  }

  private isVictory(carNumberIndex: number): boolean {
    return carNumberIndex > MAX_CAR_NUMBER;
  }

  private startTransition(moveLeft: boolean): void {
    const nextCarNumberIndex = this.getNextCarNumberIndex(this.currentCarNumber, moveLeft);
    this.wagon.markExitResult(this.exitsCorrectly(moveLeft));

    if (this.isVictory(nextCarNumberIndex)) {
      this.transitionStarted = true;
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('VictoryScene', {
          foundCount: Anomaly.foundCount,
          totalCount: Anomaly.totalVariantCount,
        });
      });
      this.cameras.main.fadeOut(350, 0, 0, 0);
      return;
    }

    const startFromRight = moveLeft;
    this.transitionStarted = true;
    // Перезапускаем сцену после затемнения, чтобы новый вагон начинался с правильной прокруткой карты.
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('GameScene', {
        carNumberIndex: nextCarNumberIndex,
        transitionDirection: moveLeft,
        resetScroll: true,
        startFromRight,
        fadeIn: true,
        showWelcome: false,
      });
    });
    this.cameras.main.fadeOut(350, 0, 0, 0);
  }

  private openWelcomeScreen(): void {
    if (this.welcomeScreen) {
      return;
    }
    this.welcomeScreen = new WelcomeScreen(this, () => {
      this.showWelcome = false;
      this.welcomeScreen = undefined;
      this.audio.start(this);
    });
    this.welcomeScreen.show();
  }

  preload(): void {
    console.log('Preload начался');
    this.load.on('complete', () => {
        console.log('Загрузка всех ресурсов завершена!');
    });
    WagonFactory.preload(this);
    Player.preload(this);
    this.load.image('door-hint', doorHintTexture);
    Object.entries(CAR_NUMBER_ASSETS).forEach(([filePath, fileUrl]) => {
      const assetName = filePath.split('/').pop()?.replace('.png', '');
      if (assetName) {
        this.load.image(assetName, fileUrl);
      }
    });
    Npc.preload(this);
    this.audio.preload(this);

    const sceneData = this.scene.settings.data as {
      carNumberIndex?: number;
      resetScroll?: boolean;
      startFromRight?: boolean;
      mapVariant?: WagonType;
      fadeIn?: boolean;
      showWelcome?: boolean;
    } | undefined;

    this.currentCarNumber = sceneData?.carNumberIndex ?? 1;
    this.startFromRight = sceneData?.startFromRight ?? false;
    this.requestedWagonType = sceneData?.mapVariant;
    this.fadeInOnStart = sceneData?.fadeIn ?? false;
    this.showWelcome = sceneData?.showWelcome ?? true;
  }

  create(): void {
    this.transitionStarted = false;
    this.loseAnimationActive = false;

    const { width, height } = this.scale;
    // Выбираем вагон один раз: размеры его текстуры задают границы прокрутки карты.
    this.wagon = WagonFactory.create(this, this.requestedWagonType);
    this.requestedWagonType = undefined;
    const mapTextureKey = this.wagon.getMapTextureKey();

    this.cameras.main.setBackgroundColor('#0b1020');
    this.cameras.main.setRoundPixels(true);
    this.game.canvas.style.imageRendering = 'pixelated';
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b1020).setDepth(-10);

    const mapFrame = this.textures.get(mapTextureKey).get();
    this.mapWidth = mapFrame.width;
    this.mapViewWidth = Math.min(width, mapFrame.width);
    const visibleHeight = Math.min(height, mapFrame.height);

    this.mapScrollX = this.startFromRight ? Math.max(0, this.mapWidth - this.mapViewWidth) : 0;

    const currentCarKey = this.getCarNumberKey(this.currentCarNumber);
    const rightEdgeWorldX = this.mapWidth - 60;

    this.carNumber = new MapObject(this, CAR_NUMBER_WORLD_X, height / 2 + 30, currentCarKey, 100, 100);
    this.add.existing(this.carNumber);
    this.carNumber.syncToMapScroll(this.mapScrollX);

    this.rightCarNumber = new MapObject(this, rightEdgeWorldX, height / 2 + 30, currentCarKey, 100, 100);
    this.add.existing(this.rightCarNumber);
    this.rightCarNumber.syncToMapScroll(this.mapScrollX);

    this.doorHint = this.add.image(PLAYER_START_X, height / 2 - 30, 'door-hint');
    this.doorHint.setDisplaySize(300, 60);
    this.doorHint.setVisible(false);
    this.doorHint.setDepth(5);

    const playerX = this.startFromRight ? width - PLAYER_START_X + 80 : PLAYER_START_X;
    this.player = new Player(this, playerX, height / 2 + 30, this.wagon.getPlayerShadowScale());

    const spawnOptions = {
      mapWidth: this.mapWidth,
      visibleHeight,
      mapScrollX: this.mapScrollX,
      startsAtRight: !this.startFromRight,
      npcY: height / 2 + 150,
      npcSpeed: NPC_SPEED,
      npcTravelRatio: NPC_TRAVEL_RATIO,
    };
    const spawnedObjects = this.wagon.spawn(spawnOptions);
    this.mapImage = spawnedObjects.mapImage;
    this.npc = spawnedObjects.npc;
    this.water = spawnedObjects.water;
    this.anomalyOverlay = spawnedObjects.overlay;

    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'left' | 'right', Phaser.Input.Keyboard.Key>;
    this.doorKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.defeatScreen = new DefeatScreen(this, () => this.restartFromFirstCar());

    if (this.fadeInOnStart) {
    this.cameras.main.fadeIn(350, 0, 0, 0);
    }

    if (this.showWelcome) {
      this.openWelcomeScreen();
    } else {
      this.audio.start(this);
    }
  }

  private restartFromFirstCar(): void {
    this.scene.start('GameScene', {
      carNumberIndex: 1,
      resetScroll: true,
      startFromRight: false,
      fadeIn: true,
      showWelcome: true,
    });
  }

  private triggerLoseAnimation(): void {
    if (this.loseAnimationActive) {
      return;
    }

    this.loseAnimationActive = true;
    this.wagon.markExitResult(false);
    this.audio.handleDefeat();
    this.player.hide();
    this.npc.hide();
    const npcPosition = this.npc.getScreenPosition();
    const loseAnimation = this.wagon.playLoseAnimation(
      (this.player.x + npcPosition.x) / 2,
      (this.player.y + npcPosition.y) / 2,
      npcPosition.x < this.player.x,
    );
    this.audio.playMonster(this);
    loseAnimation?.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.time.delayedCall(LOSE_SCREEN_DELAY_MS, () => this.defeatScreen.show());
    });
  }

  update(_time: number, delta: number): void {
    if (this.showWelcome) {
      return;
    }

    if (this.defeatScreen.isVisible) {
      this.defeatScreen.update();
      return;
    }

    if (this.loseAnimationActive) {
      return;
    }

    const moveLeft = this.cursors.left.isDown || this.wasd.left.isDown;
    const moveRight = this.cursors.right.isDown || this.wasd.right.isDown;
    const playerHalfWidth = this.player.displayWidth / 2;
    const maxMapScroll = Math.max(0, this.mapWidth - this.mapViewWidth);
    // У края карты, где прокрутка уже невозможна, разрешаем игроку подойти ближе к краю экрана.
    const leftMargin = this.mapScrollX <= 0 ? MAP_EDGE_PLAYER_MARGIN : CAMERA_MARGIN;
    const rightMargin = this.mapScrollX >= maxMapScroll ? MAP_EDGE_PLAYER_MARGIN : CAMERA_MARGIN;
    const leftBoundary = leftMargin + playerHalfWidth;
    const rightBoundary = this.scale.width - rightMargin - playerHalfWidth;

    this.player.update(
      { left: moveLeft, right: moveRight },
      delta,
      leftBoundary,
      rightBoundary,
      this.scale.height,
      this.mapScrollX,
    );

    this.mapScrollX = updateMapScroll(
      this.mapScrollX,
      this.mapWidth,
      this.mapViewWidth,
      this.player.x,
      playerHalfWidth,
      this.scale.width,
      moveLeft,
      moveRight,
      delta,
      this.player.speed,
    );

    // Взаимодействие с NPC может запустить поражение; объекты аномалий следуют за прокруткой мира.
    const secondNpcInteraction = this.npc.update(
      delta,
      this.mapScrollX,
      this.player.x,
      this.player.displayWidth,
      Phaser.Input.Keyboard.JustDown(this.interactKey),
    );
    this.anomalyOverlay?.syncToMapScroll(this.mapScrollX);
    this.water.syncToMapScroll(this.mapScrollX);

    if (secondNpcInteraction || (this.wagon.losesOnNpcProximity() && this.npc.isCloseTo(this.player.x, this.player.displayWidth))) {
      this.triggerLoseAnimation();
      return;
    }

    const atLeftMapEnd = this.mapScrollX <= 0;
    const atRightMapEnd = this.mapScrollX >= maxMapScroll;
    // Проверяем границы после прокрутки, чтобы подсказка двери не появлялась раньше времени.
    const currentLeftBoundary = (atLeftMapEnd ? MAP_EDGE_PLAYER_MARGIN : CAMERA_MARGIN) + playerHalfWidth;
    const currentRightBoundary = this.scale.width - (atRightMapEnd ? MAP_EDGE_PLAYER_MARGIN : CAMERA_MARGIN) - playerHalfWidth;
    const atLeftEdge = atLeftMapEnd && this.player.x <= currentLeftBoundary + 18;
    const atRightEdge = atRightMapEnd && this.player.x >= currentRightBoundary - 18;
    const doorIsVisible = atLeftEdge || atRightEdge;
    const doorDirectionLeft = atLeftEdge;

    if (doorIsVisible) {
      const hintX = doorDirectionLeft ? this.player.x - 60 : this.player.x + 60;
      this.doorHint.setVisible(true);
      this.doorHint.setPosition(hintX, this.player.y - 250);
    } else {
      this.doorHint.setVisible(false);
    }

    const wantsTransition = !this.transitionStarted && (Phaser.Input.Keyboard.JustDown(this.doorKey) || Phaser.Input.Keyboard.JustDown(this.upKey));
    if (wantsTransition && atLeftEdge) {
      this.startTransition(true);
      return;
    }
    if (wantsTransition && atRightEdge) {
      this.startTransition(false);
      return;
    }

    this.mapImage.x = -this.mapScrollX;
    this.carNumber.syncToMapScroll(this.mapScrollX);
    this.rightCarNumber.syncToMapScroll(this.mapScrollX);

  }
}
