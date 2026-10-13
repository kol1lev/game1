import Phaser from 'phaser';
import { Anomaly } from './Anomaly';
import { Normal } from './Normal';
import { Wagon, type WagonType } from './Wagon';

export class WagonFactory {
  public static preload(scene: Phaser.Scene): void {
    Wagon.preload(scene);
    Normal.preload(scene);
    Anomaly.preload(scene);
  }

  public static create(scene: Phaser.Scene, type?: WagonType): Wagon {
    // При перезапуске сцены тип вагона задаётся явно, иначе он выбирается случайно.
    const selectedType = type ?? (Math.random() < 0.45 ? 'normal' : 'anomaly');
    return selectedType === 'anomaly' ? new Anomaly(scene) : new Normal(scene);
  }
}