import Phaser from 'phaser';
import normalMapTexture from '../pics/maps/normal1.1.jpg';
import { Wagon, type WagonSpawnOptions, type WagonSpawnResult } from './Wagon';

export class Normal extends Wagon {
  public readonly type = 'normal';

  public static preload(scene: Phaser.Scene): void {
    scene.load.image('map-normal', normalMapTexture);
  }

  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  public getMapTextureKey(): string {
    return 'map-normal';
  }

  public spawn(options: WagonSpawnOptions): WagonSpawnResult {
    return this.spawn_normal(options);
  }

  public spawn_normal(options: WagonSpawnOptions): WagonSpawnResult {
    return this.spawnBase(options, this.getMapTextureKey());
  }
}