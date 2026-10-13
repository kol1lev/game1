import Phaser from 'phaser';
import anomaly1MapTexture from '../pics/maps/anomaly1.jpg';
import anomaly2MapTexture from '../pics/maps/anomaly2.jpg';
import infinityRingMapTexture from '../pics/maps/infring.png';
import eyesTexture from '../pics/other/Eyes.png';
import runAnomalyTexture from '../pics/other/RUNanomaly.png';
import loseAnimationTexture from '../pics/other/loseanim.png';
import wtfTexture from '../pics/other/wtf.png';
import tracesAnim from '../pics/other/traces_anim.png';
import tracesStaticTexture from '../pics/other/traces_static.png';

import { MapObject } from './MapObject';
import { Wagon, type WagonSpawnOptions, type WagonSpawnResult } from './Wagon';

const ANOMALY_MAP_KEYS = ['map-anomaly-1', 'map-anomaly-2', 'map-infinity-ring'] as const;
const ANOMALY_VARIANTS = ['anomaly1', 'anomaly2', 'fastNpc', 'largeShadow', 'eyes', 'midpointNpc', 'run', 'infinityRing', 'wtf', 'waterReverse', 'ketchup', 'tracesAnim', 'tracesStatic'] as const;
const EYES_TEXTURE_KEY = 'anomaly-eyes';
const WTF_TEXTURE_KEY = 'anomaly-wtf';
const EYES_FRAME_WIDTH = 180;
const EYES_FRAME_HEIGHT = 100;
const EYES_FRAME_RATE = 6;
const RUN_ANOMALY_TEXTURE_KEY = 'run-anomaly';
const RUN_ANOMALY_FRAME_WIDTH = 280;
const RUN_ANOMALY_FRAME_HEIGHT = 80;
const RUN_ANOMALY_FRAME_RATE = 10;
const TRACES_ANOMALY_FRAME_RATE = 5;
const TRACES_ANOMALY_FRAME_WIDTH = 2617;
const TRACES_ANOMALY_FRAME_HEIGHT = 49;
const TRACES_ANOMALY_TEXTURE_KEY = 'traces-anomaly';
const TRACES_STATIC_ANOMALY_TEXTURE_KEY = 'traces-static';
const TRACES_ANOMALY_Y = 25;
const LOSE_ANIMATION_TEXTURE_KEY = 'lose-animation';
const LOSE_ANIMATION_FRAME_WIDTH = 50;
const LOSE_ANIMATION_FRAME_HEIGHT = 64;
const LOSE_ANIMATION_FRAME_RATE = 8;
type AnomalyVariant = (typeof ANOMALY_VARIANTS)[number];

// Накладка аномалии поверх карты: все варианты — один MapObject, привязанный к координатам карты.
type OverlayConfig = {
  textureKey: string;
  width: number;
  height: number;
  // Смещение от центра карты; для части вариантов отличается при старте справа.
  offsetX: number;
  offsetXWhenStartsAtRight?: number;
  y: 'center' | number;
  animation?: {
    start: number;
    end: number;
    frameRate: number;
    repeat: number;
  };
};

const ANOMALY_OVERLAYS: Partial<Record<AnomalyVariant, OverlayConfig>> = {
  eyes: {
    textureKey: EYES_TEXTURE_KEY,
    width: EYES_FRAME_WIDTH,
    height: EYES_FRAME_HEIGHT,
    offsetX: -170,
    offsetXWhenStartsAtRight: 170,
    y: 'center',
    animation: { start: 0, end: 20, frameRate: EYES_FRAME_RATE, repeat: -1 },
  },
  run: {
    textureKey: RUN_ANOMALY_TEXTURE_KEY,
    width: RUN_ANOMALY_FRAME_WIDTH,
    height: RUN_ANOMALY_FRAME_HEIGHT,
    offsetX: 600,
    offsetXWhenStartsAtRight: -570,
    y: 'center',
    animation: { start: 0, end: 47, frameRate: RUN_ANOMALY_FRAME_RATE, repeat: 0 },
  },
  tracesAnim: {
    textureKey: TRACES_ANOMALY_TEXTURE_KEY,
    width: TRACES_ANOMALY_FRAME_WIDTH,
    height: TRACES_ANOMALY_FRAME_HEIGHT,
    offsetX: 0,
    y: TRACES_ANOMALY_Y,
    animation: { start: 0, end: 25, frameRate: TRACES_ANOMALY_FRAME_RATE, repeat: -1 },
  },
  tracesStatic: {
    textureKey: TRACES_STATIC_ANOMALY_TEXTURE_KEY,
    width: TRACES_ANOMALY_FRAME_WIDTH,
    height: TRACES_ANOMALY_FRAME_HEIGHT,
    offsetX: 0,
    y: TRACES_ANOMALY_Y,
  },
};

export class Anomaly extends Wagon {
  public readonly type = 'anomaly';
  private readonly variant: AnomalyVariant;
  private readonly mapTextureKey: (typeof ANOMALY_MAP_KEYS)[number] | 'map-normal';

  public static preload(scene: Phaser.Scene): void {
    scene.load.image(ANOMALY_MAP_KEYS[0], anomaly1MapTexture);
    scene.load.image(ANOMALY_MAP_KEYS[1], anomaly2MapTexture);
    scene.load.image(ANOMALY_MAP_KEYS[2], infinityRingMapTexture);
    scene.load.image(WTF_TEXTURE_KEY, wtfTexture);
    scene.load.image(TRACES_STATIC_ANOMALY_TEXTURE_KEY, tracesStaticTexture);
    scene.load.spritesheet(EYES_TEXTURE_KEY, eyesTexture, {
      frameWidth: EYES_FRAME_WIDTH,
      frameHeight: EYES_FRAME_HEIGHT,
    });
    scene.load.spritesheet(RUN_ANOMALY_TEXTURE_KEY, runAnomalyTexture, {
      frameWidth: RUN_ANOMALY_FRAME_WIDTH,
      frameHeight: RUN_ANOMALY_FRAME_HEIGHT,
    });
    scene.load.spritesheet(LOSE_ANIMATION_TEXTURE_KEY, loseAnimationTexture, {
      frameWidth: LOSE_ANIMATION_FRAME_WIDTH,
      frameHeight: LOSE_ANIMATION_FRAME_HEIGHT,
    });
    scene.load.spritesheet(TRACES_ANOMALY_TEXTURE_KEY, tracesAnim, {
      frameWidth: TRACES_ANOMALY_FRAME_WIDTH,
      frameHeight: TRACES_ANOMALY_FRAME_HEIGHT,
    });
  }

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.variant = Phaser.Math.RND.pick([...ANOMALY_VARIANTS]);
    this.mapTextureKey = this.variant === 'anomaly1'
      ? ANOMALY_MAP_KEYS[0]
      : this.variant === 'anomaly2'
        ? ANOMALY_MAP_KEYS[1]
        : this.variant === 'infinityRing'
          ? ANOMALY_MAP_KEYS[2]
          : 'map-normal';
  }

  private get hasNpcEncounter(): boolean {
    // Эти варианты используют общее приветствие WTF и последовательность поражения, сохраняя настройки NPC.
    return this.variant === 'wtf' || this.variant === 'fastNpc' || this.variant === 'midpointNpc';
  }

  public override getMapTextureKey(): string {
    return this.mapTextureKey;
  }

  public override getNpcSpeed(baseSpeed: number): number {
    return this.variant === 'fastNpc' ? baseSpeed * 2.5 : baseSpeed;
  }

  public override getNpcTravelRatio(baseTravelRatio: number): number {
    return this.variant === 'midpointNpc' ? 0.4 : baseTravelRatio;
  }

  public override getPlayerShadowScale(): number {
    return this.variant === 'largeShadow' ? 2 : 1;
  }

  // В этом варианте сближение NPC с игроком заканчивается поражением.
  public override losesOnNpcProximity(): boolean {
    return this.variant === 'run';
  }

  public override getWaterTextureKey(): string {
    if (this.variant === 'waterReverse') {
      return 'wagon-water-reverse';
    }
    if (this.variant === 'ketchup') {
      return 'wagon-ketchup';
    }

    return super.getWaterTextureKey();
  }

  public override playLoseAnimation(x: number, y: number, flipX: boolean): Phaser.GameObjects.Sprite | undefined {
    if (this.variant !== 'run' && !this.hasNpcEncounter) {
      return undefined;
    }

    if (!this.scene.anims.exists(LOSE_ANIMATION_TEXTURE_KEY)) {
      this.scene.anims.create({
        key: LOSE_ANIMATION_TEXTURE_KEY,
        frames: this.scene.anims.generateFrameNumbers(LOSE_ANIMATION_TEXTURE_KEY, { start: 0, end: 23 }),
        frameRate: LOSE_ANIMATION_FRAME_RATE,
        repeat: 0,
      });
    }

    const loseAnimation = this.scene.add.sprite(x, y, LOSE_ANIMATION_TEXTURE_KEY);
    loseAnimation.setScale(12);
    loseAnimation.setDepth(5);
    loseAnimation.flipX = flipX;
    loseAnimation.anims.play(LOSE_ANIMATION_TEXTURE_KEY);
    return loseAnimation;
  }

  public override spawn(options: WagonSpawnOptions): WagonSpawnResult {
    return this.spawn_anomaly(options);
  }

  public spawn_anomaly(options: WagonSpawnOptions): WagonSpawnResult {
    this.scene.textures.get(LOSE_ANIMATION_TEXTURE_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const baseSpawn = this.spawnBase({
      ...options,
      greetingTextureKey: this.hasNpcEncounter ? WTF_TEXTURE_KEY : options.greetingTextureKey,
      loseOnSecondInteraction: this.hasNpcEncounter,
    }, this.mapTextureKey);

    const overlayConfig = ANOMALY_OVERLAYS[this.variant];
    const overlay = overlayConfig ? this.spawnOverlay(overlayConfig, options) : undefined;

    return { ...baseSpawn, overlay };
  }

  // Все накладки аномалий создаются одинаково: отличаются только текстура, размер, позиция и наличие анимации.
  private spawnOverlay(config: OverlayConfig, options: WagonSpawnOptions): MapObject {
    const { mapWidth, visibleHeight, mapScrollX, startsAtRight } = options;
    const offsetX = startsAtRight ? config.offsetXWhenStartsAtRight ?? config.offsetX : config.offsetX;
    const y = config.y === 'center' ? visibleHeight / 2 : config.y;

    if (config.animation && !this.scene.anims.exists(config.textureKey)) {
      this.scene.anims.create({
        key: config.textureKey,
        frames: this.scene.anims.generateFrameNumbers(config.textureKey, {
          start: config.animation.start,
          end: config.animation.end,
        }),
        frameRate: config.animation.frameRate,
        repeat: config.animation.repeat,
      });
    }

    const overlay = new MapObject(this.scene, mapWidth / 2 + offsetX, y, config.textureKey, config.width, config.height);
    this.scene.add.existing(overlay);
    if (config.animation) {
      overlay.anims.play(config.textureKey);
    }
    overlay.syncToMapScroll(mapScrollX);

    return overlay;
  }
}