import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { VictoryScene } from './VictoryScene';

const GAME_HEIGHT = 712;

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: Math.round(window.innerWidth * GAME_HEIGHT / window.innerHeight),
    height: GAME_HEIGHT,
    backgroundColor: '#0f172a',
    scene: [GameScene, VictoryScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}
