import Phaser from 'phaser';

export class MapObject extends Phaser.GameObjects.Sprite {
  private worldX: number;

  constructor(scene: Phaser.Scene, worldX: number, y: number, texture: string, width: number, height: number) {
    super(scene, worldX, y, texture);

    this.worldX = worldX;
    this.setDisplaySize(width, height);
    this.setDepth(1);
  }

  public syncToMapScroll(mapScrollX: number): void {
    this.x = this.worldX - mapScrollX;
  }
}
