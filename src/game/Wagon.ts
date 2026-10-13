import Phaser from 'phaser';
import waterTexture from '../pics/other/water.png';
import waterReverseTexture from '../pics/other/waterreverse.png';
import ketchupTexture from '../pics/other/ketchup.png';
import { Npc } from './Npc';
import { MapObject } from './MapObject';

const WATER_TEXTURE_KEY = 'wagon-water';
const WATER_REVERSE_TEXTURE_KEY = 'wagon-water-reverse';
const KETCHUP_TEXTURE_KEY = 'wagon-ketchup';
const WATER_FRAME_WIDTH = 300;
const WATER_FRAME_HEIGHT = 712;
const WATER_FRAME_RATE = 15;
const WATER_WORLD_OFFSET_X = 450;

export type WagonType = 'normal' | 'anomaly';

export type WagonSpawnOptions = {
  mapWidth: number;
  visibleHeight: number;
  mapScrollX: number;
  startsAtRight: boolean;
  npcY: number;
  npcSpeed: number;
  npcTravelRatio: number;
  greetingTextureKey?: string;
  loseOnSecondInteraction?: boolean;
};

export type WagonSpawnResult = {
  mapImage: Phaser.GameObjects.Image;
  npc: Npc;
  water: MapObject;
  // Накладка аномалии: единый объект, привязанный к координатам карты.
  overlay?: MapObject;
};

// Общий интерфейс вагонов и базовый спавн карты с NPC; подклассы добавляют особенности вариантов.
export abstract class Wagon {
  public abstract readonly type: WagonType;

  public static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(WATER_TEXTURE_KEY, waterTexture, {
      frameWidth: WATER_FRAME_WIDTH,
      frameHeight: WATER_FRAME_HEIGHT,
    });
    scene.load.spritesheet(WATER_REVERSE_TEXTURE_KEY, waterReverseTexture, {
      frameWidth: WATER_FRAME_WIDTH,
      frameHeight: WATER_FRAME_HEIGHT,
    });
    scene.load.spritesheet(KETCHUP_TEXTURE_KEY, ketchupTexture, {
      frameWidth: WATER_FRAME_WIDTH,
      frameHeight: WATER_FRAME_HEIGHT,
    });
  }

  protected constructor(protected readonly scene: Phaser.Scene) {}

  public abstract getMapTextureKey(): string;

  public abstract spawn(options: WagonSpawnOptions): WagonSpawnResult;

  public getNpcSpeed(baseSpeed: number): number {
    return baseSpeed;
  }

  public getNpcTravelRatio(baseTravelRatio: number): number {
    return baseTravelRatio;
  }

  public getPlayerShadowScale(): number {
    return 1;
  }

  public getWaterTextureKey(): string {
    return WATER_TEXTURE_KEY;
  }

  public playLoseAnimation(_x: number, _y: number, _flipX: boolean): Phaser.GameObjects.Sprite | undefined {
    return undefined;
  }

  // Сближение с NPC приводит к поражению только у отдельных вариантов аномалий.
  public losesOnNpcProximity(): boolean {
    return false;
  }

  // Результат выхода из вагона важен только аномалиям; обычные вагоны игнорируют его.
  public markExitResult(_found: boolean): void {}

  protected spawnBase(options: WagonSpawnOptions, mapTextureKey: string): WagonSpawnResult {
    const { mapWidth, visibleHeight, mapScrollX, startsAtRight, npcY, npcSpeed, npcTravelRatio, greetingTextureKey, loseOnSecondInteraction } = options;
    const mapImage = this.scene.add.image(-mapScrollX, 0, mapTextureKey).setOrigin(0, 0);
    mapImage.setDisplaySize(mapWidth, visibleHeight);

    const npc = new Npc(
      this.scene,
      mapWidth,
      startsAtRight,
      mapScrollX,
      npcY,
      this.getNpcSpeed(npcSpeed),
      this.getNpcTravelRatio(npcTravelRatio),
      greetingTextureKey,
      loseOnSecondInteraction,
    );

    const waterTextureKey = this.getWaterTextureKey();
    const waterTexture = this.scene.textures.get(waterTextureKey);
    waterTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    if (!this.scene.anims.exists(waterTextureKey)) {
      this.scene.anims.create({
        key: waterTextureKey,
        frames: this.scene.anims.generateFrameNumbers(waterTextureKey, { start: 0, end: 14 }),
        frameRate: WATER_FRAME_RATE,
        repeat: -1,
      });
    }

    const water = new MapObject(
      this.scene,
      mapWidth / 2 + WATER_WORLD_OFFSET_X,
      visibleHeight / 2,
      waterTextureKey,
      WATER_FRAME_WIDTH,
      WATER_FRAME_HEIGHT,
    );
    this.scene.add.existing(water);
    water.anims.play(waterTextureKey);
    water.syncToMapScroll(mapScrollX);

    return { mapImage, npc, water };
  }
}